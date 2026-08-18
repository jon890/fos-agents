import { describe, expect, test } from "bun:test";
import {
  normalizeReadingSources,
  parseReadingSourcesConfig,
  validateReadingSources,
} from "./reading_sources.js";

function config(sources: unknown[]) {
  return {
    _meta: {
      purpose: "테스트 외부 읽을거리 소스",
      schemaVersion: 5,
    },
    categories: {
      techBlog: { slots: 2 },
      geek: { slots: 1 },
      ai: { slots: 1 },
      video: { slots: 1 },
    },
    sources,
  };
}

describe("외부 읽을거리 소스", () => {
  test("이전 스키마를 묵시적으로 보정하지 않는다", () => {
    expect(() => parseReadingSourcesConfig({
      techBlog: { items: [] },
      geek: { items: [] },
    })).toThrow("외부 읽을거리 설정 오류");
  });

  test("비활성 소스만 제외하고 등록 순서를 유지한다", () => {
    const normalized = normalizeReadingSources(config([
      { key: "later", title: "나중", category: "techBlog", url: "https://later.example.com" },
      { key: "first", title: "먼저", category: "techBlog", url: "https://first.example.com" },
      { key: "off", title: "끔", category: "techBlog", url: "https://off.example.com", enabled: false },
    ]));

    expect(normalized.itemsByCategory.techBlog.map((item) => item.key))
      .toEqual(["later", "first"]);
  });

  test("평문 HTTP URL을 거부한다", () => {
    const errors = validateReadingSources(config([
      { key: "bad", title: "잘못된 소스", category: "geek", url: "http://example.com" },
    ]));
    expect(errors.some((error) => error.includes("sources.0.url") && error.includes("HTTPS URL")))
      .toBe(true);
  });

  test("제목 누락을 key로 채우지 않고 거부한다", () => {
    const errors = validateReadingSources(config([
      { key: "missing-title", category: "geek", url: "https://example.com" },
    ]));
    expect(errors.some((error) => error.includes("sources.0.title"))).toBe(true);
  });
});
