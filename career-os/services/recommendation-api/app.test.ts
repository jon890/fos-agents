import { describe, expect, test } from "bun:test";
import { createApp } from "./app.ts";
import type { RecommendationApiConfig } from "./config.ts";
import { MemoryReceiptStore } from "./http/idempotency.ts";
import { MemoryPositionRepository } from "./position/memory-repository.ts";
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
      schemaVersion: 1,
      candidateContextVersion: "context-1",
      dailyAnalysisLimit: 20,
      prioritySlots: 16,
      agingSlots: 4,
      staleAfterDays: 30,
      defaultCompanyTier: 3,
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
});
