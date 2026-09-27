import { describe, expect, test } from "bun:test";
import {
  normalizeReadingSources,
} from "./reading_sources.js";

describe("외부 읽을거리 소스", () => {
  test("비활성 소스만 제외하고 등록 순서를 유지한다", () => {
    const normalized = normalizeReadingSources([
      { key: "later", title: "나중", category: "techBlog", url: "https://later.example.com" },
      { key: "first", title: "먼저", category: "techBlog", url: "https://first.example.com" },
      { key: "off", title: "끔", category: "techBlog", url: "https://off.example.com", enabled: false },
    ]);

    expect(normalized.itemsByCategory.techBlog.map((item) => item.key))
      .toEqual(["later", "first"]);
  });

});
