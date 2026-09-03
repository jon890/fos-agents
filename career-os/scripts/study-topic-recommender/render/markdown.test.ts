import { describe, expect, test } from "bun:test";
import { buildMorningMarkdown } from "./markdown.js";
import { morningReadingReportFixture } from "./test_fixture.js";

describe("아침 읽을거리 마크다운", () => {
  test("공부 주제와 커리어 질문을 자료보다 먼저 보여준다", () => {
    const markdown = buildMorningMarkdown(morningReadingReportFixture);
    expect(markdown.indexOf("운영 가능한 AI 제품")).toBeLessThan(markdown.indexOf("관찰성"));
    expect(markdown).toContain("생각해 볼 질문");
    expect(markdown).toContain("현재 업무 적용");
    expect(markdown).toContain("간단한 요약: 운영 장애를 설명한다.");
  });

  test("학습 시간과 난이도를 추정해서 표시하지 않는다", () => {
    const markdown = buildMorningMarkdown(morningReadingReportFixture);
    expect(markdown).not.toContain("예상 학습 시간");
    expect(markdown).not.toContain("난이도:");
  });

  test("추천이 비면 과거 자료를 채우지 않는다", () => {
    const report = structuredClone(morningReadingReportFixture);
    report.topics = [];
    const markdown = buildMorningMarkdown(report);
    expect(markdown).toContain("오늘 새로 추천할 만한 자료를 찾지 못했다.");
    expect(markdown).not.toContain("https://example.com/article");
  });
});
