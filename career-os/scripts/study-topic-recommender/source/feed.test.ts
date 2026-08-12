import { describe, expect, test } from "bun:test";
import { isLowSignalTitle } from "./feed.js";

describe("외부 피드 글 선택", () => {
  test("행사 일정은 결정적 저신호 항목으로 분류한다", () => {
    expect(isLowSignalTitle("Postgres Summit 2026 Schedule is now live")).toBe(true);
    expect(isLowSignalTitle("PostgreSQL 19 beta release notes")).toBe(false);
  });
});
