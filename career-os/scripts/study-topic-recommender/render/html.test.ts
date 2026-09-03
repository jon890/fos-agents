import { describe, expect, test } from "bun:test";
import { buildMorningHtml, morningHtmlFilename } from "./html.js";
import { morningReadingReportFixture } from "./test_fixture.js";

describe("아침 읽을거리 HTML", () => {
  test("공부 주제와 커리어 질문을 이스케이프해 렌더링한다", () => {
    const html = buildMorningHtml(morningReadingReportFixture);
    expect(html).toContain("운영 가능한 AI 제품");
    expect(html.indexOf("운영 가능한 AI 제품")).toBeLessThan(html.indexOf("관찰성"));
    expect(html).toContain("관찰성 &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("현재 업무 적용");
    expect(html).toContain("추천 이유");
  });

  test("HTTPS가 아닌 추천 URL을 거부한다", () => {
    const report = structuredClone(morningReadingReportFixture);
    report.topics[0].items[0].url = "http://example.com/insecure";
    expect(() => buildMorningHtml(report)).toThrow("HTTPS가 아닌 추천 URL");
  });

  test("KST 날짜로 게시 파일명을 만든다", () => {
    expect(morningHtmlFilename("2026-08-11T15:30:00.000Z"))
      .toBe("morning-reading-2026-08-12.html");
  });

  test("선택된 추천을 개수 제한 없이 모두 카드로 렌더링한다", () => {
    const report = structuredClone(morningReadingReportFixture);
    report.topics[0].items = Array.from({ length: 12 }, (_, index) => ({
      ...morningReadingReportFixture.topics[0].items[0],
      contentKey: `url:${index + 1}`,
      title: `읽을거리 ${index + 1}`,
      url: `https://example.com/article-${index + 1}`,
      canonicalUrl: `https://example.com/article-${index + 1}`,
    }));
    const html = buildMorningHtml(report);
    expect(html.match(/<article class="card">/g)?.length).toBe(12);
    expect(html).toContain("12개 자료");
    expect(html).toContain("읽을거리 12");
  });

  test("추천이 비면 명시적인 빈 상태를 보여준다", () => {
    const report = structuredClone(morningReadingReportFixture);
    report.topics = [];
    const html = buildMorningHtml(report);
    expect(html).toContain("오늘은 새로운 추천이 없습니다");
    expect(html).not.toContain("https://example.com/article");
  });
});
