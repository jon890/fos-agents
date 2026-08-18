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

  test("카드 링크에서는 설명 대신 제목 요소를 사용한다", () => {
    const html = `
      <a href="/research/multiagent">
        <span>Aug 13, 2026</span>
        <h3>Patterns and problems in emerging multiagent systems</h3>
        <p>긴 연구 설명</p>
      </a>
    `;
    expect(extractPageLinks(html, "https://example.com/research", 8)[0]?.title)
      .toBe("Patterns and problems in emerging multiagent systems");
  });

  test("제목 클래스가 있는 목록에서는 날짜와 분류를 제외한다", () => {
    const html = `
      <a href="/research/multiagent">
        <time>Aug 13, 2026</time>
        <span class="publication-subject">Frontier Red Team</span>
        <span class="publication-title">Patterns and problems in emerging multiagent systems</span>
      </a>
    `;
    expect(extractPageLinks(html, "https://example.com/research", 8)[0]?.title)
      .toBe("Patterns and problems in emerging multiagent systems");
  });
});
