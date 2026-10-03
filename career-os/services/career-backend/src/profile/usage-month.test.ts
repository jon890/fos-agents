import { describe, expect, it } from "vitest";

import { currentSeoulMonth, isEndedSeoulMonth, usageMonthPattern } from "./usage-month.js";

describe("isEndedSeoulMonth", () => {
  const cases: Array<[string, string, boolean, string]> = [
    ["2026-09-30T14:59:59Z", "2026-09", false, "Seoul 9월 30일 23:59 에는 9월이 아직 끝나지 않았다"],
    ["2026-09-30T15:00:00Z", "2026-09", true, "Seoul 10월 1일 00:00 에는 9월이 끝났다"],
    ["2026-09-30T15:00:00Z", "2026-10", false, "Seoul 의 이번 달은 끝나지 않았다"],
    ["2026-09-30T15:00:00Z", "2026-11", false, "미래의 달은 끝나지 않았다"],
    ["2026-12-31T15:00:00Z", "2026-12", true, "Seoul 2027년 1월 1일에는 해를 넘겨 12월이 끝났다"],
  ];

  for (const [now, month, expected, label] of cases) {
    it(`${label} (now=${now}, month=${month})`, () => {
      expect(isEndedSeoulMonth(month, new Date(now))).toBe(expected);
    });
  }

  it("UTC 로는 9월이어도 Seoul 이 10월이면 이번 달은 10월이다", () => {
    expect(currentSeoulMonth(new Date("2026-09-30T15:00:00Z"))).toBe("2026-10");
  });
});

describe("usageMonthPattern", () => {
  for (const value of ["2026-13", "2026-1", "26-01", "2026-00"]) {
    it(`${value} 를 거절한다`, () => {
      expect(usageMonthPattern.test(value)).toBe(false);
    });
  }

  for (const value of ["2026-01", "2026-12"]) {
    it(`${value} 를 받는다`, () => {
      expect(usageMonthPattern.test(value)).toBe(true);
    });
  }
});
