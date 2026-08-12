import { describe, expect, test } from "bun:test";
import { buildMorningMarkdown } from "./markdown.js";

describe("아침 읽을거리 마크다운", () => {
  test("외부 읽을거리를 먼저 보여주고 백엔드 후보를 분리한다", () => {
    const markdown = buildMorningMarkdown(
      [{ key: "backend", title: "백엔드 후보", whyNow: ["개념 요약", "학습 이유"] }],
      [{ key: "blog", title: "기술 블로그", whyNow: ["글 요약", "읽는 이유"] }],
      [{ key: "ai", title: "AI 글", whyNow: ["AI 요약", "AI 이유"] }],
      [{ key: "geek", title: "GeekNews 글", whyNow: ["동향 요약", "동향 이유"] }],
      [],
      "ok",
      {
        uncoveredCurated: 0,
        remainingLive: 0,
        remainingLiveCandidates: 0,
        techBlogItems: 1,
        aiTopicItems: 1,
        geekNewsItems: 1,
        scannedMarkdownCount: 0,
        possibleDuplicates: 0,
      }
    );

    expect(markdown.indexOf("## 회사·엔지니어링 기술 블로그"))
      .toBeLessThan(markdown.indexOf("## 에이전트가 제안한 백엔드 공부 후보"));
    expect(markdown.indexOf("## GeekNews와 개발 동향"))
      .toBeLessThan(markdown.indexOf("## 에이전트가 제안한 백엔드 공부 후보"));
    expect(markdown).toContain("간단한 요약: 글 요약");
    expect(markdown).toContain("추천 이유: 읽는 이유");
  });
});
