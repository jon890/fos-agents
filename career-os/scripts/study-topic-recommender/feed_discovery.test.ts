import { describe, expect, test } from "bun:test";
import { selectArticle } from "./feed_discovery.js";

describe("외부 피드 글 선택", () => {
  test("행사 일정 대신 기술 글을 선택한다", () => {
    const selected = selectArticle([
      {
        title: "Postgres Summit 2026 Schedule is now live",
        link: "https://example.com/summit",
        published: "2026-08-12",
      },
      {
        title: "PostgreSQL 19 beta release notes",
        link: "https://example.com/release",
        published: "2026-08-11",
      },
    ], ["postgres", "release"]);

    expect(selected?.link).toBe("https://example.com/release");
  });
});
