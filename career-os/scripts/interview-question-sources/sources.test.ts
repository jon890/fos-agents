import { describe, expect, test } from "bun:test";
import { interviewQuestionSources } from "../../config/interview-question-sources.ts";
import { buildStaticInterviewCandidates } from "./candidate_pool.ts";
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
});
