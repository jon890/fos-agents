import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * 이 전환의 합격 기준은 표면이 같은 것이다.
 *
 * endpoint 열두 개의 성공 응답을 실제로 받아 확인한다.
 * 아홉 개는 `scripts/position-recommender/recommendation-api/client.ts` 가 import 하는 schema 로
 * 그대로 검증한다. client 가 응답을 이 schema 로 parse 하므로, 통과하면 client 가 읽을 수 있다.
 * 나머지 셋은 client 가 부르지 않아 대응하는 schema 가 없고 응답 형태를 여기 직접 적는다.
 *
 * pipeline 검사는 client 를 stub 으로 바꿔 client 와 서비스 사이의 계약을 확인하지 않는다.
 * 그 구멍을 이 파일이 막는다.
 */
import {
  analysisPolicySchema,
  analysisQueueResponseSchema,
  analysisResultsResponseSchema,
  companyPreferenceSchema,
  companyTierResultsResponseSchema,
  positionPreparationResponseSchema,
  recommendationResponseSchema,
} from "../src/positions/schema.js";
import { legacyCaseIds } from "./support/legacy-contract.js";
import { startE2eHarness, type E2eHarness, type Reply } from "./support/e2e-harness.js";

let harness: E2eHarness;

function send(method: string, path: string, options?: { body?: unknown; idempotencyKey?: string }) {
  return harness.send(method, path, options);
}

/** `client.ts` 가 오류를 읽는 경로. code 하나로 분기하므로 그 자리가 바뀌면 안 된다. */
const clientErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

const POSTINGS = [
  { company: "회사 1", key: "p-1" },
  { company: "회사 2", key: "p-2" },
];

function pool(runId: string) {
  return {
    schemaVersion: 2,
    analysisContractVersion: 1,
    companyTierContractVersion: 1,
    pool: {
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
      candidates: POSTINGS.map((posting) => ({
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
          collectedCount: POSTINGS.length,
          importedCount: POSTINGS.length,
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

beforeAll(async () => {
  harness = await startE2eHarness();
});

afterAll(async () => {
  await harness?.close();
});

beforeEach(async () => {
  await harness.clearAll();
});

describe("대응하는 schema 가 없는 endpoint 셋", () => {
  it("GET /health/live 는 200 과 {ok:true} 를 준다", async () => {
    const reply = await send("GET", "/health/live");
    expect(reply.status).toBe(200);
    expect(reply.json).toEqual({ ok: true });
  });

  it("GET /health/ready 는 200 과 {ok:true} 를 준다", async () => {
    const reply = await send("GET", "/health/ready");
    expect(reply.status).toBe(200);
    expect(reply.json).toEqual({ ok: true });
  });

  it("GET /api/v1/auth/check 는 204 와 빈 본문을 준다", async () => {
    const reply = await send("GET", "/api/v1/auth/check");
    expect(reply.status).toBe(204);
    expect(reply.json).toBeNull();
  });
});

describe("client 가 쓰는 schema 로 검증하는 endpoint 아홉", () => {
  /** 검증한 endpoint 를 모아 아홉 개를 하나도 빠뜨리지 않았음을 마지막에 확인한다. */
  const checked: string[] = [];

  function check<T>(endpoint: string, schema: z.ZodType<T>, reply: Reply, status: number): T {
    expect(reply.status, `${endpoint} 의 status`).toBe(status);
    const parsed = schema.safeParse(reply.json);
    expect(
      parsed.success ? null : JSON.stringify(parsed.error.issues),
      `${endpoint} 응답이 client 의 schema 를 만족하는지`,
    ).toBeNull();
    checked.push(endpoint);
    return (parsed as { data: T }).data;
  }

  it("수집부터 추천까지의 성공 응답이 모두 client 의 schema 를 만족한다", async () => {
    check(
      "PUT /api/positions/v1/analysis-policy",
      analysisPolicySchema,
      await send("PUT", "/api/positions/v1/analysis-policy", {
        idempotencyKey: "contract-policy",
        body: {
          schemaVersion: 2,
          candidateContextVersion: "candidate-context-2026-09",
          dailyAnalysisLimit: 5,
          prioritySlots: 3,
          agingSlots: 2,
          staleAfterDays: 30,
          defaultCompanyTier: 2,
          dailyCompanyTierLimit: 5,
          companyTierStaleAfterDays: 90,
        },
      }),
      200,
    );

    check(
      "PUT /api/positions/v1/company-preferences/{companyKey}",
      companyPreferenceSchema,
      await send("PUT", `/api/positions/v1/company-preferences/${encodeURIComponent("회사 3")}`, {
        idempotencyKey: "contract-preference",
        body: { companyKey: "회사 3", companyName: "회사 3", tier: 1, disposition: "analyze" },
      }),
      200,
    );

    check(
      "GET /api/positions/v1/company-preferences",
      z.array(companyPreferenceSchema),
      await send("GET", "/api/positions/v1/company-preferences"),
      200,
    );

    const prepared = check(
      "POST /api/positions/v1/collection-runs",
      positionPreparationResponseSchema,
      await send("POST", "/api/positions/v1/collection-runs", {
        idempotencyKey: "contract-collection",
        body: pool("collection-1"),
      }),
      201,
    );

    check(
      "POST /api/positions/v1/company-tier-runs/{id}/results",
      companyTierResultsResponseSchema,
      await send(
        "POST",
        `/api/positions/v1/company-tier-runs/${prepared.companyTierQueue.companyTierRunId}/results`,
        {
          idempotencyKey: "contract-tier-results",
          body: {
            schemaVersion: 1,
            collectionRunId: "collection-1",
            results: prepared.companyTierQueue.companies.map((company) => ({
              companyKey: company.companyKey,
              recommendedTier: 1,
              confidence: "medium" as const,
              reason: "공개 자료로 성장 범위를 확인했다.",
              signals: [
                { axis: "growth-scope", level: "medium", evidenceIds: ["fixture-evidence"] },
                { axis: "compensation-upside", level: "unknown" },
                { axis: "team-growth", level: "unknown" },
              ],
              evidence: [
                {
                  id: "fixture-evidence",
                  url: "https://example.com/company",
                  checkedAt: "2026-09-17",
                },
              ],
              assumptions: [],
            })),
            failures: [],
          },
        },
      ),
      200,
    );

    const queue = check(
      "POST /api/positions/v1/collection-runs/{id}/analysis-runs",
      analysisQueueResponseSchema,
      await send("POST", "/api/positions/v1/collection-runs/collection-1/analysis-runs", {
        idempotencyKey: "contract-analysis-run",
        body: { schemaVersion: 1 },
      }),
      201,
    );

    check(
      "POST /api/positions/v1/analysis-runs/{id}/results",
      analysisResultsResponseSchema,
      await send(`POST`, `/api/positions/v1/analysis-runs/${queue.analysisRunId}/results`, {
        idempotencyKey: "contract-analysis-results",
        body: {
          schemaVersion: 2,
          collectionRunId: "collection-1",
          results: queue.candidates.map((candidate, index) => ({
            positionId: candidate.positionId,
            decision: "recommend" as const,
            fitScore: 80 - index * 10,
            scoreBreakdown: {
              roleFit: 35 - index * 10,
              scopeUpside: 20,
              companyOpportunity: 15,
              constraints: 10,
            },
            reason: "현재 경험을 넓힐 수 있다.",
            details: [],
            nextActions: [],
          })),
          failures: [],
        },
      }),
      200,
    );

    const recommendation = check(
      "POST /api/positions/v1/recommendation-runs",
      recommendationResponseSchema,
      await send("POST", "/api/positions/v1/recommendation-runs", {
        idempotencyKey: "contract-recommendation",
        body: { schemaVersion: 1, analysisRunId: queue.analysisRunId },
      }),
      201,
    );

    // 같은 경로가 분석 실행과 추천 실행을 함께 받는다. 둘 다 client 의 schema 를 만족해야 한다.
    check(
      "GET /api/positions/v1/runs/{id}",
      analysisQueueResponseSchema,
      await send("GET", `/api/positions/v1/runs/${queue.analysisRunId}`),
      200,
    );
    check(
      "GET /api/positions/v1/runs/{id}",
      recommendationResponseSchema,
      await send("GET", `/api/positions/v1/runs/${recommendation.recommendationRunId}`),
      200,
    );

    expect([...new Set(checked)].sort(), "검증한 endpoint 목록").toEqual([
      "GET /api/positions/v1/company-preferences",
      "GET /api/positions/v1/runs/{id}",
      "POST /api/positions/v1/analysis-runs/{id}/results",
      "POST /api/positions/v1/collection-runs",
      "POST /api/positions/v1/collection-runs/{id}/analysis-runs",
      "POST /api/positions/v1/company-tier-runs/{id}/results",
      "POST /api/positions/v1/recommendation-runs",
      "PUT /api/positions/v1/analysis-policy",
      "PUT /api/positions/v1/company-preferences/{companyKey}",
    ]);
  });
});

describe("client 가 오류를 읽는 경로", () => {
  it("오류 응답의 code 는 body.error.code 에 있다", async () => {
    const reply = await send("GET", "/api/positions/v1/runs/does-not-exist");
    expect(reply.status).toBe(404);
    const parsed = clientErrorSchema.safeParse(reply.json);
    expect(parsed.success, "오류 본문이 client 의 schema 를 만족하는지").toBe(true);
    expect(parsed.success && parsed.data.error.code, "client 가 읽는 오류 코드").toBe("NOT_FOUND");
  });
});

/**
 * 포착 파일의 case 가 하나도 놀지 않게 한다.
 *
 * endpoint 아홉은 위에서 집합으로 대조한다. case 34개에는 그 장치가 없어
 * 어느 case 를 검사에서 빼도 아무것도 실패하지 않았다.
 * 검사 소스에서 case ID 를 모아 포착 파일의 목록과 같은지 본다.
 */
describe("포착 파일의 case 가 모두 쓰인다", () => {
  it("검사 소스가 34개 case 를 하나도 빠뜨리지 않는다", () => {
    const directory = fileURLToPath(new URL(".", import.meta.url));
    const sources = readdirSync(directory)
      .filter((name) => name.endsWith(".test.ts"))
      .map((name) => readFileSync(join(directory, name), "utf8"))
      .join("\n");
    const used = new Set(legacyCaseIds.filter((id) => sources.includes(`"${id}"`)));
    expect(
      legacyCaseIds.filter((id) => !used.has(id)),
      "어느 검사도 대조하지 않는 case",
    ).toEqual([]);
  });
});
