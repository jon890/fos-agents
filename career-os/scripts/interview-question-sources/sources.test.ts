import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { interviewQuestionSources } from "../../config/interview-question-sources.ts";
import {
  buildStaticInterviewCandidates,
  collectInterviewSourceCandidatePool,
} from "./candidate_pool.ts";
import { activeInterviewQuestionSources, validateInterviewQuestionSources } from "./sources.ts";

describe("면접 질문 출처 설정", () => {
  test("등록된 공개 출처가 계약을 만족한다", () => {
    expect(validateInterviewQuestionSources(interviewQuestionSources)).toEqual([]);
  });

  test("블로그를 답변의 정답 근거로 등록하지 못한다", () => {
    expect(validateInterviewQuestionSources({
      _meta: { purpose: "테스트 출처", schemaVersion: 1 },
      sources: [{
        key: "blog",
        title: "기술 블로그",
        sourceClass: "engineering-practice",
        usages: ["answer-authority"],
        topics: ["system-design"],
        url: "https://example.com/blog",
        adapter: "page",
      }],
    })[0]).toContain("official-reference");
  });

  test("GitHub 가이드는 원문 루트 한 건으로 후보에 올린다", () => {
    const sources = activeInterviewQuestionSources(interviewQuestionSources);
    const candidates = buildStaticInterviewCandidates(sources);
    expect(candidates.map((candidate) => candidate.sourceKey)).toContain("system-design-primer");
    expect(candidates.map((candidate) => candidate.sourceKey)).toContain("vllm-docs");
    expect(candidates.every((candidate) => candidate.kind === "source-root")).toBe(true);
  });

  test("동적 feed 출처를 읽을거리 입력 배열로 수집한다", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "interview-question-sources."));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input) => {
      expect(String(input)).toBe("https://example.com/feed.xml");
      return new Response(`<?xml version="1.0"?><rss><channel><item><title>동적 질문 출처</title><link>https://example.com/article</link><pubDate>Tue, 01 Sep 2026 00:00:00 GMT</pubDate><description>수집 설명</description></item></channel></rss>`, { status: 200 });
    }) as typeof fetch;

    try {
      const pool = await collectInterviewSourceCandidatePool({
        config: {
          _meta: { purpose: "동적 후보 수집 테스트", schemaVersion: 1 },
          sources: [{
            key: "dynamic-feed",
            title: "동적 feed",
            sourceClass: "official-reference",
            usages: ["answer-authority"],
            topics: ["system-design"],
            url: "https://example.com",
            feedUrl: "https://example.com/feed.xml",
            adapter: "feed",
          }],
        },
        cacheDir,
        maxCandidatesPerSource: 1,
        cacheTtlHours: 1,
        timeoutMs: 1_000,
      });

      expect(pool.candidates).toHaveLength(1);
      expect(pool.candidates[0]).toMatchObject({
        sourceKey: "dynamic-feed",
        sourceTitle: "동적 feed",
        sourceClass: "official-reference",
        usages: ["answer-authority"],
        topics: ["system-design"],
        title: "동적 질문 출처",
        url: "https://example.com/article",
        kind: "article",
      });
      expect(pool.collectionLog).toEqual([
        { sourceKey: "dynamic-feed", status: "collected", candidateCount: 1 },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });
});
