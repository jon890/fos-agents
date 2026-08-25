import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtractedImport } from "../accountbook-screenshot-import/contracts.ts";
import type { SubmitConfig } from "../accountbook-screenshot-import/submit_import.ts";
import { validateImport } from "../accountbook-screenshot-import/validate_candidates.ts";
import {
  ensureWeeklyPrivateLayout,
  loadWeeklyState,
  scanAndClaimInbox,
  acquireWeeklyRunLock,
  releaseWeeklyRunLock,
} from "./scan_inbox.ts";
import type { WeeklyWorkItem } from "./contracts.ts";
import { runWeeklyImport } from "./run_weekly_import.ts";
import { finalizeInboxItem } from "./finalize_inbox.ts";

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

function runBunScript(args: string[]): ReturnType<typeof Bun.spawnSync> {
  return Bun.spawnSync(["bun", ...args], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH ?? "",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
}

function prepareRunPlan(options: {
  root: string;
  runId: string;
  overrides?: (item: WeeklyWorkItem) => Partial<ExtractedImport["days"][number]>;
}): unknown {
  acquireWeeklyRunLock(options.root, options.runId);
  const items = scanAndClaimInbox({ privateRoot: options.root, runId: options.runId });
  const queuePath = join(options.root, "state", `${options.runId}-queue.json`);
  writeFileSync(queuePath, `${JSON.stringify({
    schemaVersion: 1,
    runId: options.runId,
    generatedAt: "2026-08-20T02:00:00.000Z",
    items,
  }, null, 2)}\n`, { mode: 0o600 });
  return {
    schemaVersion: 1,
    runId: options.runId,
    queuePath,
    items: items.map((item) => {
      const candidate = validateImport(extracted(item, options.overrides?.(item) ?? {}), {
        now: () => new Date("2026-08-20T01:30:00Z"),
      });
      const runDir = join(options.root, "imports", candidate.batchId);
      mkdirSync(runDir, { recursive: true, mode: 0o700 });
      const validatedPath = join(runDir, "validated.json");
      writeFileSync(validatedPath, `${JSON.stringify(candidate, null, 2)}\n`, { mode: 0o600 });
      return {
        imageSha256: item.imageSha256,
        validatedPath,
      };
    }),
  };
}

async function runWeeklyDryPipeline(options: {
  root: string;
  runId: string;
  fetchImpl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  overrides?: (item: WeeklyWorkItem) => Partial<ExtractedImport["days"][number]>;
}): Promise<void> {
  const plan = prepareRunPlan(options);
  await runWeeklyImport({
    privateRoot: options.root,
    plan,
    config: CONFIG,
    fetchImpl: options.fetchImpl,
    now: () => new Date("2026-08-20T02:10:00Z"),
  });
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

  test("plan item 경로가 privateRoot 밖이면 API 호출 없이 실패하고 lock을 해제한다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    const plan = prepareRunPlan({ root, runId: "run-1" }) as {
      schemaVersion: 1;
      runId: string;
      queuePath: string;
      items: Array<{ imageSha256: string; validatedPath: string }>;
    };
    plan.items[0].validatedPath = join(root, "..", "outside-validated.json");
    let fetchCount = 0;

    await expect(runWeeklyImport({
      privateRoot: root,
      plan,
      config: CONFIG,
      fetchImpl: async () => {
        fetchCount += 1;
        return jsonResponse({});
      },
      now: () => new Date("2026-08-20T02:10:00Z"),
    })).rejects.toThrow("RUN_PLAN_PATH_OUTSIDE_PRIVATE_ROOT");

    expect(fetchCount).toBe(0);
    expect(existsSync(join(root, "state", "locks", "weekly-import.lock"))).toBe(false);
  });

  test("full plan parse 오류도 알 수 있는 runId의 lock을 해제한다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    prepareRunPlan({ root, runId: "run-1" });
    let fetchCount = 0;

    await expect(runWeeklyImport({
      privateRoot: root,
      plan: { runId: "run-1" },
      config: CONFIG,
      fetchImpl: async () => {
        fetchCount += 1;
        return jsonResponse({});
      },
    })).rejects.toThrow();

    expect(fetchCount).toBe(0);
    expect(existsSync(join(root, "state", "locks", "weekly-import.lock"))).toBe(false);
  });

  test("plan이 queue hash를 누락하면 API 호출 없이 실패하고 lock을 해제한다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "first", pngBytes);
    writeInboxPair(root, "second", Buffer.from([...pngBytes, 1]));
    const plan = prepareRunPlan({ root, runId: "run-1" }) as {
      schemaVersion: 1;
      runId: string;
      queuePath: string;
      items: Array<{ imageSha256: string; validatedPath: string }>;
    };
    plan.items.pop();
    let fetchCount = 0;

    await expect(runWeeklyImport({
      privateRoot: root,
      plan,
      config: CONFIG,
      fetchImpl: async () => {
        fetchCount += 1;
        return jsonResponse({});
      },
    })).rejects.toThrow("RUN_PLAN_QUEUE_HASH_MISMATCH");

    expect(fetchCount).toBe(0);
    expect(existsSync(join(root, "state", "locks", "weekly-import.lock"))).toBe(false);
  });

  test("vision 단계에서 이미 failed 처리한 queue item은 plan에서 제외해도 나머지를 실행한다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "first", pngBytes);
    writeInboxPair(root, "second", Buffer.from([...pngBytes, 1]));
    const plan = prepareRunPlan({ root, runId: "run-1" }) as {
      schemaVersion: 1;
      runId: string;
      queuePath: string;
      items: Array<{ imageSha256: string; validatedPath: string }>;
    };
    const excluded = plan.items.shift();
    if (!excluded) throw new Error("TEST_FIXTURE_MISSING_ITEM");
    const excludedBatch = JSON.parse(readFileSync(excluded.validatedPath, "utf8")).batchId;
    finalizeInboxItem({
      privateRoot: root,
      imageSha256: excluded.imageSha256,
      status: "failed",
      batchId: excludedBatch,
      lastErrorCode: "WEEKLY_INPUT_INVALID",
    });
    const requests: FetchRecord[] = [];

    await runWeeklyImport({
      privateRoot: root,
      plan,
      config: CONFIG,
      fetchImpl: async (input, init) => {
        const common = commonResponse(String(input), init);
        if (common) return common;
        const method = init?.method ?? "GET";
        requests.push({ url: String(input), method, body: init?.body ? JSON.parse(String(init.body)) : null });
        if (method === "GET") return jsonResponse({ data: { items: [] } });
        return jsonResponse({ data: { uuid: "remote-expense" } }, 201);
      },
      now: () => new Date("2026-08-20T02:10:00Z"),
    });

    const statuses = Object.values(loadWeeklyState(root).items).map((item) => item.status).sort();
    expect(statuses).toEqual(["failed", "submitted"]);
    expect(requests.filter((request) => request.method === "POST")).toHaveLength(1);
  });

  test("run_weekly_import CLI는 env 오류가 run 전 발생해도 own lock을 해제한다", () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    const plan = prepareRunPlan({ root, runId: "run-1" });
    const planPath = join(root, "state", "run-1-plan.json");
    const envPath = join(root, "state", "empty.env");
    writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600 });
    writeFileSync(envPath, "\n", { mode: 0o600 });

    const result = runBunScript([
      "accountbook/scripts/accountbook-weekly-import/run_weekly_import.ts",
      "--private-root",
      root,
      "--plan",
      planPath,
      "--env",
      envPath,
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(new TextDecoder().decode(result.stderr)).toContain("MISSING_ENV:ACCOUNTBOOK_API_BASE_URL");
    expect(existsSync(join(root, "state", "locks", "weekly-import.lock"))).toBe(false);
  });

  test("plan hash가 중복되면 API 호출 없이 실패한다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    const plan = prepareRunPlan({ root, runId: "run-1" }) as {
      schemaVersion: 1;
      runId: string;
      queuePath: string;
      items: Array<{ imageSha256: string; validatedPath: string }>;
    };
    plan.items.push({ ...plan.items[0] });
    let fetchCount = 0;

    await expect(runWeeklyImport({
      privateRoot: root,
      plan,
      config: CONFIG,
      fetchImpl: async () => {
        fetchCount += 1;
        return jsonResponse({});
      },
    })).rejects.toThrow("RUN_PLAN_DUPLICATE_HASH");

    expect(fetchCount).toBe(0);
  });

  test("queue runId가 plan과 다르면 API 호출 없이 실패한다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    const plan = prepareRunPlan({ root, runId: "run-1" }) as {
      schemaVersion: 1;
      runId: string;
      queuePath: string;
      items: Array<{ imageSha256: string; validatedPath: string }>;
    };
    const queue = JSON.parse(readFileSync(plan.queuePath, "utf8"));
    queue.runId = "other-run";
    writeFileSync(plan.queuePath, `${JSON.stringify(queue, null, 2)}\n`, { mode: 0o600 });
    let fetchCount = 0;

    await expect(runWeeklyImport({
      privateRoot: root,
      plan,
      config: CONFIG,
      fetchImpl: async () => {
        fetchCount += 1;
        return jsonResponse({});
      },
    })).rejects.toThrow("RUN_PLAN_QUEUE_RUN_ID_MISMATCH");

    expect(fetchCount).toBe(0);
  });

  test("weekly lock이 없거나 owner가 다르면 API 호출 없이 실패한다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    const plan = prepareRunPlan({ root, runId: "run-1" });
    releaseWeeklyRunLock(root, "run-1");
    let fetchCount = 0;

    await expect(runWeeklyImport({
      privateRoot: root,
      plan,
      config: CONFIG,
      fetchImpl: async () => {
        fetchCount += 1;
        return jsonResponse({});
      },
    })).rejects.toThrow("WEEKLY_IMPORT_LOCK_MISSING");

    acquireWeeklyRunLock(root, "other-run");
    await expect(runWeeklyImport({
      privateRoot: root,
      plan,
      config: CONFIG,
      fetchImpl: async () => {
        fetchCount += 1;
        return jsonResponse({});
      },
    })).rejects.toThrow("WEEKLY_IMPORT_LOCK_OWNER_MISMATCH");
    expect(fetchCount).toBe(0);
  });

  test("validated path symlink가 privateRoot 밖을 가리키면 API 호출 없이 차단한다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    const plan = prepareRunPlan({ root, runId: "run-1" }) as {
      schemaVersion: 1;
      runId: string;
      queuePath: string;
      items: Array<{ imageSha256: string; validatedPath: string }>;
    };
    const externalDir = mkdtempSync(join(tmpdir(), "accountbook-outside-"));
    tempDirs.push(externalDir);
    const externalValidated = join(externalDir, "validated.json");
    writeFileSync(externalValidated, readFileSync(plan.items[0].validatedPath));
    const linkPath = join(root, "imports", "outside-link.json");
    symlinkSync(externalValidated, linkPath);
    plan.items[0].validatedPath = linkPath;
    let fetchCount = 0;

    await expect(runWeeklyImport({
      privateRoot: root,
      plan,
      config: CONFIG,
      fetchImpl: async () => {
        fetchCount += 1;
        return jsonResponse({});
      },
    })).rejects.toThrow("RUN_PLAN_PATH_OUTSIDE_PRIVATE_ROOT");

    expect(fetchCount).toBe(0);
  });

  test("queuePath symlink가 privateRoot 밖을 가리키면 API 호출 없이 차단한다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    const plan = prepareRunPlan({ root, runId: "run-1" }) as {
      schemaVersion: 1;
      runId: string;
      queuePath: string;
      items: Array<{ imageSha256: string; validatedPath: string }>;
    };
    const externalDir = mkdtempSync(join(tmpdir(), "accountbook-outside-"));
    tempDirs.push(externalDir);
    const externalQueue = join(externalDir, "queue.json");
    writeFileSync(externalQueue, readFileSync(plan.queuePath));
    const linkPath = join(root, "state", "queue-link.json");
    symlinkSync(externalQueue, linkPath);
    plan.queuePath = linkPath;
    let fetchCount = 0;

    await expect(runWeeklyImport({
      privateRoot: root,
      plan,
      config: CONFIG,
      fetchImpl: async () => {
        fetchCount += 1;
        return jsonResponse({});
      },
    })).rejects.toThrow("RUN_PLAN_PATH_OUTSIDE_PRIVATE_ROOT");

    expect(fetchCount).toBe(0);
  });

  test("queue manifestPath symlink가 privateRoot 밖을 가리키면 API 호출 없이 차단한다", async () => {
    const root = privateRoot();
    writeInboxPair(root, "source");
    const plan = prepareRunPlan({ root, runId: "run-1" }) as {
      schemaVersion: 1;
      runId: string;
      queuePath: string;
      items: Array<{ imageSha256: string; validatedPath: string }>;
    };
    const queue = JSON.parse(readFileSync(plan.queuePath, "utf8"));
    const externalDir = mkdtempSync(join(tmpdir(), "accountbook-outside-"));
    tempDirs.push(externalDir);
    const externalManifest = join(externalDir, "source.json");
    writeFileSync(externalManifest, readFileSync(queue.items[0].manifestPath));
    const linkPath = join(root, "inbox", "processing", "manifest-link.json");
    symlinkSync(externalManifest, linkPath);
    queue.items[0].manifestPath = linkPath;
    writeFileSync(plan.queuePath, `${JSON.stringify(queue, null, 2)}\n`, { mode: 0o600 });
    let fetchCount = 0;

    await expect(runWeeklyImport({
      privateRoot: root,
      plan,
      config: CONFIG,
      fetchImpl: async () => {
        fetchCount += 1;
        return jsonResponse({});
      },
    })).rejects.toThrow("RUN_PLAN_PATH_OUTSIDE_PRIVATE_ROOT");

    expect(fetchCount).toBe(0);
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

  test("fetch failed 네트워크 실패도 submitting state를 기준으로 processing을 유지한다", async () => {
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
        throw new Error("fetch failed");
      },
    });

    expect(firstPostCount).toBe(1);
    expect(Object.values(loadWeeklyState(root).items)[0].status).toBe("processing");
  });

  test("API 500은 processing을 유지하고 재실행 조회에서 0건이면 재POST 없이 needs_review가 된다", async () => {
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
        return jsonResponse({ error: "server error" }, 500);
      },
    });

    expect(firstPostCount).toBe(1);
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

    const item = Object.values(loadWeeklyState(root).items)[0];
    expect(retryPostCount).toBe(0);
    expect(item.status).toBe("needs_review");
    expect(item.lastErrorCode).toBe("EXISTING_TRANSACTION_REQUIRES_REVIEW");
  });
});
