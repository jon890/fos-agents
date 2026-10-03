import { describe, expect, test } from "bun:test";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import { ProfileClient, type ProfileFetch } from "../profile/client.ts";
import { collectUsage, createUsageSnapshotStore, targetMonths, type UsageSnapshotStore } from "./collect_usage.ts";
import type { MonthlyMeasurement } from "./measure.ts";

const LINE = /^(\d{4}-\d{2}|-) [A-Z_]+$/;

function measurement(month: string, claudeTokens = 123_456_789, codexTokens = 987_654_321): MonthlyMeasurement {
  return { month, claudeTokens, codexTokens, claudeCostUsd: 4321.09, codexCostUsd: 876.54, sessions: 77, unpricedTokens: 5555 };
}

function fakeStore(recorded: string[], put: (m: MonthlyMeasurement) => Promise<{ created: boolean }> = async () => ({ created: true })) {
  const puts: Array<{ measurement: MonthlyMeasurement; measuredOn: string }> = [];
  const store: UsageSnapshotStore = {
    listMonths: async () => recorded,
    putMeasured: async (m, measuredOn) => {
      puts.push({ measurement: m, measuredOn });
      return put(m);
    },
  };
  return { store, puts };
}

function fakeMeasure(rows: MonthlyMeasurement[]) {
  const state = { calls: 0 };
  return { state, measure: async () => { state.calls += 1; return rows; } };
}

async function run(store: UsageSnapshotStore, measure: () => Promise<MonthlyMeasurement[]>, now: string) {
  const lines: string[] = [];
  const errors: string[] = [];
  const result = await collectUsage({
    store,
    measure,
    now: new Date(now),
    write: (line) => lines.push(line),
    writeError: (line) => errors.push(line),
  });
  return { ...result, lines, errors };
}

function expectQuietLines(lines: string[], rows: MonthlyMeasurement[]) {
  for (const line of lines) expect(line).toMatch(LINE);
  const output = lines.join("\n");
  for (const row of rows) {
    // 0 같은 짧은 값은 달 이름에도 들어 있어 구분할 수 없다. 대역에 넣은 네 자리 이상의 값만 찾는다.
    const values = [row.claudeTokens, row.codexTokens, row.claudeCostUsd, row.codexCostUsd, row.unpricedTokens].map(String);
    for (const value of values.filter((text) => text.length >= 4)) {
      expect(output).not.toContain(value);
    }
  }
}

describe("targetMonths", () => {
  test.each([
    [[], "2026-03-15T00:00:00Z", ["2026-02"]],
    [[], "2026-01-05T00:00:00Z", ["2025-12"]],
    [["2025-12", "2026-01", "2026-02"], "2026-03-15T00:00:00Z", []],
    [["2025-11", "2026-01"], "2026-03-15T00:00:00Z", ["2025-12", "2026-02"]],
    [["2026-02"], "2026-03-15T00:00:00Z", []],
    [["2026-01"], "2026-02-28T16:00:00Z", []],
    [["2025-11"], "2026-01-05T00:00:00Z", ["2025-12"]],
  ] as Array<[string[], string, string[]]>)("기록 %j, 현재 %s 이면 %j 가 대상이다", (recorded, now, expected) => {
    expect(targetMonths(recorded, new Date(now))).toEqual(expected);
  });
});

describe("collectUsage", () => {
  test("기록이 없는 끝난 달을 측정해 올리고 CREATED 를 낸다", async () => {
    const rows = [measurement("2026-01"), measurement("2026-02")];
    const { store, puts } = fakeStore(["2026-01"]);
    const { measure, state } = fakeMeasure(rows);

    const result = await run(store, measure, "2026-03-15T00:00:00Z");

    expect(state.calls).toBe(1);
    expect(puts).toHaveLength(1);
    expect(puts[0].measurement.month).toBe("2026-02");
    expect(puts[0].measuredOn).toBe("2026-03-15");
    expect(result.lines).toEqual(["2026-02 CREATED"]);
    expect(result.exitCode).toBe(0);
    expectQuietLines(result.lines, rows);
  });

  test("measuredOn 은 Asia/Seoul 날짜다", async () => {
    const rows = [measurement("2026-02")];
    const { store, puts } = fakeStore(["2026-01"]);

    await run(store, fakeMeasure(rows).measure, "2026-03-14T16:30:00Z");

    expect(puts[0].measuredOn).toBe("2026-03-15");
  });

  test("Backend 가 created=false 를 주면 EXISTS 이고 종료 코드는 0 이다", async () => {
    const rows = [measurement("2026-02")];
    const { store } = fakeStore(["2026-01"], async () => ({ created: false }));

    const result = await run(store, fakeMeasure(rows).measure, "2026-03-15T00:00:00Z");

    expect(result.lines).toEqual(["2026-02 EXISTS"]);
    expect(result.exitCode).toBe(0);
    expectQuietLines(result.lines, rows);
  });

  test("대상 달이 없으면 측정하지 않고 UP_TO_DATE 를 낸다", async () => {
    const { store, puts } = fakeStore(["2026-01", "2026-02"]);
    const { measure, state } = fakeMeasure([measurement("2026-02")]);

    const result = await run(store, measure, "2026-03-15T00:00:00Z");

    expect(state.calls).toBe(0);
    expect(puts).toHaveLength(0);
    expect(result.lines).toEqual(["- UP_TO_DATE"]);
    expect(result.exitCode).toBe(0);
    expectQuietLines(result.lines, []);
  });

  test("측정 결과에 대상 달이 없거나 토큰이 0 이면 NO_SESSIONS 이고 올리지 않는다", async () => {
    const rows = [measurement("2025-12"), measurement("2026-02", 0, 0)];
    const { store, puts } = fakeStore(["2025-12"]);

    const result = await run(store, fakeMeasure(rows).measure, "2026-03-15T00:00:00Z");

    expect(puts).toHaveLength(0);
    expect(result.lines).toEqual(["2026-01 NO_SESSIONS", "2026-02 NO_SESSIONS"]);
    expect(result.exitCode).toBe(0);
    expectQuietLines(result.lines, rows);
  });

  test("기록 목록을 읽지 못하면 측정하지 않고 던진다", async () => {
    const { measure, state } = fakeMeasure([measurement("2026-02")]);
    const store: UsageSnapshotStore = {
      listMonths: async () => { throw new CareerBackendHttpError(null, "NETWORK_ERROR", "Backend 에 닿지 못했다."); },
      putMeasured: async () => ({ created: true }),
    };
    const lines: string[] = [];
    const errors: string[] = [];

    await expect(
      collectUsage({
        store,
        measure,
        now: new Date("2026-03-15T00:00:00Z"),
        write: (line) => lines.push(line),
        writeError: (line) => errors.push(line),
      }),
    ).rejects.toMatchObject({ status: null, code: "NETWORK_ERROR" });
    expect(state.calls).toBe(0);
    expect(lines).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("한 달의 올리기가 실패해도 남은 달을 올리고 종료 코드는 1 이다", async () => {
    const rows = [measurement("2025-12"), measurement("2026-01"), measurement("2026-02")];
    const { store, puts } = fakeStore(["2025-12"], async (m) => {
      if (m.month === "2026-01") throw new CareerBackendHttpError(503, "UNAVAILABLE", "잠시 쓸 수 없다.");
      return { created: true };
    });

    const result = await run(store, fakeMeasure(rows).measure, "2026-03-15T00:00:00Z");

    expect(puts.map((p) => p.measurement.month)).toEqual(["2026-01", "2026-02"]);
    expect(result.lines).toEqual(["2026-01 FAILED", "2026-02 CREATED"]);
    expect(result.exitCode).toBe(1);
    expectQuietLines(result.lines, rows);
  });

  test("올리기가 실패하면 표준 출력에는 FAILED 를, 표준 오류에는 상태 코드가 담긴 한 줄을 낸다", async () => {
    const rows = [measurement("2026-02")];
    const { store } = fakeStore(["2026-01"], async () => {
      throw new CareerBackendHttpError(401, "UNAUTHORIZED", "커리어 Backend 요청이 실패했습니다.", "req-abc");
    });

    const result = await run(store, fakeMeasure(rows).measure, "2026-03-15T00:00:00Z");

    expect(result.lines).toEqual(["2026-02 FAILED"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toStartWith("2026-02 ");
    expect(result.errors[0]).toContain("status=401");
    expect(result.errors[0]).toContain("code=UNAUTHORIZED");
    expect(result.errors[0]).not.toContain("\n");
    expect(result.exitCode).toBe(1);
    expectQuietLines(result.lines, rows);
  });
});

describe("createUsageSnapshotStore", () => {
  function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const stored = {
    month: "2026-02", claudeTokens: 1, codexTokens: 2, claudeCostUsd: null, codexCostUsd: null, sessions: null,
    unpricedTokens: 0, measuredOn: "2026-03-15", source: "MEASURED" as const, note: null,
    createdAt: "2026-03-15T00:00:00.000Z", updatedAt: "2026-03-15T00:00:00.000Z",
  };

  test("기록 목록에서 달만 뽑고, 측정값을 교체 플래그 없이 MEASURED 로 보낸다", async () => {
    const calls: Array<{ url: URL; init: RequestInit }> = [];
    const fetchImpl: ProfileFetch = async (url, init) => {
      calls.push({ url, init });
      if (init.method === "GET") return jsonResponse({ snapshots: [{ ...stored, month: "2026-01" }] });
      return jsonResponse({ snapshot: stored, created: false });
    };
    const client = new ProfileClient({ origin: "https://career.example.com", token: "x".repeat(32), fetchImpl, maxRetries: 0 });
    const store = createUsageSnapshotStore(client);

    expect(await store.listMonths()).toEqual(["2026-01"]);
    const row = measurement("2026-02");
    expect(await store.putMeasured(row, "2026-03-15")).toEqual({ created: false });

    const put = calls.find((call) => call.init.method === "PUT");
    expect(put?.url.pathname).toBe("/api/profile/v1/usage-snapshots/2026-02");
    const body = JSON.parse(String(put?.init.body));
    expect(Object.hasOwn(body, "replace")).toBe(false);
    expect(Object.hasOwn(body, "note")).toBe(false);
    expect(body).toEqual({
      claudeTokens: row.claudeTokens,
      codexTokens: row.codexTokens,
      claudeCostUsd: row.claudeCostUsd,
      codexCostUsd: row.codexCostUsd,
      sessions: row.sessions,
      unpricedTokens: row.unpricedTokens,
      measuredOn: "2026-03-15",
      source: "MEASURED",
    });
  });
});
