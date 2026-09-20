import { describe, expect, test } from "bun:test";
import { createApp } from "./app.ts";
import type { RecommendationApiConfig } from "./config.ts";
import { MemoryReceiptStore } from "./http/idempotency.ts";
import { MemoryPositionRepository } from "./position/memory-repository.ts";
import {
  analysisQueueResponseSchema,
  analysisResultsResponseSchema,
  positionPreparationResponseSchema,
} from "./position/schema.ts";
import { PositionService } from "./position/service.ts";

const config: RecommendationApiConfig = {
  databaseUrl: "mysql://unused",
  apiToken: "test-token-1234567890123456789012",
  host: "127.0.0.1",
  port: 4318,
  maxBodyBytes: 128,
};

function app() {
  return createApp({
    config,
    positionService: new PositionService(new MemoryPositionRepository()),
    receipts: new MemoryReceiptStore(),
  });
}

function candidatePool(runId: string) {
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
    candidates: [1, 2].map((index) => ({
      id: `wanted:candidate-${index}`,
      source: "wanted",
      company: "테스트 회사",
      title: `Backend Engineer ${index}`,
      url: `https://example.com/jobs/${index}`,
      identityHash: `wanted:${index}`,
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
    })),
    sourceDiagnostics: [
      {
        source: "wanted",
        status: "ok",
        collectedCount: 2,
        importedCount: 2,
        skippedCount: 0,
        failedCount: 0,
        discoveryModes: ["broad"],
        message: "ok",
      },
    ],
    filterSummary: { personalExcludedCount: 0 },
    errors: [],
  };
}

function companyTierResult(companyKey: string, recommendedTier = 1) {
  return {
    companyKey,
    recommendedTier,
    confidence: "medium",
    reason: "성장 범위를 공개 자료로 확인했다.",
    signals: [
      { axis: "growth-scope", level: "high" },
      { axis: "compensation-upside", level: "medium" },
      { axis: "team-growth", level: "unknown" },
    ],
    evidence: [{ url: "https://example.com/company", checkedAt: "2026-09-17" }],
    assumptions: ["공개 자료만 확인했다."],
  };
}

describe("recommendation-api HTTP 계약", () => {
  test("liveness, readiness와 인증 확인 경로를 분리한다", async () => {
    const handler = createApp({
      config,
      positionService: new PositionService(new MemoryPositionRepository()),
      receipts: new MemoryReceiptStore(),
      readiness: async () => false,
    });
    expect((await handler(new Request("http://local/health/live"))).status).toBe(200);
    expect((await handler(new Request("http://local/health/ready"))).status).toBe(503);
    const auth = await handler(
      new Request("http://local/api/v1/auth/check", {
        headers: { Authorization: `Bearer ${config.apiToken}` },
      }),
    );
    expect(auth.status).toBe(204);
    expect(auth.headers.get("Cache-Control")).toBe("no-store");
  });

  test("인증 누락은 no-store 401로 응답한다", async () => {
    const response = await app()(new Request("http://local/api/positions/v1/company-preferences"));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain(config.apiToken);
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
  });

  test("잘못된 JSON과 본문 상한은 400으로 응답한다", async () => {
    const headers = {
      Authorization: `Bearer ${config.apiToken}`,
      "Idempotency-Key": "request-1",
      "Content-Type": "application/json",
    };
    const invalid = await app()(
      new Request("http://local/api/positions/v1/collection-runs", {
        method: "POST",
        headers,
        body: "{",
      }),
    );
    expect(invalid.status).toBe(400);
    const tooLarge = await app()(
      new Request("http://local/api/positions/v1/collection-runs", {
        method: "POST",
        headers,
        body: JSON.stringify({ value: "x".repeat(200) }),
      }),
    );
    expect(tooLarge.status).toBe(400);
    expect(await tooLarge.text()).toContain("BODY_TOO_LARGE");
  });

  test("인증된 멱등 요청으로 초기 분석 정책을 설정한다", async () => {
    const handler = createApp({
      config: { ...config, maxBodyBytes: 2_048 },
      positionService: new PositionService(new MemoryPositionRepository()),
      receipts: new MemoryReceiptStore(),
    });
    const policy = {
      schemaVersion: 2,
      candidateContextVersion: "context-1",
      dailyAnalysisLimit: 20,
      prioritySlots: 16,
      agingSlots: 4,
      staleAfterDays: 30,
      defaultCompanyTier: 3,
      dailyCompanyTierLimit: 5,
      companyTierStaleAfterDays: 90,
    };
    const response = await handler(
      new Request("http://local/api/positions/v1/analysis-policy", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Idempotency-Key": "policy-context-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(policy),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(policy);
  });

  test("회사 정책을 멱등 갱신하고 인증된 목록으로 조회한다", async () => {
    const handler = createApp({
      config: { ...config, maxBodyBytes: 2_048 },
      positionService: new PositionService(new MemoryPositionRepository()),
      receipts: new MemoryReceiptStore(),
    });
    const preference = {
      companyKey: "acme labs",
      companyName: "Acme Labs",
      tier: 1,
      disposition: "exclude",
    };
    const request = () =>
      new Request("http://local/api/positions/v1/company-preferences/acme%20labs", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Idempotency-Key": "company-preference-acme",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preference),
      });
    const first = await handler(request());
    const second = await handler(request());
    expect(first.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());

    const list = await handler(
      new Request("http://local/api/positions/v1/company-preferences", {
        headers: { Authorization: `Bearer ${config.apiToken}` },
      }),
    );
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([
      expect.objectContaining({ companyKey: "acme labs", tier: 1, disposition: "exclude" }),
    ]);
  });

  test("분석 결과 반영은 실행 상태와 집계를 담은 응답 계약을 지킨다", async () => {
    const handler = createApp({
      config: { ...config, maxBodyBytes: 64_000 },
      positionService: new PositionService(new MemoryPositionRepository()),
      receipts: new MemoryReceiptStore(),
    });
    const post = (path: string, key: string, body: unknown, method = "POST") =>
      handler(
        new Request(`http://local${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            "Idempotency-Key": key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }),
      );

    await post(
      "/api/positions/v1/analysis-policy",
      "policy-context-1",
      {
        schemaVersion: 2,
        candidateContextVersion: "context-1",
        dailyAnalysisLimit: 20,
        prioritySlots: 16,
        agingSlots: 4,
        staleAfterDays: 30,
        defaultCompanyTier: 3,
        dailyCompanyTierLimit: 5,
        companyTierStaleAfterDays: 90,
      },
      "PUT",
    );
    const collection = await post("/api/positions/v1/collection-runs", "collection:run-http", {
      schemaVersion: 2,
      analysisContractVersion: 1,
      pool: candidatePool("run-http"),
    });
    expect(collection.status).toBe(201);
    const preparation = positionPreparationResponseSchema.parse(await collection.json());
    expect(preparation.companyTierQueue.companies.map((entry) => entry.companyKey)).toEqual([
      "테스트 회사",
    ]);

    const pendingAnalysisRun = await post(
      "/api/positions/v1/collection-runs/run-http/analysis-runs",
      "analysis-run:run-http:early",
      { schemaVersion: 1 },
    );
    expect(pendingAnalysisRun.status).toBe(409);
    expect(await pendingAnalysisRun.text()).toContain("COMPANY_TIER_RUN_PENDING");

    const tierResults = await post(
      `/api/positions/v1/company-tier-runs/${preparation.companyTierQueue.companyTierRunId}/results`,
      "company-tier-results:run-http:1",
      {
        schemaVersion: 1,
        collectionRunId: "run-http",
        results: [companyTierResult("테스트 회사", 1)],
      },
    );
    expect(tierResults.status).toBe(200);
    expect(await tierResults.json()).toMatchObject({
      status: "completed",
      createdCount: 1,
      applied: true,
    });

    const analysisRun = await post(
      "/api/positions/v1/collection-runs/run-http/analysis-runs",
      "analysis-run:run-http",
      { schemaVersion: 1 },
    );
    expect(analysisRun.status).toBe(201);
    const queue = analysisQueueResponseSchema.parse(await analysisRun.json());
    expect(queue.candidates).toHaveLength(2);
    expect(queue.candidates.every((candidate) => candidate.companyTier === 1)).toBe(true);

    const results = await post(
      `/api/positions/v1/analysis-runs/${queue.analysisRunId}/results`,
      "analysis-results:run-http:1",
      {
        schemaVersion: 2,
        collectionRunId: queue.collectionRunId,
        results: [
          {
            positionId: queue.candidates[0].positionId,
            decision: "recommend",
            fitScore: 80,
            scoreBreakdown: {
              roleFit: 35,
              scopeUpside: 20,
              companyOpportunity: 15,
              constraints: 10,
            },
            reason: "현재 경험을 확장할 수 있다.",
            details: [],
            nextActions: [],
          },
        ],
        failures: [
          {
            positionId: queue.candidates[1].positionId,
            failureCode: "posting_body_missing",
          },
        ],
      },
    );
    expect(results.status).toBe(200);
    expect(analysisResultsResponseSchema.parse(await results.json())).toEqual({
      analysisRunId: queue.analysisRunId,
      status: "partial",
      createdCount: 1,
      reusedCount: 0,
      failedCount: 1,
      remainingCount: 1,
      applied: true,
    });
  });

  test("신호 축 누락과 중복, HTTP 근거와 tier 범위 이탈을 400으로 거절한다", async () => {
    const handler = createApp({
      config: { ...config, maxBodyBytes: 64_000 },
      positionService: new PositionService(new MemoryPositionRepository()),
      receipts: new MemoryReceiptStore(),
    });
    const post = (path: string, key: string, body: unknown, method = "POST") =>
      handler(
        new Request(`http://local${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            "Idempotency-Key": key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }),
      );
    await post(
      "/api/positions/v1/analysis-policy",
      "policy-context-1",
      {
        schemaVersion: 2,
        candidateContextVersion: "context-1",
        dailyAnalysisLimit: 20,
        prioritySlots: 16,
        agingSlots: 4,
        staleAfterDays: 30,
        defaultCompanyTier: 3,
        dailyCompanyTierLimit: 5,
        companyTierStaleAfterDays: 90,
      },
      "PUT",
    );
    const collection = await post("/api/positions/v1/collection-runs", "collection:run-reject", {
      schemaVersion: 2,
      analysisContractVersion: 1,
      pool: candidatePool("run-reject"),
    });
    const preparation = positionPreparationResponseSchema.parse(await collection.json());
    const path = `/api/positions/v1/company-tier-runs/${preparation.companyTierQueue.companyTierRunId}/results`;
    const submit = (key: string, result: Record<string, unknown>) =>
      post(path, key, {
        schemaVersion: 1,
        collectionRunId: "run-reject",
        results: [result],
      });

    const missingAxis = await submit("company-tier-results:missing-axis", {
      ...companyTierResult("테스트 회사"),
      signals: [
        { axis: "growth-scope", level: "high" },
        { axis: "compensation-upside", level: "medium" },
      ],
    });
    expect(missingAxis.status).toBe(400);

    const duplicateAxis = await submit("company-tier-results:duplicate-axis", {
      ...companyTierResult("테스트 회사"),
      signals: [
        { axis: "growth-scope", level: "high" },
        { axis: "growth-scope", level: "low" },
        { axis: "team-growth", level: "unknown" },
      ],
    });
    expect(duplicateAxis.status).toBe(400);
    expect(await duplicateAxis.text()).toContain("signals");

    const insecureEvidence = await submit("company-tier-results:insecure-evidence", {
      ...companyTierResult("테스트 회사"),
      evidence: [{ url: "http://example.com/company", checkedAt: "2026-09-17" }],
    });
    expect(insecureEvidence.status).toBe(400);

    const outOfRangeTier = await submit("company-tier-results:tier-range", {
      ...companyTierResult("테스트 회사", 4),
    });
    expect(outOfRangeTier.status).toBe(400);

    const stillPending = await post(
      "/api/positions/v1/collection-runs/run-reject/analysis-runs",
      "analysis-run:run-reject",
      { schemaVersion: 1 },
    );
    expect(stillPending.status).toBe(409);
  });
});
