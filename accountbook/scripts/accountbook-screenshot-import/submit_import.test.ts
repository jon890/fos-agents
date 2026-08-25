import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approveImport } from "./approve_import.ts";
import type { ExtractedImport } from "./contracts.ts";
import { submitImport, type SubmitConfig } from "./submit_import.ts";
import { validateImport } from "./validate_candidates.ts";
import { evaluateWeeklySafePolicy } from "../accountbook-weekly-import/evaluate_policy.ts";

const tempDirs: string[] = [];
const CONFIG: SubmitConfig = {
  apiBaseUrl: "https://accountbook.test/api/v1",
  familyUuid: "family-uuid",
  refreshToken: "seed-refresh-token",
  defaultCategoryName: "미분류",
  excludeFromBudget: false,
};

afterEach(() => {
  for (const path of tempDirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

function stateDir(): string {
  const path = mkdtempSync(join(tmpdir(), "accountbook-submit-test-"));
  tempDirs.push(path);
  return path;
}

function extractedFixture(): ExtractedImport {
  return {
    schemaVersion: 1 as const,
    source: "toss-consumption-screenshot" as const,
    sourceImage: {
      fileName: "sample.png",
      sha256: "b".repeat(64),
      capturedAt: "2026-08-20T10:17:53+09:00",
      width: 1179,
      height: 2556,
    },
    extraction: {
      engine: "agent-vision",
      runtime: "test",
      extractedAt: "2026-08-20T10:20:00+09:00",
    },
    reviewStatus: "pending" as const,
    days: [
      {
        date: "2026-08-19",
        dateSource: "user-confirmed" as const,
        dateEvidence: null,
        completeness: "complete" as const,
        selectedForImport: true,
        expectedTotals: { expense: 12000, income: 500 },
        transactions: [
          {
            rowIndex: 1,
            type: "expense" as const,
            amount: 12000,
            description: "예시 상점",
            paymentMethod: "예시 카드",
            categoryName: null,
            confidence: { amount: "high" as const, description: "high" as const, date: "high" as const },
            evidence: { amountText: "-12,000원", detailText: "예시 상점 | 예시 카드" },
          },
          {
            rowIndex: 2,
            type: "income" as const,
            amount: 500,
            description: "예시 이자",
            paymentMethod: null,
            categoryName: null,
            confidence: { amount: "high" as const, description: "high" as const, date: "high" as const },
            evidence: { amountText: "500원", detailText: "예시 이자" },
          },
        ],
      },
    ],
  };
}

function approvedFixture() {
  const validated = validateImport(extractedFixture(), {
    now: () => new Date("2026-08-20T01:30:00Z"),
  });
  return approveImport(validated, validated.batchId, {
    now: () => new Date("2026-08-20T01:31:00Z"),
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function commonResponse(url: string, init?: RequestInit): Response | null {
  const method = init?.method ?? "GET";
  if (url.endsWith("/auth/refresh") && method === "POST") {
    return jsonResponse({
      data: {
        accessToken: "access-token",
        refreshToken: "rotated-refresh-token",
        expiredAt: "2026-08-20T02:00:00",
      },
    });
  }
  if (url.endsWith("/families/family-uuid/categories") && method === "GET") {
    return jsonResponse({ data: [{ uuid: "category-uuid", name: "미분류" }] });
  }
  return null;
}

describe("submitImport", () => {
  test("미승인 후보는 API를 호출하기 전에 차단한다", async () => {
    const validated = validateImport(extractedFixture());
    let called = false;

    await expect(submitImport(validated, {
      stateDir: stateDir(),
      config: CONFIG,
      fetchImpl: async () => {
        called = true;
        return jsonResponse({});
      },
    })).rejects.toThrow("IMPORT_NOT_APPROVED");
    expect(called).toBe(false);
  });

  test("승인 출처와 정책 버전 조합이 틀리면 API를 호출하기 전에 차단한다", async () => {
    const batch = approvedFixture();
    const forged = {
      ...batch,
      approvalSource: "weekly-policy" as const,
      approvalPolicyVersion: null,
    };
    let fetchCount = 0;

    await expect(submitImport(forged, {
      stateDir: stateDir(),
      config: CONFIG,
      fetchImpl: async () => {
        fetchCount += 1;
        return jsonResponse({});
      },
    })).rejects.toThrow("INVALID_APPROVAL_SOURCE_POLICY_COMBINATION");
    expect(fetchCount).toBe(0);
  });

  test("weekly-policy.json을 submit에 직접 전달하면 API를 호출하기 전에 차단한다", async () => {
    const policy = evaluateWeeklySafePolicy(approvedFixture(), {
      schemaVersion: 1,
      source: "ios-shortcut",
      imageFile: "sample.png",
      capturedAt: "2026-08-20T10:17:53+09:00",
      receivedAt: "2026-08-20T10:18:53+09:00",
    }, new Date("2026-08-20T02:00:00Z"));
    let fetchCount = 0;

    await expect(submitImport(policy, {
      stateDir: stateDir(),
      config: CONFIG,
      fetchImpl: async () => {
        fetchCount += 1;
        return jsonResponse({});
      },
    })).rejects.toThrow();
    expect(fetchCount).toBe(0);
  });

  test("승인된 수입과 지출을 기존 API payload로 등록한다", async () => {
    const batch = approvedFixture();
    const requests: Array<{ url: string; method: string; body: unknown }> = [];
    let sequence = 0;
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const common = commonResponse(url, init);
      if (common) return common;
      const method = init?.method ?? "GET";
      requests.push({
        url,
        method,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      if (method === "GET") return jsonResponse({ data: { items: [] } });
      sequence += 1;
      return jsonResponse({ data: { uuid: `remote-${sequence}` } }, 201);
    };

    const privateState = stateDir();
    const summary = await submitImport(batch, {
      stateDir: privateState,
      config: CONFIG,
      fetchImpl,
      now: () => new Date("2026-08-20T01:32:00Z"),
    });

    expect(summary).toEqual({ batchId: batch.batchId, submitted: 2, recovered: 0, skipped: 0 });
    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[0].url).toEndWith("/families/family-uuid/expenses");
    expect(posts[0].body).toEqual({
      categoryUuid: "category-uuid",
      amount: 12000,
      description: "예시 상점 | 예시 카드",
      date: "2026-08-19T12:00:00",
      excludeFromBudget: false,
    });
    expect(posts[1].url).toEndWith("/families/family-uuid/incomes");
    expect(JSON.parse(readFileSync(join(privateState, "auth.json"), "utf8")).refreshToken)
      .toBe("rotated-refresh-token");
  });

  test("기존 동일 거래가 있으면 새 POST를 보내지 않고 검토 상태로 멈춘다", async () => {
    const batch = approvedFixture();
    let postCount = 0;
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const common = commonResponse(url, init);
      if (common) return common;
      const method = init?.method ?? "GET";
      if (method === "POST") {
        postCount += 1;
        return jsonResponse({ data: { uuid: "unexpected" } }, 201);
      }
      if (url.includes("/expenses?")) {
        return jsonResponse({
          data: {
            items: [{
              uuid: "existing-expense",
              amount: 12000,
              description: "예시 상점 | 예시 카드",
              date: "2026-08-19T12:00:00",
            }],
          },
        });
      }
      return jsonResponse({ data: { items: [] } });
    };

    await expect(submitImport(batch, {
      stateDir: stateDir(),
      config: CONFIG,
      fetchImpl,
    })).rejects.toThrow("EXISTING_TRANSACTION_REQUIRES_REVIEW");
    expect(postCount).toBe(0);
  });

  test("POST 결과가 불명확했던 후보는 재실행 조회로 복구한다", async () => {
    const extracted = extractedFixture();
    extracted.days[0].transactions = [extracted.days[0].transactions[0]];
    extracted.days[0].expectedTotals = { expense: 12000, income: 0 };
    const validated = validateImport(extracted);
    const batch = approveImport(validated, validated.batchId);
    const privateState = stateDir();

    let firstPost = true;
    const firstFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const common = commonResponse(url, init);
      if (common) return common;
      if ((init?.method ?? "GET") === "GET") return jsonResponse({ data: { items: [] } });
      if (firstPost) {
        firstPost = false;
        throw new Error("connection closed after request");
      }
      return jsonResponse({ data: { uuid: "unexpected" } }, 201);
    };

    await expect(submitImport(batch, {
      stateDir: privateState,
      config: CONFIG,
      fetchImpl: firstFetch,
    })).rejects.toThrow("connection closed after request");

    let retryPostCount = 0;
    const retryFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const common = commonResponse(url, init);
      if (common) return common;
      if ((init?.method ?? "GET") === "POST") {
        retryPostCount += 1;
        return jsonResponse({ data: { uuid: "unexpected" } }, 201);
      }
      return jsonResponse({
        data: {
          items: [{
            uuid: "recovered-expense",
            amount: 12000,
            description: "예시 상점 | 예시 카드",
            date: "2026-08-19T12:00:00",
          }],
        },
      });
    };

    const summary = await submitImport(batch, {
      stateDir: privateState,
      config: CONFIG,
      fetchImpl: retryFetch,
    });
    expect(summary.recovered).toBe(1);
    expect(retryPostCount).toBe(0);
  });

  test("POST 결과가 불명확했던 후보를 재조회로 찾지 못해도 다시 POST하지 않는다", async () => {
    const extracted = extractedFixture();
    extracted.days[0].transactions = [extracted.days[0].transactions[0]];
    extracted.days[0].expectedTotals = { expense: 12000, income: 0 };
    const validated = validateImport(extracted);
    const batch = approveImport(validated, validated.batchId);
    const privateState = stateDir();

    const firstFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const common = commonResponse(url, init);
      if (common) return common;
      if ((init?.method ?? "GET") === "GET") return jsonResponse({ data: { items: [] } });
      throw new Error("connection closed after request");
    };
    await expect(submitImport(batch, {
      stateDir: privateState,
      config: CONFIG,
      fetchImpl: firstFetch,
    })).rejects.toThrow("connection closed after request");

    let retryPostCount = 0;
    const retryFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const common = commonResponse(url, init);
      if (common) return common;
      if ((init?.method ?? "GET") === "POST") {
        retryPostCount += 1;
        return jsonResponse({ data: { uuid: "unexpected" } }, 201);
      }
      return jsonResponse({ data: { items: [] } });
    };

    await expect(submitImport(batch, {
      stateDir: privateState,
      config: CONFIG,
      fetchImpl: retryFetch,
    })).rejects.toThrow("EXISTING_TRANSACTION_REQUIRES_REVIEW");
    expect(retryPostCount).toBe(0);
  });
});
