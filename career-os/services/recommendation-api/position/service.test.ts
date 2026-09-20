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
    schemaVersion: 2,
    candidateContextVersion: "context-1",
    dailyAnalysisLimit: 20,
    prioritySlots: 16,
    agingSlots: 4,
    staleAfterDays: 30,
    defaultCompanyTier: 3,
    dailyCompanyTierLimit: 5,
    companyTierStaleAfterDays: 90,
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
        schemaVersion: 2,
        analysisContractVersion: 1,
        pool: pool("run-without-policy"),
      }),
    ).rejects.toMatchObject({ status: 409, code: "POLICY_NOT_CONFIGURED" });
  });

  test("같은 본문 분석을 다음 수집에서 재사용하고 추천 순서를 유지한다", async () => {
    const { repository, service: target } = await service();
    const first = await target.saveCollection(
      { schemaVersion: 2, analysisContractVersion: 1, pool: pool("run-1") },
      "2026-09-17T01:00:00.000Z",
    );
    expect(first.candidates).toHaveLength(1);
    await target.saveAnalysisResults(
      first.analysisRunId,
      {
        schemaVersion: 2,
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
      { schemaVersion: 2, analysisContractVersion: 1, pool: pool("run-2") },
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
      schemaVersion: 2,
      analysisContractVersion: 1,
      pool: pool("run-1"),
    });
    await target.saveAnalysisResults(first.analysisRunId, {
      schemaVersion: 2,
      collectionRunId: first.collectionRunId,
      results: [result(first.candidates[0].positionId)],
    });
    const changed = await target.saveCollection({
      schemaVersion: 2,
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
      schemaVersion: 2,
      analysisContractVersion: 1,
      pool: pool("run-partial", "Backend Engineer", "partial"),
    });
    await target.saveAnalysisResults(queue.analysisRunId, {
      schemaVersion: 2,
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
      schemaVersion: 2,
      analysisContractVersion: 1,
      pool: input,
    });
    await expect(
      target.saveAnalysisResults(queue.analysisRunId, {
        schemaVersion: 2,
        collectionRunId: queue.collectionRunId,
        results: [result(queue.candidates[0].positionId)],
      }),
    ).rejects.toThrow("아직 끝나지 않은 모든 공고의 결과");
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
      schemaVersion: 2,
      analysisContractVersion: 1,
      pool: pool("run-present"),
    });
    const missing = pool("run-partial-missing", "Backend Engineer", "partial");
    missing.candidates = [];
    missing.sourceDiagnostics[0].collectedCount = 0;
    missing.sourceDiagnostics[0].importedCount = 0;
    await target.saveCollection({ schemaVersion: 2, analysisContractVersion: 1, pool: missing });
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
      schemaVersion: 2,
      analysisContractVersion: 1,
      pool: pool("run-exclude"),
    });
    expect(queue.summary.activeCount).toBe(0);
    expect(queue.candidates).toHaveLength(0);
  });

  test("분석을 반영하면 항목마다 created와 analysisId와 최초 생성 실행을 남긴다", async () => {
    const { repository, service: target } = await service();
    const queue = await target.saveCollection(
      { schemaVersion: 2, analysisContractVersion: 1, pool: pool("run-provenance") },
      "2026-09-17T01:00:00.000Z",
    );
    const response = await target.saveAnalysisResults(
      queue.analysisRunId,
      {
        schemaVersion: 2,
        collectionRunId: queue.collectionRunId,
        results: [result(queue.candidates[0].positionId)],
      },
      "2026-09-17T02:00:00.000Z",
    );
    expect(response).toMatchObject({
      status: "completed",
      createdCount: 1,
      reusedCount: 0,
      failedCount: 0,
      remainingCount: 0,
      applied: true,
    });
    const state = repository.snapshot();
    const items = [...state.analysisRuns.get(queue.analysisRunId)!.items.values()];
    const analysis = [...state.positions.values()][0].analyses[0];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      resultStatus: "created",
      analysisId: analysis.analysisId,
      failureCode: null,
      attemptCount: 1,
      completedAt: "2026-09-17T02:00:00.000Z",
    });
    expect(analysis.createdByAnalysisRunId).toBe(queue.analysisRunId);
  });

  test("만료 뒤 다시 선택된 공고는 reused로 남고 최초 생성 실행을 유지한다", async () => {
    const { repository, service: target } = await service();
    const first = await target.saveCollection(
      { schemaVersion: 2, analysisContractVersion: 1, pool: pool("run-first") },
      "2026-09-17T01:00:00.000Z",
    );
    await target.saveAnalysisResults(
      first.analysisRunId,
      {
        schemaVersion: 2,
        collectionRunId: first.collectionRunId,
        results: [result(first.candidates[0].positionId)],
      },
      "2026-09-17T02:00:00.000Z",
    );
    const second = await target.saveCollection(
      { schemaVersion: 2, analysisContractVersion: 1, pool: pool("run-expired") },
      "2026-11-01T01:00:00.000Z",
    );
    expect(second.candidates[0].analysisStatus).toBe("stale");
    expect(second.candidates[0].resultStatus).toBe("pending");
    await target.saveAnalysisResults(
      second.analysisRunId,
      {
        schemaVersion: 2,
        collectionRunId: second.collectionRunId,
        results: [result(second.candidates[0].positionId)],
      },
      "2026-11-01T02:00:00.000Z",
    );
    const state = repository.snapshot();
    const item = state.analysisRuns.get(second.analysisRunId)!.items.get(
      second.candidates[0].positionId,
    )!;
    const analyses = [...state.positions.values()][0].analyses;
    expect(item.resultStatus).toBe("reused");
    expect(analyses).toHaveLength(1);
    expect(analyses[0].createdByAnalysisRunId).toBe(first.analysisRunId);
    expect(item.analysisId).toBe(analyses[0].analysisId);
    expect(state.analysisRuns.get(second.analysisRunId)!.analyzedNowCount).toBe(0);
  });

  test("과거 실행이 만든 분석만 순위에 들면 추천의 새 분석 수는 0이다", async () => {
    const { service: target } = await service();
    const first = await target.saveCollection(
      { schemaVersion: 2, analysisContractVersion: 1, pool: pool("run-fresh-1") },
      "2026-09-17T01:00:00.000Z",
    );
    await target.saveAnalysisResults(
      first.analysisRunId,
      {
        schemaVersion: 2,
        collectionRunId: first.collectionRunId,
        results: [result(first.candidates[0].positionId)],
      },
      "2026-09-17T02:00:00.000Z",
    );
    const second = await target.saveCollection(
      { schemaVersion: 2, analysisContractVersion: 1, pool: pool("run-fresh-2") },
      "2026-09-18T01:00:00.000Z",
    );
    const recommendation = await target.createRecommendation(
      second.analysisRunId,
      "2026-09-18T02:00:00.000Z",
    );
    expect(recommendation.ranking).toHaveLength(1);
    expect(recommendation.analysisSummary.analyzedNowCount).toBe(0);
    expect(recommendation.analysisSummary.reusedCount).toBe(recommendation.ranking.length);
  });
});

describe("부분 실패와 재시도", () => {
  function twoCandidatePool(runId: string): PostingCandidatePool {
    const input = pool(runId);
    input.candidates.push({
      ...input.candidates[0],
      id: "wanted:candidate-2",
      identityHash: "wanted:2",
      url: "https://example.com/jobs/2",
    });
    input.sourceDiagnostics[0].collectedCount = 2;
    input.sourceDiagnostics[0].importedCount = 2;
    return input;
  }

  async function partialRun() {
    const { repository, service: target } = await service();
    const queue = await target.saveCollection(
      { schemaVersion: 2, analysisContractVersion: 1, pool: twoCandidatePool("run-partial-fail") },
      "2026-09-17T01:00:00.000Z",
    );
    const [analyzed, failed] = queue.candidates;
    const response = await target.saveAnalysisResults(
      queue.analysisRunId,
      {
        schemaVersion: 2,
        collectionRunId: queue.collectionRunId,
        results: [result(analyzed.positionId)],
        failures: [{ positionId: failed.positionId, failureCode: "model_unavailable" }],
      },
      "2026-09-17T02:00:00.000Z",
    );
    return { repository, target, queue, analyzed, failed, response };
  }

  test("결과 하나와 실패 하나를 함께 반영하면 실행이 partial로 남는다", async () => {
    const { repository, queue, response } = await partialRun();
    expect(response).toMatchObject({
      status: "partial",
      createdCount: 1,
      reusedCount: 0,
      failedCount: 1,
      remainingCount: 1,
      applied: true,
    });
    expect(repository.snapshot().analysisRuns.get(queue.analysisRunId)!.status).toBe("partial");
  });

  test("partial 실행으로도 추천을 만들고 실패한 공고를 분석 대기로 남긴다", async () => {
    const { target, queue, failed } = await partialRun();
    const recommendation = await target.createRecommendation(
      queue.analysisRunId,
      "2026-09-17T03:00:00.000Z",
    );
    expect(recommendation.ranking).toHaveLength(1);
    expect(recommendation.pendingCandidates.map((entry) => entry.candidateId)).toEqual([
      failed.candidateId,
    ]);
  });

  test("남은 항목만 다시 제출하면 completed가 되고 제출 횟수가 올라간다", async () => {
    const { repository, target, queue, failed } = await partialRun();
    const retry = await target.saveAnalysisResults(
      queue.analysisRunId,
      {
        schemaVersion: 2,
        collectionRunId: queue.collectionRunId,
        results: [result(failed.positionId)],
      },
      "2026-09-17T04:00:00.000Z",
    );
    expect(retry).toMatchObject({
      status: "completed",
      createdCount: 2,
      failedCount: 0,
      remainingCount: 0,
      applied: true,
    });
    const item = repository
      .snapshot()
      .analysisRuns.get(queue.analysisRunId)!
      .items.get(failed.positionId)!;
    expect(item).toMatchObject({ resultStatus: "created", attemptCount: 2, failureCode: null });
  });

  test("완료된 실행에 다시 제출하면 상태를 바꾸지 않고 applied가 false다", async () => {
    const { repository, target, queue, analyzed, failed } = await partialRun();
    await target.saveAnalysisResults(
      queue.analysisRunId,
      {
        schemaVersion: 2,
        collectionRunId: queue.collectionRunId,
        results: [result(failed.positionId)],
      },
      "2026-09-17T04:00:00.000Z",
    );
    const count = () =>
      [...repository.snapshot().positions.values()].reduce(
        (total, position) => total + position.analyses.length,
        0,
      );
    const before = count();
    const again = await target.saveAnalysisResults(
      queue.analysisRunId,
      {
        schemaVersion: 2,
        collectionRunId: queue.collectionRunId,
        results: [result(analyzed.positionId), result(failed.positionId)],
      },
      "2026-09-17T05:00:00.000Z",
    );
    expect(again).toMatchObject({ status: "completed", applied: false, remainingCount: 0 });
    expect(count()).toBe(before);
  });

  test("이미 끝난 항목까지 함께 제출하면 409로 거절한다", async () => {
    const { target, queue, analyzed, failed } = await partialRun();
    await expect(
      target.saveAnalysisResults(
        queue.analysisRunId,
        {
          schemaVersion: 2,
          collectionRunId: queue.collectionRunId,
          results: [result(analyzed.positionId), result(failed.positionId)],
        },
        "2026-09-17T04:00:00.000Z",
      ),
    ).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
  });

  test("큐 응답 요약은 선택 항목 기준으로 완료와 실패를 센다", async () => {
    const { target, queue } = await partialRun();
    const reloaded = await target.getRun(queue.analysisRunId);
    expect(reloaded).toMatchObject({
      summary: { queuedCount: 2, completedCount: 1, failedCount: 1 },
    });
    expect(
      "candidates" in reloaded
        ? reloaded.candidates.map((candidate) => candidate.resultStatus).sort()
        : [],
    ).toEqual(["created", "failed"]);
  });
});
