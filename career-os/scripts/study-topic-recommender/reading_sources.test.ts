import { describe, expect, test } from "bun:test";
import { normalizeReadingSources, toReadingSourcesV2, validateReadingSources } from "./reading_sources.js";

describe("외부 읽을거리 소스", () => {
  test("이전 카테고리 구조를 공통 소스 구조로 변환한다", () => {
    const converted = toReadingSourcesV2({
      techBlog: { items: [{ key: "blog", title: "블로그", url: "https://example.com" }] },
      ai: { items: [{ key: "ai", title: "AI" }] },
      geek: { items: [] },
    });

    expect(converted._meta.schemaVersion).toBe(2);
    expect(converted.sources[0].category).toBe("techBlog");
    expect(converted.sources[0].enabled).toBe(true);
    expect(validateReadingSources(converted)).toEqual([]);
  });

  test("비활성 소스만 제외하고 등록 순서를 유지한다", () => {
    const normalized = normalizeReadingSources({
      categories: {
        techBlog: { label: "기술 블로그", slots: 2, requireDiscoveredArticle: true },
        ai: { label: "AI", slots: 1, requireDiscoveredArticle: false },
        geek: { label: "동향", slots: 1, requireDiscoveredArticle: false },
      },
      sources: [
        { key: "later", title: "나중", category: "techBlog" },
        { key: "first", title: "먼저", category: "techBlog" },
        { key: "off", title: "끔", category: "techBlog", enabled: false },
      ],
    });

    expect(normalized.itemsByCategory.techBlog.map((item) => item.key))
      .toEqual(["later", "first"]);
  });

  test("평문 HTTP URL을 거부한다", () => {
    const converted = toReadingSourcesV2({
      sources: [{ key: "bad", title: "잘못된 소스", category: "ai", url: "http://example.com" }],
    });
    expect(validateReadingSources(converted)).toContain("bad.url는 HTTPS URL이어야 한다.");
  });
});
