import { describe, expect, test } from "bun:test";
import { isLowSignalTitle, parseFeed } from "./feed.js";

describe("외부 피드 글 선택", () => {
  test("행사 일정은 결정적 저신호 항목으로 분류한다", () => {
    expect(isLowSignalTitle("Postgres Summit 2026 Schedule is now live")).toBe(true);
    expect(isLowSignalTitle("PostgreSQL 19 beta release notes")).toBe(false);
  });

  test("YouTube Atom 피드의 영상 설명을 후보 근거로 읽는다", () => {
    const entries = parseFeed(`<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
        <entry>
          <title>에이전트와 도구를 연결하는 패턴</title>
          <link rel="alternate" href="https://www.youtube.com/watch?v=example" />
          <published>2026-08-17T22:30:37+00:00</published>
          <media:group>
            <media:description>API, OAuth, MCP 방식을 비교합니다.</media:description>
          </media:group>
        </entry>
      </feed>`);

    expect(entries).toEqual([{
      title: "에이전트와 도구를 연결하는 패턴",
      link: "https://www.youtube.com/watch?v=example",
      published: "2026-08-17T22:30:37+00:00",
      description: "API, OAuth, MCP 방식을 비교합니다.",
    }]);
  });
});
