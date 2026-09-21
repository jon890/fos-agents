import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AnalysisQueueResponse, AnalysisResultsRequest } from "../src/positions/schema.js";
import { legacyCase } from "./support/legacy-contract.js";
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
      { axis: "growth-scope" as const, level: "medium" as const },
      { axis: "compensation-upside" as const, level: "unknown" as const },
      { axis: "team-growth" as const, level: "unknown" as const },
    ],
    evidence: [{ url: "https://example.com/company", checkedAt: "2026-09-17" }],
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

type TierQueue = {
  companyTierRunId: string;
  companies: { companyKey: string }[];
};

/** 수집 실행을 저장하고 회사 tier 대기열을 돌려준다. */
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

/** 회사 tier 대기열에 결과를 반영한다. `tiers` 에 없는 회사는 실패로 보고한다. */
async function assess(
  runId: string,
  queue: TierQueue,
  tiers: Record<string, number>,
): Promise<void> {
  if (queue.companies.length === 0) return;
  const reply = await send(
    "POST",
    `/api/positions/v1/company-tier-runs/${queue.companyTierRunId}/results`,
    {
      idempotencyKey: `assess:${runId}`,
      body: {
        schemaVersion: 1,
        collectionRunId: runId,
        results: queue.companies
          .filter((company) => tiers[company.companyKey] !== undefined)
          .map((company) => tierResult(company.companyKey, tiers[company.companyKey]!)),
        failures: queue.companies
          .filter((company) => tiers[company.companyKey] === undefined)
          .map((company) => ({
            companyKey: company.companyKey,
            failureCode: "research_unavailable" as const,
          })),
      },
    },
  );
  expect(reply.status, `${runId} 회사 tier 반영 status`).toBe(200);
}

async function openAnalysisRun(runId: string, key = `analysis:${runId}`): Promise<Reply> {
  return send("POST", `/api/positions/v1/collection-runs/${runId}/analysis-runs`, {
    idempotencyKey: key,
    body: {},
  });
}

async function openQueue(runId: string, key?: string): Promise<AnalysisQueueResponse> {
  const reply = await openAnalysisRun(runId, key);
  expect(reply.status, `${runId} 분석 실행 생성 status`).toBe(201);
  return reply.json as AnalysisQueueResponse;
}

async function configure(overrides: Partial<AnalysisPolicyBody> = {}, key = "policy") {
  const reply = await send("PUT", "/api/positions/v1/analysis-policy", {
    idempotencyKey: key,
    body: policy(overrides),
  });
  expect(reply.status, "정책 설정 status").toBe(200);
}

async function prefer(
  companyKey: string,
  tier: number,
  disposition: "analyze" | "exclude",
  key: string,
) {
  const reply = await send(
    "PUT",
    `/api/positions/v1/company-preferences/${encodeURIComponent(companyKey)}`,
    {
      idempotencyKey: key,
      body: { companyKey, companyName: companyKey, tier, disposition },
    },
  );
  expect(reply.status, `${companyKey} 선호 설정 status`).toBe(200);
}

/** 저장된 분석 실행 항목을 선택 순서대로 읽는다. */
async function storedItems(): Promise<
  Array<{
    analysisRunId: string;
    positionId: string;
    companyKey: string;
    selectionOrder: number;
    selectionReason: string;
    companyTier: number;
    companyTierSource: string;
    companyTierAssessmentId: string | null;
    resultStatus: string;
    attemptCount: number;
  }>
> {
  const rows = await harness.prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT i.analysis_run_id, i.position_id, p.company_key, i.selection_order, i.selection_reason,
           i.company_tier, i.company_tier_source, i.company_tier_assessment_id,
           i.result_status, i.attempt_count
    FROM position_analysis_run_items i
    JOIN positions p ON p.position_id = i.position_id
    ORDER BY i.selection_order
  `;
  return rows.map((row) => ({
    analysisRunId: String(row.analysis_run_id),
    positionId: String(row.position_id),
    companyKey: String(row.company_key),
    selectionOrder: Number(row.selection_order),
    selectionReason: String(row.selection_reason),
    companyTier: Number(row.company_tier),
    companyTierSource: String(row.company_tier_source),
    companyTierAssessmentId:
      row.company_tier_assessment_id === null ? null : String(row.company_tier_assessment_id),
    resultStatus: String(row.result_status),
    attemptCount: Number(row.attempt_count),
  }));
}

async function analysisRunId(): Promise<string> {
  const rows = await harness.prisma.$queryRaw<{ analysis_run_id: string }[]>`
    SELECT analysis_run_id FROM position_analysis_runs
  `;
  return rows[0]!.analysis_run_id;
}

/**
 * ADR-119 의 정합성 조회다.
 *
 * `created` 인 항목이 가리키는 분석은 그 항목의 실행이 처음 만든 것이어야 한다.
 * 같은 사실을 항목과 분석 두 자리에 두므로 어긋날 수 있고, 이 조회가 그것을 잡는다.
 */
async function inconsistentCreatedOrigins(): Promise<number> {
  const rows = await harness.prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total
    FROM position_analysis_run_items i
    JOIN position_analyses a ON a.analysis_id = i.analysis_id
    WHERE i.result_status = 'created'
      AND (a.created_by_analysis_run_id IS NULL
           OR a.created_by_analysis_run_id <> i.analysis_run_id)
  `;
  return Number(rows[0]!.total);
}

function resultsBody(
  collectionRunId: string,
  results: ReturnType<typeof analysisResult>[],
  failures: Array<{ positionId: string; failureCode: string }> = [],
): AnalysisResultsRequest {
  return { schemaVersion: 2, collectionRunId, results, failures } as AnalysisResultsRequest;
}

async function submitResults(
  runId: string,
  body: unknown,
  key: string,
): Promise<Reply> {
  return send("POST", `/api/positions/v1/analysis-runs/${runId}/results`, {
    idempotencyKey: key,
    body,
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

describe("공고 분석 실행 생성", () => {
  it("분석 실행을 만들면 201 과 분석 대기열을 준다", async () => {
    await harness.replayGiven("ok-09-post-analysis-run");
    harness.expectMatchesLegacy(
      "ok-09-post-analysis-run",
      await harness.sendLegacyRequest("ok-09-post-analysis-run"),
    );
    await harness.expectMatchesLegacyDatabase("ok-09-post-analysis-run");
  });

  it("회사 tier 실행이 pending 이면 409 COMPANY_TIER_RUN_PENDING 이다", async () => {
    await harness.replayGiven("err-11-company-tier-run-pending");
    harness.expectMatchesLegacyError(
      "err-11-company-tier-run-pending",
      await harness.sendLegacyRequest("err-11-company-tier-run-pending"),
    );
    await harness.expectMatchesLegacyDatabase("err-11-company-tier-run-pending");
  });

  it("회사 tier 실행이 없으면 409 COMPANY_TIER_RUN_MISSING 이다", async () => {
    await harness.replayGiven("err-12-company-tier-run-missing");
    harness.expectMatchesLegacyError(
      "err-12-company-tier-run-missing",
      await harness.sendLegacyRequest("err-12-company-tier-run-missing"),
    );
    await harness.expectMatchesLegacyDatabase("err-12-company-tier-run-missing");
  });

  it("없는 수집 실행이면 404 NOT_FOUND 다", async () => {
    await configure();
    const reply = await openAnalysisRun("does-not-exist");
    expect(reply.status).toBe(404);
    expect(reply.json).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "수집 실행을 찾을 수 없습니다.",
        requestId: reply.requestId,
      },
    });
  });
});

describe("회사 tier 해결", () => {
  /**
   * 사람 override, 유효한 모델 평가, 정책 기본값 순으로 해결한다.
   * 회사 마 은 셋을 모두 가질 수 있는 자리에 있고 manual 로 해결돼야 한다.
   */
  it("manual, model, default 순으로 해결하고 그 출처를 항목에 남긴다", async () => {
    await configure();
    const first = await collect("collection-1", [
      { company: "회사 마", key: "m-1" },
      { company: "회사 오", key: "o-1" },
      { company: "회사 디", key: "d-1" },
    ]);
    expect(
      [...first.companies.map((company) => company.companyKey)].sort(),
      "첫 수집이 평가 대상으로 고른 회사",
    ).toEqual(["회사 디", "회사 마", "회사 오"]);
    await assess("collection-1", first, { "회사 마": 3, "회사 오": 3 });
    await prefer("회사 마", 1, "analyze", "prefer-m");

    const second = await collect("collection-2", [
      { company: "회사 마", key: "m-1" },
      { company: "회사 오", key: "o-1" },
      { company: "회사 디", key: "d-1" },
    ]);
    expect(
      second.companies.map((company) => company.companyKey),
      "두 번째 수집이 다시 고른 회사",
    ).toEqual(["회사 디"]);
    await assess("collection-2", second, {});

    await openQueue("collection-2");
    const items = await storedItems();
    const byCompany = new Map(items.map((item) => [item.companyKey, item]));
    expect(byCompany.get("회사 마"), "manual 로 해결한 회사").toMatchObject({
      companyTier: 1,
      companyTierSource: "manual",
      companyTierAssessmentId: null,
    });
    expect(byCompany.get("회사 오"), "model 로 해결한 회사").toMatchObject({
      companyTier: 3,
      companyTierSource: "model",
    });
    expect(byCompany.get("회사 오")!.companyTierAssessmentId, "model 출처의 평가 ID").not.toBeNull();
    expect(byCompany.get("회사 디"), "기본값으로 해결한 회사").toMatchObject({
      companyTier: 2,
      companyTierSource: "default",
      companyTierAssessmentId: null,
    });
  });

  it("exclude 인 회사의 공고는 tier 를 해결하기 전에 제거된다", async () => {
    await configure();
    await prefer("회사 엑스", 1, "exclude", "prefer-x");
    await prefer("회사 와이", 1, "analyze", "prefer-y");
    const queue = await collect("collection-1", [
      { company: "회사 엑스", key: "x-1" },
      { company: "회사 와이", key: "y-1" },
    ]);
    expect(queue.companies, "사람 override 가 걸린 회사는 평가하지 않는다").toEqual([]);

    const analysis = await openQueue("collection-1");
    expect(
      analysis.candidates.map((candidate) => candidate.posting.company),
      "분석 대기열의 회사",
    ).toEqual(["회사 와이"]);
    expect(analysis.summary.activeCount, "활성 공고 수").toBe(1);
  });
});

describe("분석 대기열 선택", () => {
  /**
   * 우선 슬롯은 회사 tier 가 앞선 공고를 고르고, 보장 슬롯은 가장 오래 기다린 공고를 고른다.
   * 후보가 슬롯 합보다 많으면 두 슬롯이 각자 자기 기준으로 자리를 나눠 쓴다.
   */
  it("우선 슬롯은 tier 순으로, 보장 슬롯은 대기 시작 시각 순으로 고른다", async () => {
    await configure({ dailyAnalysisLimit: 2, prioritySlots: 1, agingSlots: 1 });
    await prefer("회사 가", 2, "analyze", "prefer-a");
    await prefer("회사 나", 2, "analyze", "prefer-b");
    await prefer("회사 다", 1, "analyze", "prefer-c");

    await collect("collection-1", [{ company: "회사 가", key: "a-1" }], "2026-09-15T00:00:00.000Z");
    await collect(
      "collection-2",
      [
        { company: "회사 가", key: "a-1" },
        { company: "회사 나", key: "b-1" },
      ],
      "2026-09-16T00:00:00.000Z",
    );
    await collect(
      "collection-3",
      [
        { company: "회사 가", key: "a-1" },
        { company: "회사 나", key: "b-1" },
        { company: "회사 다", key: "c-1" },
      ],
      "2026-09-17T00:00:00.000Z",
    );

    const queue = await openQueue("collection-3");
    expect(
      queue.candidates.map((candidate) => candidate.posting.company),
      "선택한 공고의 회사",
    ).toEqual(["회사 다", "회사 가"]);
    expect(queue.summary, "대기열 집계").toMatchObject({
      activeCount: 3,
      queuedCount: 2,
      pendingCount: 3,
      newCount: 3,
      reusedCount: 0,
    });
    const items = await storedItems();
    expect(
      items.map((item) => item.selectionReason),
      "선택 사유",
    ).toEqual(["priority", "aging"]);
    expect(items.map((item) => item.companyKey)).toEqual(["회사 다", "회사 가"]);
  });

  /**
   * 전환 전에는 `scripts/position-recommender/` 가 메모리 저장소 위에서 확인했다.
   * 여기서는 실제 DB 에 분석 행을 넣고 같은 것을 확인한다.
   */
  it("fresh 분석은 다시 큐에 넣지 않고 재사용으로 센다", async () => {
    await configure();
    await prefer("회사 1", 1, "analyze", "prefer-1");
    await prefer("회사 2", 2, "analyze", "prefer-2");
    await collect("collection-1", [
      { company: "회사 1", key: "p-1" },
      { company: "회사 2", key: "p-2" },
    ]);
    const first = await openQueue("collection-1");
    expect(first.candidates).toHaveLength(2);
    const applied = await submitResults(
      first.analysisRunId,
      resultsBody(
        "collection-1",
        first.candidates.map((candidate, index) =>
          analysisResult(candidate.positionId, 80 - index * 10),
        ),
      ),
      "results-1",
    );
    expect(applied.status).toBe(200);

    await collect(
      "collection-2",
      [
        { company: "회사 1", key: "p-1" },
        { company: "회사 2", key: "p-2" },
      ],
      "2026-09-18T00:00:00.000Z",
    );
    const second = await openQueue("collection-2");
    expect(second.candidates, "두 번째 실행의 분석 큐").toEqual([]);
    expect(second.summary, "두 번째 실행의 집계").toMatchObject({
      activeCount: 2,
      reusedCount: 2,
      queuedCount: 0,
      pendingCount: 0,
      newCount: 0,
      changedCount: 0,
      staleCount: 0,
    });
  });
});

describe("분석 결과 반영", () => {
  /** 포착 파일이 담은 `positionId` 는 그 회차의 값이라 앞선 실행에서 다시 가져온다. */
  async function replayUntilAnalysisRun(id: string, count: number): Promise<string[]> {
    await harness.replayGiven(id, legacyCase(id).given.slice(0, count));
    return (await storedItems()).map((item) => item.positionId);
  }

  it("끝나지 않은 항목을 모두 보내면 200 과 completed 집계를 준다", async () => {
    const positionIds = await replayUntilAnalysisRun("ok-10-post-analysis-results", 4);
    const request = harness.legacyRequest("ok-10-post-analysis-results");
    const body = structuredClone(request.body) as { results: { positionId: string }[] };
    body.results[0]!.positionId = positionIds[0]!;
    body.results[1]!.positionId = positionIds[1]!;
    const reply = await submitResults(
      await analysisRunId(),
      body,
      request.headers.idempotencyKey!,
    );
    harness.expectMatchesLegacy("ok-10-post-analysis-results", reply);
    await harness.expectMatchesLegacyDatabase("ok-10-post-analysis-results");
    expect(await inconsistentCreatedOrigins(), "ADR-119 정합성 조회 결과 행 수").toBe(0);
  });

  it("끝나지 않은 항목 일부만 보내면 409 VERSION_CONFLICT 다", async () => {
    const positionIds = await replayUntilAnalysisRun(
      "err-14-analysis-results-partial-submission",
      4,
    );
    const request = harness.legacyRequest("err-14-analysis-results-partial-submission");
    const body = structuredClone(request.body) as { results: { positionId: string }[] };
    body.results[0]!.positionId = positionIds[0]!;
    const reply = await submitResults(
      await analysisRunId(),
      body,
      request.headers.idempotencyKey!,
    );
    harness.expectMatchesLegacyError("err-14-analysis-results-partial-submission", reply);
    await harness.expectMatchesLegacyDatabase("err-14-analysis-results-partial-submission");
  });

  it("실패 한 건을 함께 보내면 실행이 partial 로 남는다", async () => {
    const positionIds = await replayUntilAnalysisRun("err-16-analysis-run-partial", 4);
    const request = harness.legacyRequest("err-16-analysis-run-partial");
    const body = structuredClone(request.body) as {
      results: { positionId: string }[];
      failures: { positionId: string }[];
    };
    body.results[0]!.positionId = positionIds[0]!;
    body.failures[0]!.positionId = positionIds[1]!;
    const reply = await submitResults(
      await analysisRunId(),
      body,
      request.headers.idempotencyKey!,
    );
    harness.expectMatchesLegacy("err-16-analysis-run-partial", reply);
    await harness.expectMatchesLegacyDatabase("err-16-analysis-run-partial");
  });

  it("남은 항목만 다시 보내면 실행이 completed 가 된다", async () => {
    const positionIds = await replayUntilAnalysisRun(
      "err-17-analysis-run-completed-after-retry",
      4,
    );
    const runId = await analysisRunId();
    const partial = harness.legacyRequest("err-16-analysis-run-partial");
    const partialBody = structuredClone(partial.body) as {
      results: { positionId: string }[];
      failures: { positionId: string }[];
    };
    partialBody.results[0]!.positionId = positionIds[0]!;
    partialBody.failures[0]!.positionId = positionIds[1]!;
    expect((await submitResults(runId, partialBody, "given-analysis-partial")).status).toBe(200);

    const request = harness.legacyRequest("err-17-analysis-run-completed-after-retry");
    const body = structuredClone(request.body) as { results: { positionId: string }[] };
    body.results[0]!.positionId = positionIds[1]!;
    const reply = await submitResults(runId, body, request.headers.idempotencyKey!);
    harness.expectMatchesLegacy("err-17-analysis-run-completed-after-retry", reply);
    await harness.expectMatchesLegacyDatabase("err-17-analysis-run-completed-after-retry");
    expect(await inconsistentCreatedOrigins(), "ADR-119 정합성 조회 결과 행 수").toBe(0);
    expect(
      (await storedItems()).map((item) => item.attemptCount),
      "항목별 제출 처리 횟수",
    ).toEqual([1, 2]);
  });
});

/**
 * 같은 실행에 멱등 키가 다른 두 요청을 동시에 보낸다.
 *
 * 행 잠금이 없으면 둘 다 대기 항목을 pending 으로 읽어 각자 분석을 만들려 한다.
 * 항목의 제출 처리 횟수가 2가 되거나 같은 공고 version 에 분석을 두 번 넣어 실패한다.
 */
describe("같은 분석 실행에 동시에 온 두 요청", () => {
  it("하나만 반영되고 항목이 뒤섞이지 않는다", async () => {
    await configure();
    await prefer("회사 1", 1, "analyze", "prefer-1");
    await prefer("회사 2", 2, "analyze", "prefer-2");
    await collect("collection-1", [
      { company: "회사 1", key: "p-1" },
      { company: "회사 2", key: "p-2" },
    ]);
    const queue = await openQueue("collection-1");
    const body = resultsBody(
      "collection-1",
      queue.candidates.map((candidate, index) =>
        analysisResult(candidate.positionId, 80 - index * 10),
      ),
    );
    const path = `/api/positions/v1/analysis-runs/${queue.analysisRunId}/results`;
    const [first, second] = await Promise.all([
      send("POST", path, { body, idempotencyKey: "concurrent-a" }),
      send("POST", path, { body, idempotencyKey: "concurrent-b" }),
    ]);

    const replies = [first, second];
    expect(
      replies.filter((reply) => reply.status === 200 && (reply.json as { applied: boolean }).applied)
        .length,
      "실제로 반영한 요청 수",
    ).toBe(1);
    for (const reply of replies) {
      expect([200, 409], "동시 요청의 status").toContain(reply.status);
      if (reply.status === 200) {
        expect(reply.json).toMatchObject({ status: "completed", createdCount: 2, failedCount: 0 });
      }
    }

    const items = await storedItems();
    expect(
      items.map((item) => item.attemptCount),
      "항목별 제출 처리 횟수",
    ).toEqual([1, 1]);
    expect(items.map((item) => item.resultStatus)).toEqual(["created", "created"]);
    const analyses = await harness.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) AS total FROM position_analyses
    `;
    expect(Number(analyses[0]!.total), "저장된 분석 수").toBe(2);
    expect(await inconsistentCreatedOrigins(), "ADR-119 정합성 조회 결과 행 수").toBe(0);
  });
});
