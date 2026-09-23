import { describe, expect, it } from "vitest";

import { todaySeoulIsoDate } from "./seoul-date.js";

describe("todaySeoulIsoDate", () => {
  it("UTC 로 전날인 시각도 Seoul 기준 날짜로 낸다", () => {
    expect(todaySeoulIsoDate(new Date("2026-09-22T15:00:00Z"))).toBe("2026-09-23");
  });

  it("Seoul 기준 하루가 끝나기 직전은 아직 같은 날이다", () => {
    expect(todaySeoulIsoDate(new Date("2026-09-22T14:59:59Z"))).toBe("2026-09-22");
  });

  it("해가 바뀌는 경계도 Seoul 기준으로 센다", () => {
    expect(todaySeoulIsoDate(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });

  it("시각이 아닌 값은 거부한다", () => {
    expect(() => todaySeoulIsoDate(new Date("있을 수 없는 시각"))).toThrow();
  });
});
