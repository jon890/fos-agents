import { describe, expect, test } from "bun:test";
import { assessReliability, buildSourceCatalogHtml } from "./render_source_catalog.js";
import type { ReadingSource } from "./reading_sources.js";

describe("읽을거리 소스 현황 리포트", () => {
  test("공식 원문과 링크 없는 큐레이션 주제를 구분한다", () => {
    const official: ReadingSource = {
      key: "official",
      category: "techBlog",
      title: "공식 기술 블로그",
      url: "https://example.com/blog",
      feedUrl: "https://example.com/feed",
    };
    const curated: ReadingSource = {
      key: "curated",
      category: "geek",
      title: "비교 학습 주제",
    };

    expect(assessReliability(official, { state: "ok" }, { state: "ok" }).grade)
      .toBe("높음");
    expect(assessReliability(curated, { state: "not-configured" }, { state: "not-configured" }).grade)
      .toBe("낮음");
  });

  test("HTML 값을 이스케이프하고 HTTPS 링크만 노출한다", () => {
    const source: ReadingSource = {
      key: "unsafe",
      category: "geek",
      title: "<script>alert(1)</script>",
      url: "http://example.com",
    };
    const assessment = assessReliability(
      source,
      { state: "not-configured" },
      { state: "not-configured" }
    );
    const html = buildSourceCatalogHtml({
      date: "2026-08-12",
      sources: [source],
      assessments: new Map([[source.key, assessment]]),
      pageProbes: new Map([[source.key, { state: "not-configured" }]]),
      feedProbes: new Map([[source.key, { state: "not-configured" }]]),
    });

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("http://example.com");
  });
});
