import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtractedImport, ValidatedImport } from "../accountbook-screenshot-import/contracts.ts";
import { submitImport, type SubmitConfig } from "../accountbook-screenshot-import/submit_import.ts";
import { validateImport } from "../accountbook-screenshot-import/validate_candidates.ts";
import {
  ensureWeeklyPrivateLayout,
  loadWeeklyState,
  releaseWeeklyRunLock,
  scanAndClaimInbox,
  acquireWeeklyRunLock,
} from "./scan_inbox.ts";
import type { WeeklyWorkItem } from "./contracts.ts";
import { finalizeInboxItem, recordValidatedDates } from "./finalize_inbox.ts";
import {
  evaluateWeeklySafePolicy,
  writeWeeklyPolicyFiles,
} from "./evaluate_policy.ts";

const tempDirs: string[] = [];
const CONFIG: SubmitConfig = {
  apiBaseUrl: "https://accountbook.test/api/v1",
  familyUuid: "family-uuid",
  refreshToken: "seed-refresh-token",
  defaultCategoryName: "미분류",
  excludeFromBudget: false,
};

const pngBytes = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1,
  8, 6, 0, 0, 0, 31, 21, 196,
  137,
]);

afterEach(() => {
  for (const path of tempDirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

function privateRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "accountbook-weekly-pipeline-"));
  tempDirs.push(root);
  return join(root, "private");
}

function writeInboxPair(root: string, base: string, data = pngBytes): void {
  const { newDir } = ensureWeeklyPrivateLayout(root);
  const imageFile = `${base}.png`;
  writeFileSync(join(newDir, imageFile), data, { mode: 0o600 });
  writeFileSync(join(newDir, `${base}.json`), `${JSON.stringify({
    schemaVersion: 1,
    source: "ios-shortcut",
    imageFile,
    capturedAt: "2026-08-20T10:17:53+09:00",
    receivedAt: "2026-08-20T10:18:53+09:00",
  }, null, 2)}\n`, { mode: 0o600 });
}

function extracted(item: WeeklyWorkItem, overrides: Partial<ExtractedImport["days"][number]> = {}): ExtractedImport {
  const day = {
    date: "2026-08-19",
    dateSource: "upload-metadata" as const,
    dateEvidence: { screenMonth: 8, screenDay: 19, yearSource: "upload-metadata" as const },
    completeness: "complete" as const,
    selectedForImport: true,
    expectedTotals: { expense: 12000, income: 0 },
    transactions: [{
      rowIndex: 1,
      type: "expense" as const,
      amount: 12000,
      description: "예시 상점",
      paymentMethod: "예시 카드",
      categoryName: null,
      confidence: { amount: "high" as const, description: "high" as const, date: "medium" as const },
      evidence: { amountText: "-12,000원", detailText: "예시 상점 | 예시 카드" },
    }],
    ...overrides,
  };
  return {
    schemaVersion: 1,
    source: "toss-consumption-screenshot",
    sourceImage: {
      fileName: item.imageFile,
      sha256: item.imageSha256,
      capturedAt: item.manifest.capturedAt,
      width: 1179,
      height: 2556,
    },
    extraction: {
      engine: "agent-vision",
      runtime: "weekly-pipeline-test",
      extractedAt: "2026-08-20T10:20:00+09:00",
    },
    reviewStatus: "pending",
    days: [day],
  };
}

type FetchRecord = { url: string; method: string; body: unknown };

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

async function runWeeklyDryPipeline(options: {
  root: string;
  runId: string;
  fetchImpl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  overrides?: (item: WeeklyWorkItem) => Partial<ExtractedImport["days"][number]>;
}): Promise<void> {
  acquireWeeklyRunLock(options.root, options.runId);
  try {
    const items = scanAndClaimInbox({ privateRoot: options.root, runId: options.runId });
    const validatedByHash = new Map<string, ValidatedImport>();
    const datesByHash = new Map<string, string[]>();

    for (const item of items) {
      const candidate = validateImport(extracted(item, options.overrides?.(item) ?? {}), {
        now: () => new Date("2026-08-20T01:30:00Z"),
      });
      validatedByHash.set(item.imageSha256, candidate);
      const dates = candidate.days.filter((day) => day.selectedForImport).map((day) => day.date);
      datesByHash.set(item.imageSha256, dates);
      recordValidatedDates({ privateRoot: options.root, imageSha256: item.imageSha256, selectedDates: dates });
    }

    const duplicateDates = new Set(
      [...datesByHash.values()]
        .flat()
        .filter((date, _index, all) => all.indexOf(date) !== all.lastIndexOf(date)),
    );
    for (const item of items) {
      const hasDuplicate = (datesByHash.get(item.imageSha256) ?? []).some((date) => duplicateDates.has(date));
      if (hasDuplicate) {
        finalizeInboxItem({
          privateRoot: options.root,
          imageSha256: item.imageSha256,
          status: "needs_review",
          lastErrorCode: "WEEKLY_DATE_CONFLICT",
        });
      }
    }

    for (const item of items) {
      if ((datesByHash.get(item.imageSha256) ?? []).some((date) => duplicateDates.has(date))) continue;
      const batch = validatedByHash.get(item.imageSha256);
      if (!batch) throw new Error("VALIDATED_BATCH_MISSING");
      const runDir = join(options.root, "imports", batch.batchId);
      mkdirSync(runDir, { recursive: true, mode: 0o700 });
      const policyOutput = join(runDir, "weekly-policy.json");
      const approvedOutput = join(runDir, "approved.json");
      const decision = writeWeeklyPolicyFiles({
        validated: batch,
        manifest: item.manifest,
        policyOutput,
        approvedOutput,
        now: new Date("2026-08-20T02:00:00Z"),
      });
      if (!decision.eligible) {
        finalizeInboxItem({
          privateRoot: options.root,
          imageSha256: item.imageSha256,
          status: "needs_review",
          batchId: batch.batchId,
          lastErrorCode: "WEEKLY_POLICY_REJECTED",
        });
        continue;
      }
      try {
        await submitImport(JSON.parse(readFileSync(approvedOutput, "utf8")), {
          stateDir: join(options.root, "state"),
          config: CONFIG,
          fetchImpl: options.fetchImpl,
          now: () => new Date("2026-08-20T02:10:00Z"),
        });
        finalizeInboxItem({
          privateRoot: options.root,
          imageSha256: item.imageSha256,
          status: "submitted",
          batchId: batch.batchId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("connection closed after request")) continue;
        const isConfirmedApiFailure = /^ACCOUNTBOOK_API_4\d\d$/.test(message);
        finalizeInboxItem({
          privateRoot: options.root,
          imageSha256: item.imageSha256,
          status: isConfirmedApiFailure ? "failed" : "needs_review",
          batchId: batch.batchId,
          lastErrorCode: isConfirmedApiFailure
            ? "ACCOUNTBOOK_API_4XX"
            : message.startsWith("EXISTING_TRANSACTION_REQUIRES_REVIEW")
              ? "EXISTING_TRANSACTION_REQUIRES_REVIEW"
              : "SUBMIT_REQUIRES_REVIEW",
        });
      }
    }
  } finally {
    releaseWeeklyRunLock(options.root, options.runId);
  }
}

describe("weekly dry pipeline", () => {
  test("정상 승인 후보를 submit payload로 등록하고 submitted로 finalize한다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    const requests: FetchRecord[] = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const common = commonResponse(url, init);
      if (common) return common;
      const method = init?.method ?? "GET";
      requests.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (method === "GET") return jsonResponse({ data: { items: [] } });
      return jsonResponse({ data: { uuid: "remote-expense" } }, 201);
    };

    await runWeeklyDryPipeline({ root, runId: "run-1", fetchImpl });

    const state = loadWeeklyState(root);
    expect(Object.values(state.items)[0].status).toBe("submitted");
    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({
      categoryUuid: "category-uuid",
      amount: 12000,
      description: "예시 상점 | 예시 카드",
      date: "2026-08-19T12:00:00",
      excludeFromBudget: false,
    });
  });

  test("두 이미지의 선택 날짜가 충돌하면 둘 다 needs_review이고 POST는 0회다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "first", pngBytes);
    writeInboxPair(root, "second", Buffer.from([...pngBytes, 1]));
    let postCount = 0;

    await runWeeklyDryPipeline({
      root,
      runId: "run-1",
      fetchImpl: async (_input, init) => {
        if ((init?.method ?? "GET") === "POST") postCount += 1;
        return jsonResponse({ data: { items: [] } });
      },
    });

    expect(Object.values(loadWeeklyState(root).items).map((item) => item.status))
      .toEqual(["needs_review", "needs_review"]);
    expect(postCount).toBe(0);
  });

  test("description medium은 정책에서 needs_review가 되고 POST는 0회다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    let postCount = 0;

    await runWeeklyDryPipeline({
      root,
      runId: "run-1",
      fetchImpl: async (_input, init) => {
        if ((init?.method ?? "GET") === "POST") postCount += 1;
        return jsonResponse({ data: { items: [] } });
      },
      overrides: (item) => ({
        transactions: [{
          ...extracted(item).days[0].transactions[0],
          confidence: { amount: "high", description: "medium", date: "medium" },
        }],
      }),
    });

    const item = Object.values(loadWeeklyState(root).items)[0];
    expect(item.status).toBe("needs_review");
    expect(item.lastErrorCode).toBe("WEEKLY_POLICY_REJECTED");
    expect(postCount).toBe(0);
  });

  test("기존 동일 거래가 있으면 새 POST 없이 needs_review로 finalize한다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    let postCount = 0;

    await runWeeklyDryPipeline({
      root,
      runId: "run-1",
      fetchImpl: async (input, init) => {
        const url = String(input);
        const common = commonResponse(url, init);
        if (common) return common;
        if ((init?.method ?? "GET") === "POST") {
          postCount += 1;
          return jsonResponse({ data: { uuid: "unexpected" } }, 201);
        }
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
      },
    });

    const item = Object.values(loadWeeklyState(root).items)[0];
    expect(item.status).toBe("needs_review");
    expect(item.lastErrorCode).toBe("EXISTING_TRANSACTION_REQUIRES_REVIEW");
    expect(postCount).toBe(0);
  });

  test("명확한 ACCOUNTBOOK_API_400 실패는 failed로 finalize한다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    let postCount = 0;

    await runWeeklyDryPipeline({
      root,
      runId: "run-1",
      fetchImpl: async (input, init) => {
        const common = commonResponse(String(input), init);
        if (common) return common;
        if ((init?.method ?? "GET") === "GET") return jsonResponse({ data: { items: [] } });
        postCount += 1;
        return jsonResponse({ error: "bad request" }, 400);
      },
    });

    const item = Object.values(loadWeeklyState(root).items)[0];
    expect(item.status).toBe("failed");
    expect(item.lastErrorCode).toBe("ACCOUNTBOOK_API_4XX");
    expect(postCount).toBe(1);
  });

  test("불명확한 POST 뒤 재실행은 재POST 없이 needs_review로 끝낸다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    let firstPostCount = 0;
    await runWeeklyDryPipeline({
      root,
      runId: "run-1",
      fetchImpl: async (input, init) => {
        const common = commonResponse(String(input), init);
        if (common) return common;
        if ((init?.method ?? "GET") === "GET") return jsonResponse({ data: { items: [] } });
        firstPostCount += 1;
        throw new Error("connection closed after request");
      },
    });
    expect(Object.values(loadWeeklyState(root).items)[0].status).toBe("processing");

    let retryPostCount = 0;
    await runWeeklyDryPipeline({
      root,
      runId: "run-2",
      fetchImpl: async (input, init) => {
        const common = commonResponse(String(input), init);
        if (common) return common;
        if ((init?.method ?? "GET") === "POST") {
          retryPostCount += 1;
          return jsonResponse({ data: { uuid: "unexpected" } }, 201);
        }
        return jsonResponse({ data: { items: [] } });
      },
    });

    expect(firstPostCount).toBe(1);
    expect(retryPostCount).toBe(0);
    expect(Object.values(loadWeeklyState(root).items)[0].status).toBe("needs_review");
  });
});
