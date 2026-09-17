import { describe, expect, test } from "bun:test";
import type { PostingCandidatePool } from "../../../scripts/position-recommender/live-postings/contracts.ts";
import { MemoryPositionRepository } from "./memory-repository.ts";
import { PositionService } from "./service.ts";

function pool(
  runId: string,
  title = "Backend Engineer",
  diagnosticStatus: "ok" | "partial" = "ok",
): PostingCandidatePool {
  return {
    schemaVersion: 1,
    collectionRunId: runId,
    collectedAt: "2026-09-17T00:00:00.000Z",
    requestedSource: "all",
    configuredSources: ["wanted"],
    policy: {
      selection: "llm",
      activeDirectOnly: true,
      fixedPreferenceKeywordsUsed: false,
      sourcePriorityUsed: false,
    },
    candidates: [
      {
        id: "wanted:candidate-1",
        source: "wanted",
        company: "테스트 회사",
        title,
        url: "https://example.com/jobs/1",
        identityHash: "wanted:1",
        linkType: "direct_posting",
        postingStatus: "active",
        activeEvidence: "active",
        openedAt: "",
        closesAt: "",
        daysUntilClose: "",
        closeUrgency: "normal",
        category: "개발",
        summary: "서버 개발",
        tags: [],
        skills: ["Java"],
        dueTime: "",
        mainTasks: "서버 개발",
        requirements: "Java",
        preferred: "",
      },
    ],
    sourceDiagnostics: [
      {
        source: "wanted",
        status: diagnosticStatus,
        collectedCount: 1,
        importedCount: 1,
        skippedCount: 0,
        failedCount: diagnosticStatus === "partial" ? 3 : 0,
        discoveryModes: ["broad"],
        message: diagnosticStatus === "partial" ? "https://private-error.example 실패" : "ok",
      },
    ],
    filterSummary: { personalExcludedCount: 2 },
    errors: [],
  };
}

async function service() {
  const repository = new MemoryPositionRepository();
  const service = new PositionService(repository);
  await service.configurePolicy({
    schemaVersion: 1,
    candidateContextVersion: "context-1",
    dailyAnalysisLimit: 20,
    prioritySlots: 16,
    agingSlots: 4,
    staleAfterDays: 30,
    defaultCompanyTier: 3,
  });
  return { repository, service };
}

function result(positionId: string) {
  return {
    positionId,
    decision: "recommend" as const,
    fitScore: 80,
    scoreBreakdown: { roleFit: 35, scopeUpside: 20, companyOpportunity: 15, constraints: 10 },
    reason: "현재 경험을 확장할 수 있다.",
    details: [],
    nextActions: [],
  };
}

describe("position service", () => {
  test("정책이 없으면 첫 수집을 409로 중단한다", async () => {
    const target = new PositionService(new MemoryPositionRepository());
    await expect(
      target.saveCollection({
        schemaVersion: 1,
        analysisContractVersion: 1,
        pool: pool("run-without-policy"),
      }),
    ).rejects.toMatchObject({ status: 409, code: "POLICY_NOT_CONFIGURED" });
  });

  test("같은 본문 분석을 다음 수집에서 재사용하고 추천 순서를 유지한다", async () => {
    const { repository, service: target } = await service();
    const first = await target.saveCollection(
      { schemaVersion: 1, analysisContractVersion: 1, pool: pool("run-1") },
      "2026-09-17T01:00:00.000Z",
    );
    expect(first.candidates).toHaveLength(1);
    await target.saveAnalysisResults(
      first.analysisRunId,
      {
        schemaVersion: 1,
        collectionRunId: first.collectionRunId,
        results: [result(first.candidates[0].positionId)],
      },
      "2026-09-17T02:00:00.000Z",
    );
    const recommendation = await target.createRecommendation(
      first.analysisRunId,
      "2026-09-17T03:00:00.000Z",
    );
    const analysisCount = [...repository.snapshot().positions.values()][0].analyses.length;
    const second = await target.saveCollection(
      { schemaVersion: 1, analysisContractVersion: 1, pool: pool("run-2") },
      "2026-09-18T01:00:00.000Z",
    );
    expect(second.candidates).toHaveLength(0);
    expect(second.summary.reusedCount).toBe(1);
    const secondRecommendation = await target.createRecommendation(
      second.analysisRunId,
      "2026-09-18T02:00:00.000Z",
    );
    expect(secondRecommendation.ranking.map((entry) => entry.candidateId)).toEqual(
      recommendation.ranking.map((entry) => entry.candidateId),
    );
    expect([...repository.snapshot().positions.values()][0].analyses).toHaveLength(analysisCount);
  });

  test("본문 변경은 changed로 분류하고 과거 version과 분석을 보존한다", async () => {
    const { repository, service: target } = await service();
    const first = await target.saveCollection({
      schemaVersion: 1,
      analysisContractVersion: 1,
      pool: pool("run-1"),
    });
    await target.saveAnalysisResults(first.analysisRunId, {
      schemaVersion: 1,
      collectionRunId: first.collectionRunId,
      results: [result(first.candidates[0].positionId)],
    });
    const changed = await target.saveCollection({
      schemaVersion: 1,
      analysisContractVersion: 1,
      pool: pool("run-2", "Platform Backend Engineer"),
    });
    expect(changed.candidates[0].analysisStatus).toBe("changed");
    const position = [...repository.snapshot().positions.values()][0];
    expect(position.versions).toHaveLength(2);
    expect(position.analyses).toHaveLength(1);
  });

  test("부분 실패 응답에는 소스명과 실패 건수만 공개한다", async () => {
    const { service: target } = await service();
    const queue = await target.saveCollection({
      schemaVersion: 1,
      analysisContractVersion: 1,
      pool: pool("run-partial", "Backend Engineer", "partial"),
    });
    await target.saveAnalysisResults(queue.analysisRunId, {
      schemaVersion: 1,
      collectionRunId: queue.collectionRunId,
      results: [result(queue.candidates[0].positionId)],
    });
    const recommendation = await target.createRecommendation(queue.analysisRunId);
    expect(recommendation.collectionHealth.warningSources[0]).toMatchObject({
      source: "wanted",
      status: "partial",
      failedCount: 3,
    });
    expect(JSON.stringify(recommendation)).not.toContain("private-error");
  });

  test("분석 결과가 하나라도 누락되면 transaction 전체를 rollback한다", async () => {
    const { repository, service: target } = await service();
    const input = pool("run-missing");
    input.candidates.push({
      ...input.candidates[0],
      id: "wanted:candidate-2",
      identityHash: "wanted:2",
      url: "https://example.com/jobs/2",
    });
    const queue = await target.saveCollection({
      schemaVersion: 1,
      analysisContractVersion: 1,
      pool: input,
    });
    await expect(
      target.saveAnalysisResults(queue.analysisRunId, {
        schemaVersion: 1,
        collectionRunId: queue.collectionRunId,
        results: [result(queue.candidates[0].positionId)],
      }),
    ).rejects.toThrow("선택된 모든 공고 분석");
    expect(
      [...repository.snapshot().positions.values()].reduce(
        (total, position) => total + position.analyses.length,
        0,
      ),
    ).toBe(0);
  });

  test("partial 소스에서 보이지 않는 기존 공고 lifecycle을 유지한다", async () => {
    const { repository, service: target } = await service();
    await target.saveCollection({
      schemaVersion: 1,
      analysisContractVersion: 1,
      pool: pool("run-present"),
    });
    const missing = pool("run-partial-missing", "Backend Engineer", "partial");
    missing.candidates = [];
    missing.sourceDiagnostics[0].collectedCount = 0;
    missing.sourceDiagnostics[0].importedCount = 0;
    await target.saveCollection({ schemaVersion: 1, analysisContractVersion: 1, pool: missing });
    expect([...repository.snapshot().positions.values()][0].lifecycle).toBe("active");
  });

  test("회사 exclude는 모델 큐와 추천에서 제거한다", async () => {
    const { service: target } = await service();
    await target.updateCompanyPreference("테스트 회사", {
      companyKey: "테스트 회사",
      companyName: "테스트 회사",
      tier: 1,
      disposition: "exclude",
    });
    const queue = await target.saveCollection({
      schemaVersion: 1,
      analysisContractVersion: 1,
      pool: pool("run-exclude"),
    });
    expect(queue.summary.activeCount).toBe(0);
    expect(queue.candidates).toHaveLength(0);
  });
});
