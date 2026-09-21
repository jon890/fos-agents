import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { stableUuid } from "../src/positions/hash.js";
import { companyTierProvenanceFields } from "../src/positions/tier-provenance.js";
import { legacyCase } from "./support/legacy-contract.js";
import {
  maskVolatile,
  startE2eHarness,
  type E2eHarness,
  type Reply,
} from "./support/e2e-harness.js";

let harness: E2eHarness;

function send(
  method: string,
  path: string,
  options: { body?: unknown; idempotencyKey?: string } = {},
): Promise<Reply> {
  return harness.send(method, path, options);
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

describe("분석 정책과 회사 선호", () => {
  it("정책을 설정하면 저장한 정책을 그대로 돌려준다", async () => {
    harness.expectMatchesLegacy(
      "ok-04-put-analysis-policy",
      await harness.sendLegacyRequest("ok-04-put-analysis-policy"),
    );
    await harness.expectMatchesLegacyDatabase("ok-04-put-analysis-policy");
  });

  it("회사 선호를 설정하면 갱신 시각이 붙은 선호를 돌려준다", async () => {
    harness.expectMatchesLegacy(
      "ok-05-put-company-preference",
      await harness.sendLegacyRequest("ok-05-put-company-preference"),
    );
    await harness.expectMatchesLegacyDatabase("ok-05-put-company-preference");
  });

  it("회사 선호 목록은 회사 식별자 순으로 준다", async () => {
    await harness.replayGiven("ok-06-get-company-preferences");
    harness.expectMatchesLegacy(
      "ok-06-get-company-preferences",
      await harness.sendLegacyRequest("ok-06-get-company-preferences"),
    );
    await harness.expectMatchesLegacyDatabase("ok-06-get-company-preferences");
  });

  /**
   * 정책 schema 의 교차 검증이 거절하는 본문이다.
   * 슬롯 합계가 일일 상한과 달라 `prioritySlots` 자리에 오류가 붙는다.
   */
  it("본문 schema 를 위반하면 400 BAD_REQUEST 다", async () => {
    harness.expectMatchesLegacyError(
      "err-09-schema-violation",
      await harness.sendLegacyRequest("err-09-schema-violation"),
    );
    await harness.expectMatchesLegacyDatabase("err-09-schema-violation");
  });

  it("경로의 회사 식별자와 본문이 다르면 409 VERSION_CONFLICT 다", async () => {
    const reply = await send("PUT", "/api/positions/v1/company-preferences/other", {
      idempotencyKey: "mismatched-preference",
      body: { companyKey: "회사 1", companyName: "회사 1", tier: 1, disposition: "analyze" },
    });
    expect(reply.status).toBe(409);
    expect(reply.json).toEqual({
      error: {
        code: "VERSION_CONFLICT",
        message: "회사 식별자가 요청 경로와 다릅니다.",
        requestId: reply.requestId,
      },
    });
  });
});

describe("수집 실행 저장", () => {
  it("수집 실행을 저장하면 201 과 회사 tier 대기열을 준다", async () => {
    await harness.replayGiven("ok-07-post-collection-run");
    harness.expectMatchesLegacy(
      "ok-07-post-collection-run",
      await harness.sendLegacyRequest("ok-07-post-collection-run"),
    );
    await harness.expectMatchesLegacyDatabase("ok-07-post-collection-run");
  });

  it("정책을 설정하지 않은 수집 요청은 409 POLICY_NOT_CONFIGURED 다", async () => {
    harness.expectMatchesLegacyError(
      "err-10-policy-not-configured",
      await harness.sendLegacyRequest("err-10-policy-not-configured"),
    );
    await harness.expectMatchesLegacyDatabase("err-10-policy-not-configured");
  });

  /**
   * 포착 파일의 `given` 이 같은 멱등 키로 같은 본문을 이미 한 번 보냈다.
   * 본 요청은 그 재생이고, 저장된 응답이 그대로 와야 한다.
   */
  it("같은 멱등 키에 같은 본문을 다시 보내면 저장한 응답을 그대로 준다", async () => {
    await harness.replayGiven("err-01-idempotent-replay");
    harness.expectMatchesLegacy(
      "err-01-idempotent-replay",
      await harness.sendLegacyRequest("err-01-idempotent-replay"),
    );
    await harness.expectMatchesLegacyDatabase("err-01-idempotent-replay");
  });

  it("같은 수집 실행을 다른 멱등 키로 다시 저장하면 첫 응답과 같다", async () => {
    await harness.replayGiven("ok-07-post-collection-run");
    const request = harness.legacyRequest("ok-07-post-collection-run");
    const first = await send(request.method, request.path, {
      body: request.body,
      idempotencyKey: "collection-first",
    });
    const second = await send(request.method, request.path, {
      body: request.body,
      idempotencyKey: "collection-second",
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const volatilePaths = legacyCase("ok-07-post-collection-run").response.volatileResponsePaths;
    expect(maskVolatile(second.json, volatilePaths), "두 번째 응답").toEqual(
      maskVolatile(first.json, volatilePaths),
    );
    const runs = await harness.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) AS total FROM company_tier_assessment_runs
    `;
    expect(Number(runs[0]!.total), "회사 tier 실행 수").toBe(1);
  });

  it("exclude 인 회사는 tier 값을 해결하기 전에 제거된다", async () => {
    await harness.replayGiven("err-21-excluded-company-dropped");
    harness.expectMatchesLegacy(
      "err-21-excluded-company-dropped",
      await harness.sendLegacyRequest("err-21-excluded-company-dropped"),
    );
    await harness.expectMatchesLegacyDatabase("err-21-excluded-company-dropped");
  });

  it("회사 tier 대기열이 비면 실행이 만들어지는 즉시 completed 다", async () => {
    await harness.replayGiven("err-18-company-tier-queue-empty");
    harness.expectMatchesLegacy(
      "err-18-company-tier-queue-empty",
      await harness.sendLegacyRequest("err-18-company-tier-queue-empty"),
    );
    await harness.expectMatchesLegacyDatabase("err-18-company-tier-queue-empty");
  });
});

describe("회사 tier 결과 반영", () => {
  it("결과를 반영하면 200 과 completed 집계를 준다", async () => {
    await harness.replayGiven("ok-08-post-company-tier-results");
    harness.expectMatchesLegacy(
      "ok-08-post-company-tier-results",
      await harness.sendLegacyRequest("ok-08-post-company-tier-results"),
    );
    await harness.expectMatchesLegacyDatabase("ok-08-post-company-tier-results");
  });

  it("끝난 실행에 그 실행이 고르지 않은 회사를 보내면 409 VERSION_CONFLICT 다", async () => {
    await harness.replayGiven("err-13-tier-results-unknown-company");
    harness.expectMatchesLegacyError(
      "err-13-tier-results-unknown-company",
      await harness.sendLegacyRequest("err-13-tier-results-unknown-company"),
    );
    await harness.expectMatchesLegacyDatabase("err-13-tier-results-unknown-company");
  });

  it("처리 중 표시가 2시간을 넘으면 409 COMPANY_TIER_LEASE_EXPIRED 다", async () => {
    await harness.replayGiven("err-15a-company-tier-lease-expired");
    harness.expectMatchesLegacyError(
      "err-15a-company-tier-lease-expired",
      await harness.sendLegacyRequest("err-15a-company-tier-lease-expired"),
    );
    await harness.expectMatchesLegacyDatabase("err-15a-company-tier-lease-expired");
  });

  it("임차권이 끝난 회사는 lease_expired 로 회수되고 다음 수집이 다시 고른다", async () => {
    await harness.replayGiven("err-15b-company-tier-lease-reclaimed");
    await harness.sendLegacyRequest("err-15a-company-tier-lease-expired");
    harness.expectMatchesLegacy(
      "err-15b-company-tier-lease-reclaimed",
      await harness.sendLegacyRequest("err-15b-company-tier-lease-reclaimed"),
    );
    await harness.expectMatchesLegacyDatabase("err-15b-company-tier-lease-reclaimed");
  });

  it("실패로 보고한 회사는 평가 ID 없이 failed 로 남는다", async () => {
    await harness.replayGiven("ok-08-post-company-tier-results");
    const queue = await companyTierQueue();
    const reply = await send(
      "POST",
      `/api/positions/v1/company-tier-runs/${queue.companyTierRunId}/results`,
      {
        idempotencyKey: "tier-failures",
        body: {
          schemaVersion: 1,
          collectionRunId: queue.collectionRunId,
          results: [],
          failures: queue.companies.map((company) => ({
            companyKey: company.companyKey,
            failureCode: "research_unavailable",
          })),
        },
      },
    );
    expect(reply.status).toBe(200);
    expect(reply.json).toMatchObject({ status: "partial", failedCount: 2, applied: true });
    const rows = await harness.prisma.$queryRaw<
      { company_key: string; result_status: string; company_tier_assessment_id: string | null }[]
    >`
      SELECT company_key, result_status, company_tier_assessment_id
      FROM company_tier_assessment_run_items ORDER BY selection_order
    `;
    expect(rows.map((row) => row.result_status)).toEqual(["failed", "failed"]);
    expect(rows.map((row) => row.company_tier_assessment_id)).toEqual([null, null]);
  });

  /**
   * 사람 override 와 기본 tier 는 평가 ID 를 붙이지 않는다.
   * DB 의 `CHECK` 제약이 그것을 강제하므로 값을 만드는 함수가 먼저 지켜야 한다.
   */
  it("manual 과 default 출처에는 평가 ID 가 붙지 않는다", () => {
    for (const source of ["manual", "default"] as const) {
      const fields = companyTierProvenanceFields(source, {
        companyTierAssessmentId: "assessment-1",
        companyKey: "회사 1",
        companyName: "회사 1",
        candidateContextVersion: "context-1",
        contractVersion: 1,
        createdByCompanyTierRunId: null,
        recommendedTier: 1,
        confidence: "medium",
        reason: "이유",
        signals: {},
        evidence: [],
        assumptions: [],
        assessedAt: "2026-09-20T00:00:00.000Z",
        validUntil: "2026-12-19",
      });
      expect(fields.companyTierAssessmentId, `${source} 출처의 평가 ID`).toBeUndefined();
      expect(fields.companyTierEvidenceUrls).toEqual([]);
    }
  });
});

/**
 * 같은 실행에 멱등 키가 다른 두 요청을 동시에 보낸다.
 *
 * 행 잠금이 없으면 둘 다 대기 항목을 pending 으로 읽어 각자 평가를 만든다.
 * `company_tier_assessments` 가 회사마다 두 행이 되고 시도 횟수도 2가 된다.
 */
describe("같은 실행에 동시에 온 두 요청", () => {
  it("하나만 반영되고 뒤섞인 상태가 남지 않는다", async () => {
    await harness.replayGiven("ok-08-post-company-tier-results");
    const queue = await companyTierQueue();
    const request = harness.legacyRequest("ok-08-post-company-tier-results");
    const path = `/api/positions/v1/company-tier-runs/${queue.companyTierRunId}/results`;
    const [first, second] = await Promise.all([
      send("POST", path, { body: request.body, idempotencyKey: "concurrent-a" }),
      send("POST", path, { body: request.body, idempotencyKey: "concurrent-b" }),
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

    const assessments = await harness.prisma.$queryRaw<{ company_key: string }[]>`
      SELECT company_key FROM company_tier_assessments ORDER BY company_key
    `;
    expect(assessments.map((row) => row.company_key), "저장된 평가").toEqual(["회사 1", "회사 2"]);
    const items = await harness.prisma.$queryRaw<{ attempt_count: number; result_status: string }[]>`
      SELECT attempt_count, result_status FROM company_tier_assessment_run_items
      ORDER BY selection_order
    `;
    expect(items.map((row) => Number(row.attempt_count)), "시도 횟수").toEqual([1, 1]);
    expect(items.map((row) => row.result_status)).toEqual(["created", "created"]);
  });
});

/**
 * 모델 호출을 아끼는 동작이다.
 * 전환 전에는 `scripts/position-recommender/company_tier_analysis_pipeline.test.ts` 가
 * 메모리 저장소 위에서 확인했다. 여기서는 실제 DB 위에서 같은 것을 확인한다.
 */
describe("회사 tier 평가를 다시 부르지 않는다", () => {
  const collectedAt = "2026-09-17T00:00:00.000Z";

  function policy(dailyCompanyTierLimit: number) {
    return {
      schemaVersion: 2,
      candidateContextVersion: "candidate-context-2026-09",
      dailyAnalysisLimit: 5,
      prioritySlots: 3,
      agingSlots: 2,
      staleAfterDays: 30,
      defaultCompanyTier: 2,
      dailyCompanyTierLimit,
      companyTierStaleAfterDays: 90,
    };
  }

  function pool(runId: string, companies: string[]) {
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
        candidates: companies.map((company, index) => ({
          id: `wanted:${runId}-${index}`,
          source: "wanted",
          company,
          title: `Backend Engineer ${index}`,
          url: `https://example.com/jobs/${runId}-${index}`,
          identityHash: `wanted-${runId}-${index}`,
          linkType: "direct_posting",
          postingStatus: "active",
          activeEvidence: "모집 중 표기",
          openedAt: "",
          closesAt: "",
          daysUntilClose: "",
          closeUrgency: "normal",
          category: "개발",
          summary: `서버 개발 ${index}`,
          tags: [],
          skills: ["Java"],
          dueTime: "",
          mainTasks: `서버 개발 ${index}`,
          requirements: "Java",
          preferred: "",
        })),
        sourceDiagnostics: [
          {
            source: "wanted",
            status: "ok",
            collectedCount: companies.length,
            importedCount: companies.length,
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

  async function collect(runId: string, companies: string[], key: string) {
    const reply = await send("POST", "/api/positions/v1/collection-runs", {
      idempotencyKey: key,
      body: pool(runId, companies),
    });
    expect(reply.status, `${runId} 수집 status`).toBe(201);
    return (reply.json as { companyTierQueue: { companyTierRunId: string; companies: { companyKey: string }[] } })
      .companyTierQueue;
  }

  async function assess(runId: string, companyTierRunId: string, keys: string[], key: string) {
    const reply = await send(
      "POST",
      `/api/positions/v1/company-tier-runs/${companyTierRunId}/results`,
      {
        idempotencyKey: key,
        body: {
          schemaVersion: 1,
          collectionRunId: runId,
          results: keys.map((companyKey, index) => tierResult(companyKey, index + 1)),
          failures: [],
        },
      },
    );
    expect(reply.status, `${runId} 결과 반영 status`).toBe(200);
  }

  beforeEach(async () => {
    expect(
      (
        await send("PUT", "/api/positions/v1/analysis-policy", {
          idempotencyKey: "tier-policy",
          body: policy(1),
        })
      ).status,
    ).toBe(200);
  });

  it("첫 실행은 상한만큼만 평가한다", async () => {
    const queue = await collect("collection-1", ["회사 1", "회사 2", "회사 3"], "collect-1");
    expect(queue.companies.map((company) => company.companyKey)).toEqual(["회사 1"]);
  });

  it("둘째 실행은 전날 유효 평가를 다시 모델에 넘기지 않는다", async () => {
    const first = await collect("collection-1", ["회사 1", "회사 2"], "collect-1");
    await assess("collection-1", first.companyTierRunId, ["회사 1"], "assess-1");
    const second = await collect("collection-2", ["회사 1", "회사 2"], "collect-2");
    expect(second.companies.map((company) => company.companyKey)).toEqual(["회사 2"]);
  });

  it("모든 회사 평가가 유효하면 회사 모델 분석을 전혀 실행하지 않는다", async () => {
    await send("PUT", "/api/positions/v1/analysis-policy", {
      idempotencyKey: "tier-policy-wide",
      body: policy(5),
    });
    const first = await collect("collection-1", ["회사 1", "회사 2"], "collect-1");
    expect(first.companies).toHaveLength(2);
    await assess("collection-1", first.companyTierRunId, ["회사 1", "회사 2"], "assess-1");
    const second = await collect("collection-2", ["회사 1", "회사 2"], "collect-2");
    expect(second.companies).toEqual([]);
    expect(second.companyTierRunId).toBe(stableUuid("company-tier:collection-2"));
    const runs = await harness.prisma.$queryRaw<{ status: string }[]>`
      SELECT status FROM company_tier_assessment_runs ORDER BY collection_run_id
    `;
    expect(runs.map((row) => row.status)).toEqual(["completed", "completed"]);
  });
});

/** 앞선 수집이 만든 회사 tier 대기열을 읽는다. */
async function companyTierQueue(): Promise<{
  companyTierRunId: string;
  collectionRunId: string;
  companies: { companyKey: string }[];
}> {
  const rows = await harness.prisma.$queryRaw<{ company_tier_run_id: string; collection_run_id: string }[]>`
    SELECT company_tier_run_id, collection_run_id FROM company_tier_assessment_runs
  `;
  const run = rows[0]!;
  const items = await harness.prisma.$queryRaw<{ company_key: string }[]>`
    SELECT company_key FROM company_tier_assessment_run_items
    WHERE company_tier_run_id = ${run.company_tier_run_id} ORDER BY selection_order
  `;
  return {
    companyTierRunId: run.company_tier_run_id,
    collectionRunId: run.collection_run_id,
    companies: items.map((item) => ({ companyKey: item.company_key })),
  };
}
