import { describe, expect, test } from "bun:test";
import { buildMorningHtml, morningHtmlFilename } from "./html.js";

describe("study topic HTML renderer", () => {
  test("공개 가능한 추천만 이스케이프해 렌더링한다", () => {
    const html = buildMorningHtml({
      generatedAt: "2026-08-11T15:30:00.000Z",
      recommendations: [
        {
          key: "safe-topic",
          title: "관찰성 <script>alert(1)</script>",
          domain: "observability",
          whyNow: ["운영 장애를 설명한다"],
        },
      ],
      techBlogRecommendations: [
        { title: "HTTPS 글", url: "https://example.com/article" },
        { title: "HTTP 글", url: "http://example.com/insecure" },
      ],
      aiRecommendations: [],
      geekRecommendations: [],
      targetMinutes: 120,
      reviewStatus: "ok",
      updateExistingCount: 2,
    });

    expect(html).toContain("관찰성 &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("https://example.com/article");
    expect(html).not.toContain("http://example.com/insecure");
    expect(html).toContain("보강 대상으로 분류했습니다");
    expect(html.indexOf("회사 기술 블로그"))
      .toBeLessThan(html.indexOf("백엔드 공부 후보"));
    expect(html).toContain("추천 이유");
  });

  test("KST 날짜로 게시 파일명을 만든다", () => {
    expect(morningHtmlFilename("2026-08-11T15:30:00.000Z"))
      .toBe("morning-reading-2026-08-12.html");
  });
});
