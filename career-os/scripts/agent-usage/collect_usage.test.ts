import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectUsage, CollectUsageArgumentError, mergeScriptArguments, parseCollectArguments, targetMonths, type UsageSnapshotStore } from "./collect_usage.ts";
import { agentUsageCommand, type MonthlyMeasurement } from "./measure.ts";
import { createUsageFileStore } from "./usage_file.ts";

const LINE = /^(\d{4}-\d{2}|-) [A-Z_]+$/;

function measurement(month: string, claudeTokens = 123_456_789, codexTokens = 987_654_321): MonthlyMeasurement {
  return { month, claudeTokens, codexTokens, claudeCostUsd: 4321.09, codexCostUsd: 876.54, sessions: 77, unpricedTokens: 5555 };
}

type PutResult = { created: boolean; replaced: boolean };

function fakeStore(recorded: string[], put: (m: MonthlyMeasurement) => Promise<PutResult> = async () => ({ created: true, replaced: false })) {
  const puts: Array<{ measurement: MonthlyMeasurement; measuredOn: string; replaceNote?: string }> = [];
  const store: UsageSnapshotStore = {
    listMonths: async () => recorded,
    putMeasured: async (m, measuredOn, options) => {
      puts.push({ measurement: m, measuredOn, replaceNote: options?.replaceNote });
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

  test("저장소가 이미 있는 달이라고 하면 EXISTS 이고 종료 코드는 0 이다", async () => {
    const rows = [measurement("2026-02")];
    const { store } = fakeStore(["2026-01"], async () => ({ created: false, replaced: false }));

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
      listMonths: async () => { throw new Error("사용량 파일이 계약과 다르다: /example/snapshots.json"); },
      putMeasured: async () => ({ created: true, replaced: false }),
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
    ).rejects.toThrow("사용량 파일이 계약과 다르다");
    expect(state.calls).toBe(0);
    expect(lines).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("한 달의 올리기가 실패해도 남은 달을 올리고 종료 코드는 1 이다", async () => {
    const rows = [measurement("2025-12"), measurement("2026-01"), measurement("2026-02")];
    const { store, puts } = fakeStore(["2025-12"], async (m) => {
      if (m.month === "2026-01") throw new Error("디스크에 쓰지 못했다.");
      return { created: true, replaced: false };
    });

    const result = await run(store, fakeMeasure(rows).measure, "2026-03-15T00:00:00Z");

    expect(puts.map((p) => p.measurement.month)).toEqual(["2026-01", "2026-02"]);
    expect(result.lines).toEqual(["2026-01 FAILED", "2026-02 CREATED"]);
    expect(result.exitCode).toBe(1);
    expectQuietLines(result.lines, rows);
  });

  test("쓰기가 실패하면 표준 출력에는 FAILED 를, 표준 오류에는 달과 원인 한 줄을 낸다", async () => {
    const rows = [measurement("2026-02")];
    const { store } = fakeStore(["2026-01"], async () => {
      throw new Error("디스크에 쓰지 못했다.");
    });

    const result = await run(store, fakeMeasure(rows).measure, "2026-03-15T00:00:00Z");

    expect(result.lines).toEqual(["2026-02 FAILED"]);
    expect(result.errors).toEqual(["2026-02 디스크에 쓰지 못했다."]);
    expect(result.exitCode).toBe(1);
    expectQuietLines(result.lines, rows);
  });

  test("replace 로 준 달은 기록이 있어도 대상에 넣고 사유와 함께 저장소에 넘겨 REPLACED 를 낸다", async () => {
    const rows = [measurement("2026-01"), measurement("2026-02")];
    const { store, puts } = fakeStore(["2026-01", "2026-02"], async () => ({ created: false, replaced: true }));
    const lines: string[] = [];
    const result = await collectUsage({
      store,
      measure: fakeMeasure(rows).measure,
      now: new Date("2026-03-15T00:00:00Z"),
      write: (line) => lines.push(line),
      writeError: () => {},
      replace: { month: "2026-02", note: "다른 기기 합계를 더했다" },
    });
    expect(puts.map((put) => [put.measurement.month, put.replaceNote])).toEqual([["2026-02", "다른 기기 합계를 더했다"]]);
    expect(lines).toEqual(["2026-02 REPLACED"]);
    expect(result.exitCode).toBe(0);
  });
});

describe("파일 저장소로 수집하기", () => {
  test("빈 파일에서 실행하면 가장 최근에 끝난 달이 파일에 생기고, 다시 실행하면 UP_TO_DATE 다", async () => {
    const directory = mkdtempSync(join(tmpdir(), "collect-usage-"));
    try {
      const file = join(directory, "usage", "snapshots.json");
      const store = createUsageFileStore(file);
      const rows = [measurement("2026-01"), measurement("2026-02")];

      const first = await run(store, fakeMeasure(rows).measure, "2026-03-15T00:00:00Z");
      expect(first.lines).toEqual(["2026-02 CREATED"]);
      const saved = JSON.parse(readFileSync(file, "utf8")) as { schemaVersion: number; snapshots: Array<Record<string, unknown>> };
      expect(saved.schemaVersion).toBe(1);
      expect(saved.snapshots).toEqual([{ ...rows[1], measuredOn: "2026-03-15", source: "MEASURED" }]);

      const second = await run(store, fakeMeasure([measurement("2026-02", 1, 1)]).measure, "2026-03-15T00:00:00Z");
      expect(second.lines).toEqual(["- UP_TO_DATE"]);
      expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(saved);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

test("--merge 로 받은 파일이 측정 스크립트 명령의 인자로 넘어간다", () => {
  const parsed = parseCollectArguments(["--merge", "a.json", "--merge", "b.json"], new Date("2026-03-15T00:00:00Z"));
  expect(agentUsageCommand(mergeScriptArguments(parsed.merge))).toEqual(["python3", "-", "--json", "--merge", "a.json", "--merge", "b.json"]);
  expect(agentUsageCommand()).toEqual(["python3", "-", "--json"]);
});

test("replace 로 준 달에 세션 기록이 없으면 바꾸지 않고 오류 줄과 함께 1 로 끝난다", async () => {
  const { store, puts } = fakeStore(["2026-01", "2026-02"]);
  const errors: string[] = [];
  const lines: string[] = [];
  const result = await collectUsage({
    store,
    measure: fakeMeasure([measurement("2026-01")]).measure,
    now: new Date("2026-03-15T00:00:00Z"),
    write: (line) => lines.push(line),
    writeError: (line) => errors.push(line),
    replace: { month: "2026-02", note: "사유" },
  });
  expect(puts).toHaveLength(0);
  expect(lines).toEqual(["2026-02 NO_SESSIONS"]);
  expect(errors).toEqual(["2026-02 세션 기록이 없어 기록을 바꾸지 않았다."]);
  expect(result.exitCode).toBe(1);
});

test("replace 로 가장 오래된 기록보다 앞의 달을 주면 측정하지 않고 거절한다", async () => {
  const { store, puts } = fakeStore(["2026-02"]);
  const { measure, state } = fakeMeasure([measurement("2026-01")]);
  await expect(
    collectUsage({ store, measure, now: new Date("2026-03-15T00:00:00Z"), write: () => {}, writeError: () => {}, replace: { month: "2026-01", note: "사유" } }),
  ).rejects.toThrow(CollectUsageArgumentError);
  expect(state.calls).toBe(0);
  expect(puts).toHaveLength(0);
});

describe("parseCollectArguments", () => {
  const now = new Date("2026-03-15T00:00:00Z");

  test("--merge 는 여러 번 받고 --replace 는 끝난 달과 사유를 함께 받는다", () => {
    expect(parseCollectArguments([], now)).toEqual({ merge: [] });
    expect(parseCollectArguments(["--merge", "a.json", "--merge", "b.json"], now)).toEqual({ merge: ["a.json", "b.json"] });
    expect(parseCollectArguments(["--replace", "2026-02", "--note", " 다른 기기 합계를 더했다 "], now)).toEqual({
      merge: [],
      replace: { month: "2026-02", note: "다른 기기 합계를 더했다" },
    });
  });

  test.each([
    [["--replace", "2026-2", "--note", "사유"]],
    [["--replace", "2026-03", "--note", "사유"]],
    [["--replace", "2026-02"]],
    [["--replace", "2026-02", "--note", "  "]],
    [["--note", "사유"]],
    [["--merge"]],
    [["--unknown", "x"]],
    [["extra"]],
  ] as Array<[string[]]>)("%j 는 거절한다", (args) => {
    expect(() => parseCollectArguments(args, now)).toThrow(CollectUsageArgumentError);
  });
});

test("수집기와 차트 CLI 는 커리어 Backend client 를 import 하지 않는다", () => {
  for (const name of ["collect_usage.ts", "render_chart.ts", "usage_file.ts", "measure.ts"]) {
    const source = readFileSync(join(import.meta.dir, name), "utf8");
    expect({ name, hit: /profile\/client|career-backend|CAREER_BACKEND/.test(source) }).toEqual({ name, hit: false });
  }
});
