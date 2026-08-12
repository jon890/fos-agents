import { describe, expect, test } from "bun:test";
import { extractPageLinks } from "./page.js";

describe("페이지 읽을거리 어댑터", () => {
  test("같은 호스트의 본문 링크만 등록 순서대로 수집한다", () => {
    const html = `
      <nav><a href="/">Home</a></nav>
      <a href="/posts/one"><strong>분산 시스템 장애 복구기</strong></a>
      <a href="https://outside.example/posts/two">외부 글</a>
      <a href="/posts/three">데이터 파이프라인 운영 개선</a>
    `;
    expect(extractPageLinks(html, "https://example.com/blog", 8)).toEqual([
      {
        title: "분산 시스템 장애 복구기",
        url: "https://example.com/posts/one",
        published: "",
        kind: "page-link",
      },
      {
        title: "데이터 파이프라인 운영 개선",
        url: "https://example.com/posts/three",
        published: "",
        kind: "page-link",
      },
    ]);
  });
});
