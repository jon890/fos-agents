import { describe, expect, test } from "bun:test";
import {
  type ReadingCandidatePool,
  validateReadingCandidatePool,
} from "./reading_candidate_pool.js";
import {
  recommendationsFromSelection,
  validateReadingSelection,
} from "./reading_selection.js";

const pool: ReadingCandidatePool = {
  generatedAt: "2026-08-12T00:00:00Z",
  policy: {
    selection: "llm",
    fixedKeywordsUsed: false,
    sourcePriorityUsed: false,
    maxCandidatesPerSource: 8,
  },
  candidates: [
    {
      id: "a:1",
      sourceKey: "a",
      sourceName: "A",
      category: "techBlog",
      title: "오래된 글",
      url: "https://example.com/old",
      published: "2026-08-10",
      kind: "feed-article",
      recentlyRecommended: false,
    },
    {
      id: "b:1",
      sourceKey: "b",
      sourceName: "B",
      category: "techBlog",
      title: "새 글",
      url: "https://example.com/new",
      published: "2026-08-12",
      kind: "feed-article",
      recentlyRecommended: false,
    },
  ],
  collectionLog: [],
};

describe("읽을거리 후보 풀", () => {
  test("모델 선택이 수집 결과를 벗어나면 거부한다", () => {
    const selection = {
      selections: {
        techBlog: [{ candidateId: "missing", summary: "요약", reason: "이유" }],
        geek: [],
        ai: [],
        video: [],
      },
    };
    expect(validateReadingSelection(selection, pool))
      .toContain("수집 결과에 없는 candidateId: missing");
  });

  test("검증된 모델 선택을 외부 글 추천으로 변환한다", () => {
    const selection = {
      selections: {
        techBlog: [{ candidateId: "b:1", summary: "새 글 요약", reason: "오늘 읽을 이유" }],
        geek: [],
        ai: [],
        video: [],
      },
    };
    expect(validateReadingSelection(selection, pool)).toEqual([]);
    const recommendations = recommendationsFromSelection(selection, pool);
    expect(recommendations.techBlog[0]).toEqual({
      sourceKey: "b",
      sourceName: "B",
      category: "techBlog",
      title: "새 글",
      url: "https://example.com/new",
      published: "2026-08-12",
      summary: "새 글 요약",
      reason: "오늘 읽을 이유",
    });
  });

  test("좋은 후보는 개수와 출처에 관계없이 모두 선택할 수 있다", () => {
    const selection = {
      selections: {
        techBlog: [
          { candidateId: "a:1", summary: "첫 글", reason: "첫 이유" },
          { candidateId: "a:2", summary: "둘째 글", reason: "둘째 이유" },
        ],
        geek: [],
        ai: [],
        video: [],
      },
    };
    const sameSourcePool: ReadingCandidatePool = {
      ...pool,
      candidates: [
        pool.candidates[0],
        {
          ...pool.candidates[0],
          id: "a:2",
          title: "다른 글",
          url: "https://example.com/another",
        },
      ],
    };
    expect(validateReadingSelection(selection, sameSourcePool)).toEqual([]);
  });

  test("고정 키워드 사용을 선언한 후보 풀을 거부한다", () => {
    expect(validateReadingCandidatePool({
      ...pool,
      policy: { ...pool.policy, fixedKeywordsUsed: true },
    }).some((error) => error.includes("policy.fixedKeywordsUsed"))).toBe(true);
  });

  test("후보 풀의 런타임 타입 오류를 거부한다", () => {
    const invalidCandidate = {
      ...pool.candidates[0],
      recentlyRecommended: "false",
    };
    const errors = validateReadingCandidatePool({
      ...pool,
      candidates: [invalidCandidate],
    });
    expect(errors.some((error) => error.includes("candidates.0.recentlyRecommended")))
      .toBe(true);
  });
});
