import { describe, expect, test } from "bun:test";
import type { MorningReadingReport } from "../reading_contracts.js";
import { buildMorningMarkdown } from "./markdown.js";

const report: MorningReadingReport = {
  generatedAt: "2026-08-12T00:00:00Z",
  sourceOfTruth: {
    config: "config/external-reading-sources.ts",
    collectedArticles: "state/reading-candidates.json",
  },
  counts: {
    activeSources: 18,
    sourcesWithCandidates: 17,
    collectedArticles: 120,
    techBlogSources: 11,
    geekSources: 7,
  },
  collectionLog: [],
  recommendations: {
    techBlog: [{
      sourceKey: "blog",
      sourceName: "기술 블로그",
      category: "techBlog",
      title: "운영 사례",
      url: "https://example.com/blog",
      published: "",
      summary: "글 요약",
      reason: "읽는 이유",
    }],
    geek: [{
      sourceKey: "geek",
      sourceName: "GeekNews",
      category: "geek",
      title: "개발 동향",
      url: "https://example.com/geek",
      published: "2026-08-12",
      summary: "동향 요약",
      reason: "동향 이유",
    }],
  },
};

describe("아침 읽을거리 마크다운", () => {
  test("외부 소스 추천만 카테고리별로 보여준다", () => {
    const markdown = buildMorningMarkdown(report);

    expect(markdown).toContain("## 회사·엔지니어링 기술 블로그");
    expect(markdown).toContain("## GeekNews와 개발 동향");
    expect(markdown).not.toContain("백엔드 공부 후보");
    expect(markdown).not.toContain("AI 실전");
    expect(markdown).toContain("간단한 요약: 글 요약");
    expect(markdown).toContain("추천 이유: 읽는 이유");
  });

  test("학습 시간과 난이도를 추정해서 표시하지 않는다", () => {
    const markdown = buildMorningMarkdown(report);

    expect(markdown).not.toContain("45분");
    expect(markdown).not.toContain("예상 학습 시간");
    expect(markdown).not.toContain("난이도: 중");
  });
});
