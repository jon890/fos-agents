import { describe, expect, test } from "bun:test";
import { resolveReadingSourceAdapter } from "./index.js";

describe("읽을거리 소스 어댑터", () => {
  test("명시한 어댑터를 우선 사용한다", () => {
    const adapter = resolveReadingSourceAdapter({
      key: "page",
      category: "techBlog",
      title: "페이지",
      url: "https://example.com",
      feedUrl: "https://example.com/feed",
      adapter: "page",
    });
    expect(adapter?.id).toBe("page");
  });

  test("설정이 없으면 feedUrl과 url 순으로 추론한다", () => {
    expect(resolveReadingSourceAdapter({
      key: "feed",
      category: "geek",
      title: "피드",
      url: "https://example.com",
      feedUrl: "https://example.com/feed",
    })?.id).toBe("feed");
    expect(resolveReadingSourceAdapter({
      key: "page",
      category: "geek",
      title: "페이지",
      url: "https://example.com",
    })?.id).toBe("page");
  });
});
