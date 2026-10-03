import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatBillions, readTokensBadge, renderUsageChart, selectUsageBars, toTenths, type UsageBar } from "./chart.ts";

const fixtures = join(import.meta.dir, "fixtures");

/** `[claude, codex]` 를 소수 한 자리로 적은 값을 0.1B 정수로 바꾼다. */
function bars(rows: Array<[string, number, number]>): UsageBar[] {
  return rows.map(([month, claude, codex]) => ({
    month,
    claudeTenths: Math.round(claude * 10),
    codexTenths: Math.round(codex * 10),
  }));
}

const fixtureCases: Array<[string, UsageBar[]]> = [
  ["chart-two-months.svg", bars([["2031-01", 1.3, 11.6], ["2031-02", 18.9, 5.7]])],
  [
    "chart-six-months.svg",
    bars([
      ["2031-01", 0.4, 2.0],
      ["2031-02", 3.1, 0.9],
      ["2031-03", 7.7, 7.7],
      ["2031-04", 12.0, 0.1],
      ["2031-05", 20.5, 4.4],
      ["2031-06", 9.9, 30.2],
    ]),
  ],
  ["chart-codex-zero.svg", bars([["2031-01", 4.2, 0.0], ["2031-02", 6.0, 1.5]])],
  ["chart-claude-zero.svg", bars([["2031-01", 0.0, 3.3]])],
  ["chart-half-even.svg", bars([["2031-01", 0.3, 0.2]])],
];

describe("renderUsageChart", () => {
  test.each(fixtureCases)("%s 와 글자까지 같다", (file, input) => {
    expect(renderUsageChart(input)).toBe(readFileSync(join(fixtures, file), "utf8"));
  });

  test("막대가 없으면 던진다", () => {
    expect(() => renderUsageChart([])).toThrow(RangeError);
  });

  test("모든 막대가 0 이면 RangeError 를 던진다", () => {
    expect(() => renderUsageChart([{ month: "2031-01", claudeTenths: 0, codexTenths: 0 }])).toThrow(RangeError);
  });

  test("달별 합계 글자의 합이 전체 합계 표기와 같다", () => {
    const input = bars([["2031-01", 0.4, 2.0], ["2031-02", 3.1, 0.9], ["2031-03", 7.7, 7.7]]);
    const svg = renderUsageChart(input);
    const labelled = [...svg.matchAll(/font-size="15"[^>]*>(\d+\.\d)B</g)].map((match) => Math.round(Number(match[1]) * 10));
    const total = input.reduce((sum, bar) => sum + bar.claudeTenths + bar.codexTenths, 0);
    expect(labelled.reduce((sum, tenths) => sum + tenths, 0)).toBe(total);
    expect(formatBillions(total)).toBe("21.8B");
  });
});

describe("toTenths", () => {
  test("5천만 이상을 올린다", () => {
    expect(toTenths(1_349_999_999)).toBe(13);
    expect(toTenths(1_350_000_000)).toBe(14);
  });
});

describe("formatBillions", () => {
  test("소수 한 자리와 B 를 붙인다", () => {
    expect(formatBillions(979)).toBe("97.9B");
    expect(formatBillions(5)).toBe("0.5B");
    expect(formatBillions(1000)).toBe("100.0B");
  });
});

describe("selectUsageBars", () => {
  const records = [
    { month: "2031-01", claudeTokens: 1_300_000_000, codexTokens: 11_600_000_000 },
    { month: "2031-02", claudeTokens: 18_900_000_000, codexTokens: 5_700_000_000 },
  ];

  test("달을 정렬하고 겹친 달을 한 번만 쓴다", () => {
    const result = selectUsageBars(records, ["2031-02", "2031-01", "2031-02"]);
    expect(result.bars.map((bar) => bar.month)).toEqual(["2031-01", "2031-02"]);
    expect(result.missing).toEqual([]);
    expect(result.totalTenths).toBe(13 + 116 + 189 + 57);
  });

  test("기록에 없는 달은 missing 에 담고 막대에 넣지 않는다", () => {
    const result = selectUsageBars(records, ["2031-01", "2031-03"]);
    expect(result.bars.map((bar) => bar.month)).toEqual(["2031-01"]);
    expect(result.missing).toEqual(["2031-03"]);
    expect(result.totalTenths).toBe(129);
  });
});

describe("readTokensBadge", () => {
  test("배지 하나에서 값을 읽는다", () => {
    expect(readTokensBadge("![t](https://img.shields.io/badge/Tokens-97.9B-26d0ce)")).toBe("97.9B");
  });

  test("배지가 없으면 null 이다", () => {
    expect(readTokensBadge("# readme")).toBeNull();
  });

  test("배지가 둘이면 null 이다", () => {
    const badge = "https://img.shields.io/badge/Tokens-97.9B-26d0ce";
    expect(readTokensBadge(`${badge}\n${badge}`)).toBeNull();
  });

  test("소수 자리가 없으면 null 이다", () => {
    expect(readTokensBadge("https://img.shields.io/badge/Tokens-98B-26d0ce")).toBeNull();
  });
});

test("chart.ts 는 아무것도 import 하지 않는다", () => {
  expect(readFileSync(join(import.meta.dir, "chart.ts"), "utf8")).not.toMatch(/^import /m);
});
