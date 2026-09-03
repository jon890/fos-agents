import { describe, expect, test } from "bun:test";
import { type ReadingCandidatePool, validateReadingCandidatePool } from "./reading_candidate_pool.js";
import { topicsFromSelection, validateReadingSelection } from "./reading_selection.js";

const pool: ReadingCandidatePool = {
  generatedAt: "2026-08-12T00:00:00Z",
  recentStudyTopicKeys: [],
  policy: {
    selection: "llm",
    fixedKeywordsUsed: false,
    sourcePriorityUsed: false,
    maxCandidatesPerSource: 8,
  },
  candidates: [
    {
      id: "a:1",
      contentKey: "url:old",
      canonicalUrl: "https://example.com/old",
      sourceKey: "a",
      sourceName: "A",
      category: "techBlog",
      title: "이전에 추천한 글",
      url: "https://example.com/old",
      published: "2026-08-10",
      kind: "feed-article",
      previouslyRecommended: true,
    },
    {
      id: "b:1",
      contentKey: "url:new",
      canonicalUrl: "https://example.com/new",
      sourceKey: "b",
      sourceName: "B",
      category: "techBlog",
      title: "새 글",
      url: "https://example.com/new",
      published: "2026-08-12",
      kind: "feed-article",
      previouslyRecommended: false,
    },
  ],
  collectionLog: [],
};

function selection(candidateId: string) {
  return {
    topics: [{
      topicKey: "operable-ai-products",
      title: "운영 가능한 AI 제품",
      careerQuestion: "현재 서비스의 실패 복구에 어떤 판단을 적용할 수 있는가?",
      items: [{
        candidateId,
        summary: "운영 사례를 설명한다.",
        reason: "현재 업무의 복구 설계와 연결된다.",
        careerValue: "current-work" as const,
      }],
    }],
  };
}

describe("읽을거리 후보 풀", () => {
  test("모델 선택이 수집 결과를 벗어나면 거부한다", () => {
    expect(validateReadingSelection(selection("missing"), pool))
      .toContain("수집 결과에 없는 candidateId: missing");
  });

  test("이전에 추천한 후보를 다시 선택하면 거부한다", () => {
    expect(validateReadingSelection(selection("a:1"), pool))
      .toContain("이미 추천한 candidateId: a:1");
  });

  test("검증된 모델 선택을 공부 주제로 변환한다", () => {
    const selected = selection("b:1");
    expect(validateReadingSelection(selected, pool)).toEqual([]);
    expect(topicsFromSelection(selected, pool)[0]?.items[0]).toEqual({
      contentKey: "url:new",
      canonicalUrl: "https://example.com/new",
      sourceKey: "b",
      sourceName: "B",
      category: "techBlog",
      title: "새 글",
      url: "https://example.com/new",
      published: "2026-08-12",
      summary: "운영 사례를 설명한다.",
      reason: "현재 업무의 복구 설계와 연결된다.",
      careerValue: "current-work",
    });
  });

  test("추천할 새 자료가 없으면 빈 주제를 허용한다", () => {
    expect(validateReadingSelection({ topics: [] }, pool)).toEqual([]);
  });

  test("같은 후보를 여러 주제에 넣으면 거부한다", () => {
    const duplicated = selection("b:1");
    duplicated.topics.push(structuredClone(duplicated.topics[0]));
    expect(validateReadingSelection(duplicated, pool))
      .toContain("중복 candidateId: b:1");
  });

  test("직전 리포트와 같은 공부 주제를 다시 선택하면 거부한다", () => {
    expect(validateReadingSelection(selection("b:1"), {
      ...pool,
      recentStudyTopicKeys: ["operable-ai-products"],
    })).toContain("직전 리포트에서 추천한 topicKey: operable-ai-products");
  });

  test("같은 topicKey를 여러 번 사용하면 거부한다", () => {
    const duplicated = selection("b:1");
    duplicated.topics.push({
      ...structuredClone(duplicated.topics[0]),
      items: [{
        ...structuredClone(duplicated.topics[0].items[0]),
        candidateId: "a:1",
      }],
    });
    expect(validateReadingSelection(duplicated, pool))
      .toContain("중복 topicKey: operable-ai-products");
  });

  test("다른 candidateId가 같은 contentKey를 가지면 후보 풀을 거부한다", () => {
    const duplicateContent = {
      ...pool.candidates[1],
      id: "other:1",
    };
    expect(validateReadingCandidatePool({ ...pool, candidates: [pool.candidates[1], duplicateContent] }))
      .toContain("candidates.1.contentKey: 중복 contentKey: url:new");
  });

  test("고정 키워드 사용을 선언한 후보 풀을 거부한다", () => {
    expect(validateReadingCandidatePool({
      ...pool,
      policy: { ...pool.policy, fixedKeywordsUsed: true },
    }).some((error) => error.includes("policy.fixedKeywordsUsed"))).toBe(true);
  });

  test("직전 공부 주제 키가 중복된 후보 풀을 거부한다", () => {
    expect(validateReadingCandidatePool({
      ...pool,
      recentStudyTopicKeys: ["operable-ai-products", "operable-ai-products"],
    })).toContain("recentStudyTopicKeys.1: 중복 topicKey: operable-ai-products");
  });

  test("후보 풀의 런타임 타입 오류를 거부한다", () => {
    const invalidCandidate = { ...pool.candidates[0], previouslyRecommended: "false" };
    const errors = validateReadingCandidatePool({ ...pool, candidates: [invalidCandidate] });
    expect(errors.some((error) => error.includes("candidates.0.previouslyRecommended"))).toBe(true);
  });
});
