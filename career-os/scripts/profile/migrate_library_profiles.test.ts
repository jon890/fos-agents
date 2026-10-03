import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ProfileClient, type ProfileFetch } from "./client.ts";
import {
  createProfileMigrationStore,
  migrateLibraryProfiles,
  parseUsageTable,
  type BackfillRow,
  type ProfileMigrationStore,
} from "./migrate_library_profiles.ts";

// 값은 모두 지어낸 것이다. 실제 원고와 사용량을 옮겨 적지 않는다.
const table = `# 사용량

| 월 | Claude Code | Codex | 합계 | 측정한 날 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 2025.01 | 0.4B | 2.1B | 2.5B | 2025-03-02 | 지어낸 비고 |
| 2025.02 | 3.0B | 1B | 4.0B | 2025-03-02 | 한 달 전체 |
`;

const profilesDir = "/fixture/profiles";
const bodies: Record<string, string> = {
  "wanted-profile.md": "지어낸 원티드 원고 본문 ALPHA",
  "linkedin-profile.md": "지어낸 링크드인 원고 본문 BRAVO",
  "github-profile.md": "지어낸 깃허브 원고 본문 CHARLIE",
  "github-agent-usage-snapshots.md": table,
};

function fileReader(files: Record<string, string>) {
  return (path: string) => {
    for (const [name, content] of Object.entries(files)) if (path === join(profilesDir, name)) return content;
    return null;
  };
}

type Call = { method: string; args: unknown[] };

function fakeStore(options: { exists?: boolean; months?: string[]; created?: boolean; failCreate?: string } = {}) {
  const calls: Call[] = [];
  const store: ProfileMigrationStore = {
    async listMonths() {
      calls.push({ method: "listMonths", args: [] });
      return options.months ?? [];
    },
    async documentExists(key) {
      calls.push({ method: "documentExists", args: [key] });
      return options.exists ?? false;
    },
    async createDocument(key, body, note) {
      calls.push({ method: "createDocument", args: [key, body, note] });
      if (key === options.failCreate) throw new Error("대역 실패");
    },
    async putBackfilled(row, source) {
      calls.push({ method: "putBackfilled", args: [row, source] });
      return { created: options.created ?? true };
    },
  };
  return { store, calls };
}

async function run(options: {
  files?: Record<string, string>;
  store: ProfileMigrationStore;
  dryRun?: boolean;
  measuredMonths?: string[];
}) {
  const lines: string[] = [];
  const result = await migrateLibraryProfiles({
    profilesDir,
    measuredMonths: options.measuredMonths ?? ["2025-02"],
    dryRun: options.dryRun ?? false,
    store: options.store,
    readFile: fileReader(options.files ?? bodies),
    write: (line) => lines.push(line),
  });
  return { ...result, lines };
}

describe("parseUsageTable", () => {
  test("지어낸 표를 두 줄로 읽고 십억 단위를 정수로 바꾼다", () => {
    const rows = parseUsageTable(table);

    expect(rows).toEqual([
      { month: "2025-01", claudeTokens: 400_000_000, codexTokens: 2_100_000_000, measuredOn: "2025-03-02", note: "지어낸 비고" },
      { month: "2025-02", claudeTokens: 3_000_000_000, codexTokens: 1_000_000_000, measuredOn: "2025-03-02", note: "한 달 전체" },
    ]);
  });

  test("칸의 순서가 바뀌어도 머리 줄의 이름으로 같은 값을 읽는다", () => {
    const reordered = `| 월 | 측정한 날 | 비고 | Codex | 합계 | Claude Code |
| --- | --- | --- | --- | --- | --- |
| 2025.01 | 2025-03-02 | 지어낸 비고 | 2.1B | 2.5B | 0.4B |
| 2025.02 | 2025-03-02 | 한 달 전체 | 1B | 4.0B | 3.0B |
`;

    expect(parseUsageTable(reordered)).toEqual(parseUsageTable(table));
  });

  test("표 아래 산문과 다른 표는 읽지 않는다", () => {
    const withProse = `${table}\n표 밖 산문이다. | 2025.03 | 9B | 9B | 9B | 2025-04-01 | 읽으면 안 된다 |\n\n| 2025.04 | 1B | 1B | 2B | 2025-05-01 | 다른 표 |\n`;

    expect(parseUsageTable(withProse).map((row) => row.month)).toEqual(["2025-01", "2025-02"]);
  });

  test("B 가 없는 토큰 칸은 줄 번호를 담아 던지고 값은 문구에 넣지 않는다", () => {
    const broken = table.replace("| 0.4B |", "| 1.3 |");

    expect(() => parseUsageTable(broken)).toThrow("사용량 표의 5번째 줄을 읽지 못했다.");
    try {
      parseUsageTable(broken);
    } catch (error) {
      expect((error as Error).message).not.toContain("1.3");
    }
  });

  test("머리 줄이 없거나 같은 달이 두 줄이면 던진다", () => {
    expect(() => parseUsageTable("| 2025.01 | 0.4B | 2.1B | 2.5B | 2025-03-02 | 비고 |\n")).toThrow("머리 줄");
    expect(() => parseUsageTable(`${table}| 2025.02 | 1B | 1B | 2B | 2025-03-02 | 중복 |\n`)).toThrow("7번째 줄");
  });

  test("자료 줄이 없으면 던진다", () => {
    expect(() => parseUsageTable("| 월 | Claude Code | Codex | 측정한 날 | 비고 |\n| --- | --- | --- | --- | --- |\n")).toThrow("자료 줄");
  });

  test("비고 칸이 비어도 던지지 않고 note 가 빈 문자열이다", () => {
    const rows = parseUsageTable(table.replace("| 지어낸 비고 |", "|  |"));

    expect(rows[0].note).toBe("");
  });
});

describe("migrateLibraryProfiles", () => {
  test("빈 저장소에는 원고 셋과 달 둘을 만들고 --measured 달만 MEASURED 다", async () => {
    const { store, calls } = fakeStore({ months: [] });
    const result = await run({ store });

    const created = calls.filter((call) => call.method === "createDocument");
    expect(created.map((call) => call.args[0])).toEqual(["wanted", "linkedin", "github"]);
    expect(created[0].args).toEqual(["wanted", bodies["wanted-profile.md"], "library/profiles 의 원고를 옮긴다"]);
    const puts = calls.filter((call) => call.method === "putBackfilled");
    expect(puts.map((call) => [(call.args[0] as BackfillRow).month, call.args[1]])).toEqual([
      ["2025-01", "BACKFILLED"],
      ["2025-02", "MEASURED"],
    ]);
    expect(result.lines).toEqual([
      "document wanted CREATED",
      "document linkedin CREATED",
      "document github CREATED",
      "usage 2025-01 CREATED BACKFILLED",
      "usage 2025-02 CREATED MEASURED",
    ]);
    expect(result.exitCode).toBe(0);
  });

  test("다시 실행하면 원고와 달에 쓰기 요청을 보내지 않고 모두 EXISTS 다", async () => {
    const { store, calls } = fakeStore({ exists: true, months: ["2025-01", "2025-02"] });
    const result = await run({ store });

    expect(calls.filter((call) => call.method === "createDocument" || call.method === "putBackfilled")).toEqual([]);
    expect(result.lines).toEqual([
      "document wanted EXISTS",
      "document linkedin EXISTS",
      "document github EXISTS",
      "usage 2025-01 EXISTS",
      "usage 2025-02 EXISTS",
    ]);
    expect(result.exitCode).toBe(0);
  });

  test("목록을 읽은 뒤 다른 곳에서 기록해 created=false 면 그 달은 EXISTS 다", async () => {
    const { store } = fakeStore({ months: [], created: false });
    const result = await run({ store });

    expect(result.lines.slice(3)).toEqual(["usage 2025-01 EXISTS", "usage 2025-02 EXISTS"]);
    expect(result.exitCode).toBe(0);
  });

  test("dry-run 은 저장소를 부르지 않고 모두 WOULD_CREATE 다", async () => {
    const { store, calls } = fakeStore();
    const result = await run({ store, dryRun: true });

    expect(calls).toEqual([]);
    expect(result.lines).toEqual([
      "document wanted WOULD_CREATE",
      "document linkedin WOULD_CREATE",
      "document github WOULD_CREATE",
      "usage 2025-01 WOULD_CREATE BACKFILLED",
      "usage 2025-02 WOULD_CREATE MEASURED",
    ]);
    expect(result.exitCode).toBe(0);
  });

  test("표의 둘째 줄이 잘못되면 요청을 하나도 보내지 않고 던진다", async () => {
    const { store, calls } = fakeStore();
    const files = { ...bodies, "github-agent-usage-snapshots.md": table.replace("| 1B |", "| 1 |") };

    await expect(run({ store, files })).rejects.toThrow("6번째 줄");
    expect(calls).toEqual([]);
  });

  test("사용량 표 파일이 없으면 경로를 담아 요청 전에 던진다", async () => {
    const { store, calls } = fakeStore();
    const { ["github-agent-usage-snapshots.md"]: _omitted, ...files } = bodies;

    await expect(run({ store, files })).rejects.toThrow(join(profilesDir, "github-agent-usage-snapshots.md"));
    expect(calls).toEqual([]);
  });

  test("--measured 의 달이 표에 없으면 요청 전에 던진다", async () => {
    const { store, calls } = fakeStore();

    await expect(run({ store, measuredMonths: ["2025-09"] })).rejects.toThrow("2025-09");
    expect(calls).toEqual([]);
  });

  test("원고 하나가 없으면 MISSING_FILE 이고 나머지는 처리하며 종료 코드가 1 이다", async () => {
    const { store, calls } = fakeStore();
    const { ["linkedin-profile.md"]: _omitted, ...files } = bodies;
    const result = await run({ store, files });

    expect(result.lines).toEqual([
      "document wanted CREATED",
      "document linkedin MISSING_FILE",
      "document github CREATED",
      "usage 2025-01 CREATED BACKFILLED",
      "usage 2025-02 CREATED MEASURED",
    ]);
    expect(calls.filter((call) => call.method === "createDocument").map((call) => call.args[0])).toEqual(["wanted", "github"]);
    expect(result.exitCode).toBe(1);
  });

  test("쓰기가 실패한 원고는 FAILED 로 내고 남은 것을 마저 처리한 뒤 종료 코드가 1 이다", async () => {
    const { store } = fakeStore({ failCreate: "wanted" });
    const result = await run({ store });

    expect(result.lines[0]).toStartWith("document wanted FAILED");
    expect(result.lines.slice(1)).toEqual([
      "document linkedin CREATED",
      "document github CREATED",
      "usage 2025-01 CREATED BACKFILLED",
      "usage 2025-02 CREATED MEASURED",
    ]);
    expect(result.exitCode).toBe(1);
  });

  test("출력에 원고 본문과 토큰 값이 없다", async () => {
    const { store } = fakeStore({ failCreate: "github" });
    const output = (await run({ store })).lines.join("\n");

    for (const secret of ["ALPHA", "BRAVO", "CHARLIE", "원고 본문", "0.4B", "2.1B", "400000000", "2100000000", "1000000000"]) {
      expect(output).not.toContain(secret);
    }
  });
});

describe("createProfileMigrationStore", () => {
  const row: BackfillRow = { month: "2025-01", claudeTokens: 400_000_000, codexTokens: 2_100_000_000, measuredOn: "2025-03-02", note: "지어낸 비고" };
  const snapshot = {
    month: "2025-01", claudeTokens: 400_000_000, codexTokens: 2_100_000_000, claudeCostUsd: null, codexCostUsd: null, sessions: null,
    unpricedTokens: 0, measuredOn: "2025-03-02", source: "BACKFILLED", note: null,
    createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
  };

  function client(fetchImpl: ProfileFetch): ProfileClient {
    return new ProfileClient({ origin: "https://career.example.com", token: "x".repeat(32), fetchImpl, maxRetries: 0 });
  }

  function recordingStore() {
    const requests: Array<{ url: URL; method?: string; body: Record<string, unknown> }> = [];
    const store = createProfileMigrationStore(client(async (url, init) => {
      requests.push({ url, method: init.method, body: JSON.parse(String(init.body)) });
      return Response.json({ snapshot, created: true });
    }));
    return { store, requests };
  }

  test("putBackfilled 는 replace 없이 BACKFILLED 와 빈 비용, 빈 세션 수를 보낸다", async () => {
    const { store, requests } = recordingStore();

    expect(await store.putBackfilled(row, "BACKFILLED")).toEqual({ created: true });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("PUT");
    expect(requests[0].url.pathname).toBe("/api/profile/v1/usage-snapshots/2025-01");
    expect(requests[0].body).toEqual({
      claudeTokens: 400_000_000,
      codexTokens: 2_100_000_000,
      claudeCostUsd: null,
      codexCostUsd: null,
      sessions: null,
      unpricedTokens: 0,
      measuredOn: "2025-03-02",
      source: "BACKFILLED",
      note: "지어낸 비고",
    });
    expect("replace" in requests[0].body).toBe(false);
  });

  test("비고가 빈 줄은 note 키 없이 보내고 던지지 않는다", async () => {
    const { store, requests } = recordingStore();

    await store.putBackfilled({ ...row, note: "" }, "MEASURED");
    expect("note" in requests[0].body).toBe(false);
    expect(requests[0].body.source).toBe("MEASURED");
  });

  test("documentExists 는 404 면 false 이고 500 이면 던진다", async () => {
    const error = (status: number) => client(async () => Response.json({ error: { code: "X", message: "raw", requestId: "req" } }, { status }));

    expect(await createProfileMigrationStore(error(404)).documentExists("github")).toBe(false);
    await expect(createProfileMigrationStore(error(500)).documentExists("github")).rejects.toMatchObject({ status: 500 });
  });

  test("documentExists 는 문서가 오면 true 이고 createDocument 는 expectedVersion 0 으로 보낸다", async () => {
    const requests: Array<{ method?: string; body?: unknown }> = [];
    const store = createProfileMigrationStore(client(async (_url, init) => {
      requests.push({ method: init.method, body: init.body ? JSON.parse(String(init.body)) : undefined });
      if (init.method === "GET") {
        return Response.json({ document: { documentKey: "github", body: "지어낸 본문", version: 1, note: "메모", updatedAt: "2026-10-01T00:00:00.000Z" } });
      }
      return Response.json({ document: { documentKey: "github", version: 1, updatedAt: "2026-10-01T00:00:00.000Z" } });
    }));

    expect(await store.documentExists("github")).toBe(true);
    await store.createDocument("github", "지어낸 본문", "메모");
    expect(requests[1]).toEqual({ method: "PUT", body: { body: "지어낸 본문", note: "메모", expectedVersion: 0 } });
  });

  test("listMonths 는 기록된 달만 돌려준다", async () => {
    const store = createProfileMigrationStore(client(async () => Response.json({ snapshots: [snapshot, { ...snapshot, month: "2025-02" }] })));

    expect(await store.listMonths()).toEqual(["2025-01", "2025-02"]);
  });
});
