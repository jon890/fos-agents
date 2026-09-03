import { describe, expect, test } from "bun:test";
import { canonicalizeReadingUrl, readingContentKey } from "./url_identity.js";

describe("읽을거리 원문 식별", () => {
  test("YouTube 영상 URL 형식이 달라도 같은 contentKey를 만든다", () => {
    expect(readingContentKey("https://youtu.be/abc123?si=tracking"))
      .toBe(readingContentKey("https://www.youtube.com/watch?v=abc123&utm_source=test"));
    expect(readingContentKey("https://www.youtube.com/shorts/abc123"))
      .toBe("youtube:abc123");
  });

  test("일반 글의 추적 query와 fragment를 제거한다", () => {
    expect(canonicalizeReadingUrl("https://example.com/post/?b=2&utm_source=newsletter&a=1#section"))
      .toBe("https://example.com/post?a=1&b=2");
  });

  test("HTTPS가 아닌 URL을 거부한다", () => {
    expect(() => readingContentKey("http://example.com/post")).toThrow("HTTPS URL이어야 한다");
  });
});
