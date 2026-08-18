import { describe, expect, test } from "bun:test";
import type { MorningReadingReport } from "../reading_contracts.js";
import { buildMorningHtml, morningHtmlFilename } from "./html.js";

const baseReport: MorningReadingReport = {
  generatedAt: "2026-08-11T15:30:00.000Z",
  sourceOfTruth: {
    config: "config/external-reading-sources.ts",
    collectedArticles: "state/reading-candidates.json",
  },
  counts: {
    activeSources: 2,
    sourcesWithCandidates: 1,
    collectedArticles: 8,
    techBlogSources: 1,
    geekSources: 1,
    aiSources: 0,
    videoSources: 0,
  },
  collectionLog: [],
  recommendations: {
    techBlog: [{
      sourceKey: "safe",
      sourceName: "공식 블로그",
      category: "techBlog",
      title: "관찰성 <script>alert(1)</script>",
      url: "https://example.com/article",
      published: "",
      summary: "운영 장애를 설명한다.",
      reason: "현재 운영 관점과 연결된다.",
    }],
    geek: [],
    ai: [],
    video: [],
  },
};

describe("아침 읽을거리 HTML", () => {
  test("외부 추천만 이스케이프해 렌더링한다", () => {
    const html = buildMorningHtml(baseReport);

    expect(html).toContain("관찰성 &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("https://example.com/article");
    expect(html).not.toContain("백엔드 공부 후보");
    expect(html).not.toContain("예상 0분");
    expect(html).not.toContain("하루 학습 목표 120분");
    expect(html).toContain("추천 이유");
    expect(html).toContain("AI 공식 문서와 연구");
    expect(html).toContain("영상 추천");
  });

  test("HTTPS가 아닌 추천 URL을 거부한다", () => {
    const report = structuredClone(baseReport);
    report.recommendations.techBlog[0].url = "http://example.com/insecure";
    expect(() => buildMorningHtml(report)).toThrow("HTTPS가 아닌 추천 URL");
  });

  test("KST 날짜로 게시 파일명을 만든다", () => {
    expect(morningHtmlFilename("2026-08-11T15:30:00.000Z"))
      .toBe("morning-reading-2026-08-12.html");
  });

  test("선택된 추천을 개수 제한 없이 모두 카드로 렌더링한다", () => {
    const report = structuredClone(baseReport);
    report.recommendations.techBlog = Array.from({ length: 12 }, (_, index) => ({
      ...baseReport.recommendations.techBlog[0],
      title: `읽을거리 ${index + 1}`,
      url: `https://example.com/article-${index + 1}`,
    }));

    const html = buildMorningHtml(report);

    expect(html.match(/<article class="card">/g)?.length).toBe(12);
    expect(html).toContain("12개 추천");
    expect(html).toContain("읽을거리 12");
  });
});
