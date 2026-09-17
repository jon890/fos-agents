import { describe, expect, test } from "bun:test";
import { RecommendationApiClient, RecommendationApiClientError } from "./client.ts";

const token = "token-123456789012345678901234567890";

describe("position recommendation API client", () => {
  test("같은 본문과 멱등 키로 5xx를 최대 두 번 재시도한다", async () => {
    const requests: RequestInit[] = [];
    const client = new RecommendationApiClient({
      baseUrl: "http://api.local",
      token,
      fetcher: async (_input, init) => {
        requests.push(init ?? {});
        if (requests.length < 3) {
          return Response.json(
            { error: { code: "DATABASE_UNAVAILABLE", message: "잠시 후 재시도" } },
            { status: 503 },
          );
        }
        return Response.json({
          schemaVersion: 1,
          collectionRunId: "run-1",
          analysisRunId: "analysis-1",
          generatedAt: "2026-09-17T00:00:00.000Z",
          candidates: [],
          summary: {
            activeCount: 0,
            reusedCount: 0,
            queuedCount: 0,
            pendingCount: 0,
            personalExcludedCount: 0,
            newCount: 0,
            changedCount: 0,
            staleCount: 0,
            warningSourceCount: 0,
          },
        });
      },
    });
    await client.saveCollection({ schemaVersion: 1 }, "collection:run-1");
    expect(requests).toHaveLength(3);
    expect(
      requests.every(
        (request) => new Headers(request.headers).get("Idempotency-Key") === "collection:run-1",
      ),
    ).toBe(true);
    expect(
      requests.every(
        (request) => new Headers(request.headers).get("Authorization") === `Bearer ${token}`,
      ),
    ).toBe(true);
  });

  test("4xx는 재시도하지 않는다", async () => {
    let calls = 0;
    const client = new RecommendationApiClient({
      baseUrl: "http://api.local",
      token,
      fetcher: async () => {
        calls += 1;
        return Response.json(
          { error: { code: "VERSION_CONFLICT", message: "충돌" } },
          { status: 409 },
        );
      },
    });
    await expect(client.saveCollection({}, "key")).rejects.toBeInstanceOf(
      RecommendationApiClientError,
    );
    expect(calls).toBe(1);
  });

  test("JSON이 아닌 4xx와 잘못된 2xx 계약도 재시도하지 않는다", async () => {
    let invalidErrorCalls = 0;
    const invalidError = new RecommendationApiClient({
      baseUrl: "http://localhost:4318",
      token: "x".repeat(32),
      fetcher: async () => {
        invalidErrorCalls += 1;
        return new Response("not-json", { status: 400 });
      },
    });
    await expect(invalidError.saveCollection({}, "key-400")).rejects.toMatchObject({
      status: 400,
      code: "INVALID_RESPONSE",
    });
    expect(invalidErrorCalls).toBe(1);

    let invalidSuccessCalls = 0;
    const invalidSuccess = new RecommendationApiClient({
      baseUrl: "http://localhost:4318",
      token: "x".repeat(32),
      fetcher: async () => {
        invalidSuccessCalls += 1;
        return Response.json({ unexpected: true });
      },
    });
    await expect(invalidSuccess.saveCollection({}, "key-200")).rejects.toMatchObject({
      status: 200,
      code: "INVALID_RESPONSE",
    });
    expect(invalidSuccessCalls).toBe(1);
  });

  test("분석 정책 설정은 인증된 PUT 요청을 사용한다", async () => {
    let capturedMethod = "";
    const policy = {
      schemaVersion: 1 as const,
      candidateContextVersion: "context-1",
      dailyAnalysisLimit: 20,
      prioritySlots: 16,
      agingSlots: 4,
      staleAfterDays: 30,
      defaultCompanyTier: 3,
    };
    const client = new RecommendationApiClient({
      baseUrl: "http://api.local",
      token,
      fetcher: async (_input, init) => {
        capturedMethod = init?.method ?? "";
        return Response.json(policy);
      },
    });
    await expect(client.configureAnalysisPolicy(policy, "policy-context-1")).resolves.toEqual(
      policy,
    );
    expect(capturedMethod).toBe("PUT");
  });

  test("회사 정책을 인증된 GET으로 조회하고 멱등 PUT으로 갱신한다", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const preference = {
      companyKey: "acme labs",
      companyName: "Acme Labs",
      tier: 1 as const,
      disposition: "analyze" as const,
      updatedAt: "2026-09-17T00:00:00.000Z",
    };
    const client = new RecommendationApiClient({
      baseUrl: "http://api.local",
      token,
      fetcher: async (input, init) => {
        requests.push({ url: String(input), init: init ?? {} });
        return Response.json(init?.method === "GET" ? [preference] : preference);
      },
    });

    await expect(client.listCompanyPreferences()).resolves.toEqual([preference]);
    await expect(
      client.updateCompanyPreference(
        preference.companyKey,
        {
          companyKey: preference.companyKey,
          companyName: preference.companyName,
          tier: preference.tier,
          disposition: preference.disposition,
        },
        "company-preference-1",
      ),
    ).resolves.toEqual(preference);

    expect(requests[0].init.method).toBe("GET");
    expect(new Headers(requests[0].init.headers).get("Idempotency-Key")).toBeNull();
    expect(requests[1].init.method).toBe("PUT");
    expect(requests[1].url).toEndWith("/api/positions/v1/company-preferences/acme%20labs");
    expect(new Headers(requests[1].init.headers).get("Idempotency-Key")).toBe(
      "company-preference-1",
    );
  });
});
