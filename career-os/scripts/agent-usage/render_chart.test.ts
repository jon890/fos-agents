import { describe, expect, test } from "bun:test";
import { UsageError } from "../lib/cli.ts";
import { renderUsageChart } from "./chart.ts";
import { renderChartCommand } from "./render_chart.ts";

const records = [
  { month: "2031-01", claudeTokens: 1_300_000_000, codexTokens: 11_600_000_000 },
  { month: "2031-02", claudeTokens: 18_900_000_000, codexTokens: 5_700_000_000 },
];

function spies() {
  const calls = { list: 0, writes: [] as Array<[string, string]> };
  return {
    calls,
    dependencies: {
      listSnapshots: async () => {
        calls.list += 1;
        return records;
      },
      write: async (path: string, text: string) => {
        calls.writes.push([path, text]);
      },
    },
  };
}

describe("renderChartCommand", () => {
  test("고른 달의 차트를 쓰고 합계를 돌려준다", async () => {
    const { calls, dependencies } = spies();
    const result = await renderChartCommand(["--months", "2031-01,2031-02", "--out", "out.svg"], dependencies);
    expect(result).toEqual({ total: "37.5B", months: ["2031-01", "2031-02"], out: "out.svg" });
    const expected = renderUsageChart([
      { month: "2031-01", claudeTenths: 13, codexTenths: 116 },
      { month: "2031-02", claudeTenths: 189, codexTenths: 57 },
    ]);
    expect(calls.writes).toEqual([["out.svg", expected]]);
  });

  test("기록에 없는 달이 있으면 쓰지 않고 그 달을 적어 던진다", async () => {
    const { calls, dependencies } = spies();
    await expect(renderChartCommand(["--months", "2031-01,2031-05", "--out", "out.svg"], dependencies)).rejects.toThrow("2031-05");
    expect(calls.writes).toEqual([]);
  });

  test.each([["2031-01,2031-02,2031-03,2031-04,2031-05,2031-06,2031-07"], ["2031-13"]])(
    "--months %s 는 기록을 읽기 전에 UsageError 로 끝낸다",
    async (months) => {
      const { calls, dependencies } = spies();
      await expect(renderChartCommand(["--months", months, "--out", "out.svg"], dependencies)).rejects.toThrow(UsageError);
      expect(calls.list).toBe(0);
    },
  );
});
