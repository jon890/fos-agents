import { expect, test } from "bun:test";
import { morningHtmlFilename } from "../study-topic-recommender/render/html.ts";
import { reportIdForMorningReading } from "../study-topic-recommender/study-library/recommendations.ts";
import type { MorningReadingReport } from "../study-topic-recommender/reading_contracts.ts";
import {
  ceilDaysUntil,
  formatSeoulDateTime,
  formatSeoulDisplayTime,
  formatSeoulIsoDate,
  parseDateOrNull,
} from "./date-format.ts";

test("날짜 유틸은 입력 offset을 한국 시각으로 바꾸며 현재 시각에 의존하지 않는다", () => {
  const value = new Date("2026-08-13T15:00:00Z");
  expect(formatSeoulDateTime(value)).toBe("2026. 08. 14. 00:00");
  expect(formatSeoulDisplayTime("2026-08-13T15:00:00Z")).toEqual({
    short: "08.14 00:00",
    full: "2026.08.14 00:00 KST",
  });
  expect(formatSeoulDisplayTime("2026-08-14T00:00:00+09:00")).toEqual(
    formatSeoulDisplayTime("2026-08-13T15:00:00Z"),
  );
  expect(formatSeoulIsoDate("2026-08-13")).toBe("2026-08-13");
  expect(formatSeoulDateTime(value)).toBe(formatSeoulDateTime(value));
  expect(value.toISOString()).toBe("2026-08-13T15:00:00.000Z");
});

test("표시 함수마다 기존 빈값·invalid 동작을 유지한다", () => {
  for (const value of ["", "invalid"]) {
    expect(formatSeoulDisplayTime(value)).toEqual({ short: "확인 필요", full: "확인 필요" });
    expect(() => formatSeoulIsoDate(value)).toThrow(`유효하지 않은 generatedAt: ${value}`);
  }
  expect(formatSeoulDateTime(new Date("invalid"))).toBe("Invalid Date");
});

test("두 아침 읽을거리 호출부는 한국 자정과 offset을 같은 날짜로 변환한다", () => {
  for (const [generatedAt, date] of [
    ["2026-08-13T14:59:59Z", "2026-08-13"],
    ["2026-08-13T15:00:00Z", "2026-08-14"],
    ["2026-08-14T00:00:00+09:00", "2026-08-14"],
  ]) {
    expect(morningHtmlFilename(generatedAt)).toBe(`morning-reading-${date}.html`);
    expect(reportIdForMorningReading({ generatedAt } as MorningReadingReport)).toBe(
      `morning-${date}`,
    );
  }
});

test("두 날짜 호출부의 빈값과 잘못된 입력 오류를 보존한다", () => {
  for (const generatedAt of ["", "invalid"]) {
    expect(() => morningHtmlFilename(generatedAt)).toThrow(
      `유효하지 않은 generatedAt: ${generatedAt}`,
    );
    expect(() => reportIdForMorningReading({ generatedAt } as MorningReadingReport)).toThrow(
      `유효하지 않은 generatedAt: ${generatedAt}`,
    );
  }
});

test("날짜 파싱과 남은 날짜 계산은 기준 시각을 주입받는다", () => {
  expect(parseDateOrNull("2026-09-12T12:00:00Z")?.toISOString()).toBe("2026-09-12T12:00:00.000Z");
  expect(parseDateOrNull("")).toBeNull();
  expect(parseDateOrNull("invalid")).toBeNull();
  expect(ceilDaysUntil(new Date("2026-09-12T12:00:00Z"), new Date("2026-09-10T13:00:00Z"))).toBe(2);
});
