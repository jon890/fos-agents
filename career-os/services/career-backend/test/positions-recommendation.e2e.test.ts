import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AnalysisQueueResponse, RecommendationResponse } from "../src/positions/schema.js";
import { legacyCase, materializeLegacyBody } from "./support/legacy-contract.js";
import { startE2eHarness, type E2eHarness, type Reply } from "./support/e2e-harness.js";

let harness: E2eHarness;

function send(method: string, path: string, options?: { body?: unknown; idempotencyKey?: string }) {
  return harness.send(method, path, options);
}

type AnalysisPolicyBody = {
  schemaVersion: 2;
  candidateContextVersion: string;
  dailyAnalysisLimit: number;
  prioritySlots: number;
  agingSlots: number;
  staleAfterDays: number;
  defaultCompanyTier: number;
  dailyCompanyTierLimit: number;
  companyTierStaleAfterDays: number;
};

function policy(overrides: Partial<AnalysisPolicyBody> = {}): AnalysisPolicyBody {
  return {
    schemaVersion: 2,
    candidateContextVersion: "candidate-context-2026-09",
    dailyAnalysisLimit: 5,
    prioritySlots: 3,
    agingSlots: 2,
    staleAfterDays: 30,
    defaultCompanyTier: 2,
    dailyCompanyTierLimit: 5,
    companyTierStaleAfterDays: 90,
    ...overrides,
  };
}

/** 공고 하나. 회사와 식별자만 다르고 본문은 같은 형태로 만든다. */
type Posting = { company: string; key: string };

function pool(runId: string, postings: Posting[], collectedAt: string) {
  return {
    schemaVersion: 2,
    analysisContractVersion: 1,
    companyTierContractVersion: 1,
    pool: {
      schemaVersion: 1,
      collectionRunId: runId,
      collectedAt,
      requestedSource: "all",
      configuredSources: ["wanted"],
      policy: {
        selection: "llm",
        activeDirectOnly: true,
        fixedPreferenceKeywordsUsed: false,
        sourcePriorityUsed: false,
      },
      candidates: postings.map((posting) => ({
        id: `wanted:${posting.key}`,
        source: "wanted",
        company: posting.company,
        title: `Backend Engineer ${posting.key}`,
        url: `https://example.com/jobs/${posting.key}`,
        identityHash: `wanted-${posting.key}`,
        linkType: "direct_posting",
        postingStatus: "active",
        activeEvidence: "모집 중 표기",
        openedAt: "",
        closesAt: "",
        daysUntilClose: "",
        closeUrgency: "normal",
        category: "개발",
        summary: `서버 개발 ${posting.key}`,
        tags: [],
        skills: ["Java"],
        dueTime: "",
        mainTasks: `서버 개발 ${posting.key}`,
        requirements: "Java",
        preferred: "",
      })),
      sourceDiagnostics: [
        {
          source: "wanted",
          status: "ok",
          collectedCount: postings.length,
          importedCount: postings.length,
          skippedCount: 0,
          failedCount: 0,
          discoveryModes: ["broad"],
          message: "ok",
        },
      ],
      filterSummary: { personalExcludedCount: 0 },
      errors: [],
    },
  };
}

function tierResult(companyKey: string, tier: number) {
  return {
    companyKey,
    recommendedTier: tier,
    confidence: "medium" as const,
    reason: "공개 자료로 성장 범위를 확인했다.",
    signals: [
      {
        axis: "growth-scope" as const,
        level: "medium" as const,
        evidenceIds: ["fixture-evidence"],
      },
      { axis: "compensation-upside" as const, level: "unknown" as const },
      { axis: "team-growth" as const, level: "unknown" as const },
    ],
    evidence: [
      { id: "fixture-evidence", url: "https://example.com/company", checkedAt: "2026-09-17" },
    ],
    assumptions: [],
  };
}

function analysisResult(positionId: string, fitScore = 80) {
  return {
    positionId,
    decision: "recommend" as const,
    fitScore,
    scoreBreakdown: {
      roleFit: fitScore - 45,
      scopeUpside: 20,
      companyOpportunity: 15,
      constraints: 10,
    },
    reason: "현재 경험을 넓힐 수 있다.",
    details: [],
    nextActions: [],
  };
}

type TierQueue = { companyTierRunId: string; companies: { companyKey: string }[] };

async function configure(overrides: Partial<AnalysisPolicyBody> = {}, key = "policy") {
  const reply = await send("PUT", "/api/positions/v1/analysis-policy", {
    idempotencyKey: key,
    body: policy(overrides),
  });
  expect(reply.status, "정책 설정 status").toBe(200);
}

async function collect(
  runId: string,
  postings: Posting[],
  collectedAt = "2026-09-17T00:00:00.000Z",
): Promise<TierQueue> {
  const reply = await send("POST", "/api/positions/v1/collection-runs", {
    idempotencyKey: `collect:${runId}`,
    body: pool(runId, postings, collectedAt),
  });
  expect(reply.status, `${runId} 수집 status`).toBe(201);
  return (reply.json as { companyTierQueue: TierQueue }).companyTierQueue;
}

async function assess(runId: string, queue: TierQueue, tiers: Record<string, number>) {
  if (queue.companies.length === 0) return;
  const reply = await send(
    "POST",
    `/api/positions/v1/company-tier-runs/${queue.companyTierRunId}/results`,
    {
      idempotencyKey: `assess:${runId}`,
      body: {
        schemaVersion: 1,
        collectionRunId: runId,
        results: queue.companies.map((company) =>
          tierResult(company.companyKey, tiers[company.companyKey] ?? 2),
        ),
        failures: [],
      },
    },
  );
  expect(reply.status, `${runId} 회사 tier 반영 status`).toBe(200);
}

async function openQueue(runId: string): Promise<AnalysisQueueResponse> {
  const reply = await send("POST", `/api/positions/v1/collection-runs/${runId}/analysis-runs`, {
    idempotencyKey: `analysis:${runId}`,
    body: {},
  });
  expect(reply.status, `${runId} 분석 실행 생성 status`).toBe(201);
  return reply.json as AnalysisQueueResponse;
}

async function submitResults(
  analysisRunId: string,
  collectionRunId: string,
  positionIds: string[],
): Promise<void> {
  const reply = await send(`POST`, `/api/positions/v1/analysis-runs/${analysisRunId}/results`, {
    idempotencyKey: `results:${analysisRunId}`,
    body: {
      schemaVersion: 2,
      collectionRunId,
      results: positionIds.map((positionId, index) => analysisResult(positionId, 80 - index * 10)),
      failures: [],
    },
  });
  expect(reply.status, `${analysisRunId} 분석 결과 반영 status`).toBe(200);
}

function createRecommendation(analysisRunId: string, key = `recommend:${analysisRunId}`) {
  return send("POST", "/api/positions/v1/recommendation-runs", {
    idempotencyKey: key,
    body: { schemaVersion: 1, analysisRunId },
  });
}

function expectLegacyRecommendation(id: string, reply: Reply): void {
  const { companyAssessments, ...legacyBody } = reply.json as RecommendationResponse;
  harness.expectMatchesLegacy(id, { ...reply, json: legacyBody });
  expect(companyAssessments.length, "회사별 축 판정").toBeGreaterThan(0);
  expect(JSON.stringify(companyAssessments)).not.toContain('"assessment"');
}

/** 한 분석 실행의 항목을 선택 순서대로 읽는다. */
async function itemPositionIds(analysisRunId: string): Promise<string[]> {
  const rows = await harness.prisma.$queryRaw<{ position_id: string }[]>`
    SELECT position_id FROM position_analysis_run_items
    WHERE analysis_run_id = ${analysisRunId} ORDER BY selection_order
  `;
  return rows.map((row) => row.position_id);
}

async function recommendationRunCount(): Promise<number> {
  const rows = await harness.prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM position_recommendation_runs
  `;
  return Number(rows[0]!.total);
}

async function recommendationItemCount(): Promise<number> {
  const rows = await harness.prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM position_recommendation_items
  `;
  return Number(rows[0]!.total);
}

/**
 * 포착 파일의 `given` 을 재생한다.
 *
 * 분석 결과 반영 요청의 `positionId` 는 그 회차에 만들어진 값이라 그대로 쓸 수 없다.
 * 방금 만든 실행의 항목에서 선택 순서대로 다시 가져와 채운다.
 */
async function replayGivenWithLiveIds(id: string): Promise<void> {
  for (const entry of legacyCase(id).given) {
    if (entry.kind === "sql") {
      await harness.prisma.$executeRawUnsafe(entry.statement);
      continue;
    }
    const request = structuredClone(entry.request);
    const match = /^\/api\/positions\/v1\/analysis-runs\/([^/]+)\/results$/.exec(request.path);
    if (match) {
      const positionIds = await itemPositionIds(match[1]!);
      const body = request.body as {
        results?: { positionId: string }[];
        failures?: { positionId: string }[];
      };
      let cursor = 0;
      for (const result of body.results ?? []) result.positionId = positionIds[cursor++]!;
      for (const failure of body.failures ?? []) failure.positionId = positionIds[cursor++]!;
    }
    const reply = await send(request.method, request.path, {
      body: materializeLegacyBody(request.body),
      idempotencyKey: request.headers.idempotencyKey ?? undefined,
    });
    expect(reply.status, `${id} 의 선행 요청 ${entry.label}`).toBe(entry.responseStatus);
  }
}

/** 포착 파일의 본 요청을 재생한다. `analysisRunId` 는 수집 실행 ID 에서 정해져 그대로 쓴다. */
function sendLegacyRecommendation(id: string): Promise<Reply> {
  const request = legacyCase(id).request;
  return send(request.method, request.path, {
    body: request.body,
    idempotencyKey: request.headers.idempotencyKey ?? undefined,
  });
}

beforeAll(async () => {
  harness = await startE2eHarness();
});

afterAll(async () => {
  await harness?.close();
});

beforeEach(async () => {
  await harness.clearAll();
});

describe("추천 실행 생성", () => {
  it("비교 기준 회사와 후보 회사의 근거 연결을 공개하고 비공개 판정은 제외한다", async () => {
    await configure();
    const preference = await send("PUT", "/api/positions/v1/company-preferences/현재직장", {
      idempotencyKey: "benchmark-recommendation",
      body: {
        companyKey: "현재직장",
        companyName: "현재직장",
        tier: null,
        disposition: "benchmark",
      },
    });
    expect(preference.status).toBe(200);
    const queue = await collect("collection-benchmark", [
      { company: "현재직장", key: "benchmark" },
      { company: "후보회사", key: "candidate" },
    ]);
    await assess("collection-benchmark", queue, { 현재직장: 2, 후보회사: 1 });
    const analysis = await openQueue("collection-benchmark");
    await submitResults(
      analysis.analysisRunId,
      "collection-benchmark",
      analysis.candidates.map((item) => item.positionId),
    );
    const reply = await createRecommendation(analysis.analysisRunId);
    expect(reply.status).toBe(201);
    const body = reply.json as RecommendationResponse;
    expect(body.ranking.map((item) => item.company)).toEqual(["후보회사"]);
    expect(body.companyAssessments.map((item) => [item.companyName, item.disposition])).toEqual([
      ["현재직장", "benchmark"],
      ["후보회사", "analyze"],
    ]);
    expect(
      body.companyAssessments[1]?.signals.find((item) => item.axis === "growth-scope"),
    ).toEqual({
      axis: "growth-scope",
      level: "medium",
      evidenceIds: ["fixture-evidence"],
    });
    expect(body.companyAssessments[1]?.evidence[0]?.url).toBe("https://example.com/company");
    expect(JSON.stringify(body.companyAssessments)).not.toContain('"assessment"');
  });

  it("추천 실행을 만들면 201 과 순위와 집계를 준다", async () => {
    await replayGivenWithLiveIds("ok-11-post-recommendation-run");
    const reply = await sendLegacyRecommendation("ok-11-post-recommendation-run");
    expectLegacyRecommendation("ok-11-post-recommendation-run", reply);
    await harness.expectMatchesLegacyDatabase("ok-11-post-recommendation-run");
    expect((reply.json as RecommendationResponse).schemaVersion, "추천 응답의 schemaVersion").toBe(
      1,
    );
  });

  it("분석 대상이 없으면 재사용 수와 분석 대기 수와 수집 진단을 담는다", async () => {
    await replayGivenWithLiveIds("err-19-recommendation-without-new-analysis");
    const reply = await sendLegacyRecommendation("err-19-recommendation-without-new-analysis");
    expectLegacyRecommendation("err-19-recommendation-without-new-analysis", reply);
    await harness.expectMatchesLegacyDatabase("err-19-recommendation-without-new-analysis");
  });

  /**
   * 사람 override 가 걸린 회사는 모델 평가가 있어도 manual 로 해결한다.
   * 그때 항목은 tier 출처 일곱 필드 가운데 `companyTierSource` 와 빈 근거 목록만 가진다.
   */
  it("사람 override 와 모델 평가를 모두 가진 회사는 manual 로 해결된다", async () => {
    await replayGivenWithLiveIds("err-20-tier-resolution-prefers-manual");
    const reply = await sendLegacyRecommendation("err-20-tier-resolution-prefers-manual");
    expectLegacyRecommendation("err-20-tier-resolution-prefers-manual", reply);
    await harness.expectMatchesLegacyDatabase("err-20-tier-resolution-prefers-manual");

    const ranking = (reply.json as RecommendationResponse).ranking;
    const byCompany = new Map(ranking.map((entry) => [entry.company, entry]));
    const model = byCompany.get("회사 2")!;
    expect(
      Object.keys(model)
        .filter((key) => key.startsWith("companyTier"))
        .sort(),
    ).toEqual([
      "companyTier",
      "companyTierAssessedAt",
      "companyTierAssessmentId",
      "companyTierConfidence",
      "companyTierEvidenceUrls",
      "companyTierReason",
      "companyTierSource",
      "companyTierValidUntil",
    ]);
    const manual = byCompany.get("회사 1")!;
    expect(manual.companyTierSource, "사람 override 의 출처").toBe("manual");
    expect(manual.companyTierAssessmentId, "사람 override 의 평가 ID").toBeUndefined();
    expect(manual.companyTierEvidenceUrls, "사람 override 의 근거 목록").toEqual([]);
  });

  /**
   * 분석 슬롯보다 공고가 많으면 남은 공고는 순위가 아니라 분석 대기로 들어간다.
   * 대기 항목도 회사 tier 와 그 출처를 그대로 가진다.
   */
  it("분석이 붙지 않은 공고는 대기 목록에 상태와 tier 출처를 담아 들어간다", async () => {
    await configure({ dailyAnalysisLimit: 1, prioritySlots: 1, agingSlots: 0 });
    const queue = await collect("collection-1", [
      { company: "회사 1", key: "p-1" },
      { company: "회사 2", key: "p-2" },
    ]);
    await assess("collection-1", queue, { "회사 1": 1, "회사 2": 3 });
    const analysis = await openQueue("collection-1");
    expect(analysis.candidates, "분석 대기열의 공고 수").toHaveLength(1);
    await submitResults(
      analysis.analysisRunId,
      "collection-1",
      analysis.candidates.map((candidate) => candidate.positionId),
    );

    const reply = await createRecommendation(analysis.analysisRunId);
    expect(reply.status).toBe(201);
    const body = reply.json as RecommendationResponse;
    expect(
      body.ranking.map((entry) => entry.company),
      "순위에 오른 회사",
    ).toEqual(["회사 1"]);
    expect(body.pendingCandidates, "분석 대기 목록").toHaveLength(1);
    expect(body.pendingCandidates[0]).toMatchObject({
      company: "회사 2",
      companyTier: 3,
      companyTierSource: "model",
      analysisStatus: "new",
    });
    expect(body.analysisSummary).toMatchObject({
      activeCount: 2,
      analyzedNowCount: 1,
      reusedCount: 0,
      pendingCount: 1,
    });
  });

  it("본문에 analysisRunId 가 없으면 400 BAD_REQUEST 다", async () => {
    const reply = await send("POST", "/api/positions/v1/recommendation-runs", {
      idempotencyKey: "no-analysis-run-id",
      body: { schemaVersion: 1 },
    });
    expect(reply.status).toBe(400);
    expect(reply.json).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "analysisRunId가 필요합니다.",
        requestId: reply.requestId,
      },
    });
  });

  it("analysisRunId 가 문자열이 아니면 400 BAD_REQUEST 다", async () => {
    const reply = await send("POST", "/api/positions/v1/recommendation-runs", {
      idempotencyKey: "numeric-analysis-run-id",
      body: { schemaVersion: 1, analysisRunId: 7 },
    });
    expect(reply.status).toBe(400);
    expect((reply.json as { error: { code: string } }).error.code).toBe("BAD_REQUEST");
  });
});

describe("실행 조회", () => {
  it("분석 실행 ID 로 조회하면 분석 대기열 응답을 준다", async () => {
    await replayGivenWithLiveIds("ok-12-get-run");
    harness.expectMatchesLegacy("ok-12-get-run", await harness.sendLegacyRequest("ok-12-get-run"));
  });

  it("수집 실행 ID 로 조회해도 그 수집의 분석 대기열 응답을 준다", async () => {
    await replayGivenWithLiveIds("ok-12-get-run");
    const reply = await send("GET", "/api/positions/v1/runs/collection-run-a");
    expect(reply.status).toBe(200);
    const body = reply.json as AnalysisQueueResponse;
    expect(body.schemaVersion, "분석 대기열 응답의 schemaVersion").toBe(2);
    expect(body.collectionRunId).toBe("collection-run-a");
    expect(body.candidates, "대기열에 담긴 공고 수").toHaveLength(2);
  });

  it("추천 실행 ID 로 조회하면 만들 때와 같은 추천 응답을 준다", async () => {
    await replayGivenWithLiveIds("ok-11-post-recommendation-run");
    const created = await sendLegacyRecommendation("ok-11-post-recommendation-run");
    expect(created.status).toBe(201);
    const recommendation = created.json as RecommendationResponse;

    const reply = await send("GET", `/api/positions/v1/runs/${recommendation.recommendationRunId}`);
    expect(reply.status).toBe(200);
    expect(reply.json, "다시 읽은 추천 응답").toEqual(recommendation);
    expect(await recommendationRunCount(), "저장된 추천 실행 수").toBe(1);
  });

  it("아직 만들지 않은 추천 실행 ID 로 조회하면 그 자리에서 만든다", async () => {
    await replayGivenWithLiveIds("ok-11-post-recommendation-run");
    const expected = legacyCase("ok-11-post-recommendation-run").response
      .body as RecommendationResponse;
    expect(await recommendationRunCount(), "조회 전 추천 실행 수").toBe(0);

    const reply = await send("GET", `/api/positions/v1/runs/${expected.recommendationRunId}`);
    expect(reply.status).toBe(200);
    expect(
      (reply.json as RecommendationResponse).recommendationRunId,
      "조회로 만들어진 추천 실행 ID",
    ).toBe(expected.recommendationRunId);
    expect(await recommendationRunCount(), "조회 뒤 추천 실행 수").toBe(1);
  });

  it("없는 실행 ID 는 404 NOT_FOUND 다", async () => {
    harness.expectMatchesLegacyError(
      "err-08-unknown-run-id",
      await harness.sendLegacyRequest("err-08-unknown-run-id"),
    );
  });
});

/**
 * 같은 분석 실행에 멱등 키가 다른 두 요청을 동시에 보낸다.
 *
 * 행 잠금이 없으면 둘 다 「추천이 아직 없다」 를 읽고 각자 같은 추천을 만들려 한다.
 * `position_recommendation_runs` 의 `analysis_run_id` 가 UNIQUE 라 뒤의 것이 500 으로 끝난다.
 */
describe("같은 분석 실행에 동시에 온 두 추천 요청", () => {
  it("추천 실행이 하나만 만들어지고 두 응답이 같다", async () => {
    await replayGivenWithLiveIds("ok-11-post-recommendation-run");
    const analysisRunId = (
      legacyCase("ok-11-post-recommendation-run").request.body as { analysisRunId: string }
    ).analysisRunId;

    const [first, second] = await Promise.all([
      createRecommendation(analysisRunId, "concurrent-a"),
      createRecommendation(analysisRunId, "concurrent-b"),
    ]);

    for (const reply of [first, second]) {
      expect(reply.status, "동시 요청의 status").toBe(201);
    }
    expect(second.json, "두 응답의 본문").toEqual(first.json);
    expect(await recommendationRunCount(), "저장된 추천 실행 수").toBe(1);
    expect(await recommendationItemCount(), "저장된 추천 순위 항목 수").toBe(2);
  });
});

describe("만들 때와 다시 읽을 때가 같다", () => {
  /**
   * 회사 식별자는 공백을 줄이고 소문자로 바꾼 값이다.
   * 표시 이름만 다른 두 공고는 같은 회사이므로 tier 출처 집계에서 한 번만 세어야 한다.
   * 만드는 경로와 다시 읽는 경로가 다른 키로 모으면 같은 추천 실행의 집계가 달라진다.
   */
  it("표시 이름만 다른 두 공고의 회사 tier 집계가 두 경로에서 같다", async () => {
    await configure();
    const queue = await collect("collection-1", [
      { company: "Acme Corp", key: "p-1" },
      { company: "acme  corp", key: "p-2" },
    ]);
    expect(
      queue.companies.map((company) => company.companyKey),
      "평가 대상 회사",
    ).toEqual(["acme corp"]);
    await assess("collection-1", queue, { "acme corp": 1 });
    const analysis = await openQueue("collection-1");
    await submitResults(
      analysis.analysisRunId,
      "collection-1",
      analysis.candidates.map((candidate) => candidate.positionId),
    );

    const created = await createRecommendation(analysis.analysisRunId);
    expect(created.status).toBe(201);
    const body = created.json as RecommendationResponse;
    expect(body.companyTierSummary, "만들 때의 회사 tier 집계").toEqual({
      manualCount: 0,
      modelCount: 1,
      defaultCount: 0,
      assessmentFailedCount: 0,
    });

    const reread = await send("GET", `/api/positions/v1/runs/${body.recommendationRunId}`);
    expect(reread.status).toBe(200);
    expect(
      (reread.json as RecommendationResponse).companyTierSummary,
      "다시 읽을 때의 회사 tier 집계",
    ).toEqual(body.companyTierSummary);
  });

  /**
   * 대기열 집계는 실행 행의 후보 문맥 버전으로 낸다.
   * 지금 정책의 값을 쓰면 정책을 바꾼 뒤 같은 실행을 조회할 때 집계가 달라진다.
   */
  it("정책을 바꾼 뒤에도 같은 분석 실행의 집계가 그대로다", async () => {
    await configure();
    const queue = await collect("collection-1", [
      { company: "회사 1", key: "p-1" },
      { company: "회사 2", key: "p-2" },
    ]);
    await assess("collection-1", queue, { "회사 1": 1, "회사 2": 2 });
    const analysis = await openQueue("collection-1");
    await submitResults(
      analysis.analysisRunId,
      "collection-1",
      analysis.candidates.map((candidate) => candidate.positionId),
    );

    const before = await send("GET", `/api/positions/v1/runs/${analysis.analysisRunId}`);
    expect(before.status).toBe(200);
    const summary = (before.json as AnalysisQueueResponse).summary;
    expect(summary.reusedCount, "분석을 마친 공고 수").toBe(2);

    await configure({ candidateContextVersion: "candidate-context-2026-12" }, "policy-changed");

    const after = await send("GET", `/api/positions/v1/runs/${analysis.analysisRunId}`);
    expect(after.status).toBe(200);
    expect((after.json as AnalysisQueueResponse).summary, "정책을 바꾼 뒤의 집계").toEqual(summary);
  });

  /**
   * 전환 전 구현은 실행 조회에서 정책을 읽지 않았다.
   * 정책을 읽으면 정책이 없는 상태의 조회가 `409 POLICY_NOT_CONFIGURED` 로 끝나 계약이 달라진다.
   */
  it("정책이 없어도 분석 실행을 조회할 수 있다", async () => {
    await configure();
    const queue = await collect("collection-1", [{ company: "회사 1", key: "p-1" }]);
    await assess("collection-1", queue, { "회사 1": 1 });
    const analysis = await openQueue("collection-1");
    await harness.prisma.$executeRawUnsafe("DELETE FROM position_analysis_policy");

    const reply = await send("GET", `/api/positions/v1/runs/${analysis.analysisRunId}`);
    expect(reply.status, "정책 없는 상태의 실행 조회 status").toBe(200);
    expect((reply.json as AnalysisQueueResponse).analysisRunId).toBe(analysis.analysisRunId);
  });
});
