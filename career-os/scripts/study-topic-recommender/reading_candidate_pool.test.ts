import { describe, expect, test } from "bun:test";
import {
  type ReadingCandidatePool,
  validateReadingCandidatePool,
} from "./reading_candidate_pool.js";
import {
  deterministicFallbackSelection,
  recommendationsFromSelection,
  validateReadingSelection,
} from "./transform/reading_selection.js";
import { normalizeReadingSources } from "./reading_sources.js";

const sources = normalizeReadingSources({
  categories: {
    techBlog: { label: "기술 블로그", slots: 1, requireDiscoveredArticle: true },
    ai: { label: "AI", slots: 0, requireDiscoveredArticle: false },
    geek: { label: "동향", slots: 0, requireDiscoveredArticle: false },
  },
  sources: [
    { key: "a", title: "A", category: "techBlog" },
    { key: "b", title: "B", category: "techBlog" },
  ],
});

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
      estMinutes: 20,
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
      estMinutes: 20,
    },
  ],
  collectionLog: [],
};

describe("읽을거리 후보 풀", () => {
  test("고정 우선순위 대신 최신성과 출처 다양성으로 예비 선택한다", () => {
    const selection = deterministicFallbackSelection(pool, sources);
    expect(selection.selections.techBlog[0].candidateId).toBe("b:1");
  });

  test("모델 선택이 후보 풀을 벗어나면 거부한다", () => {
    const selection = {
      selections: {
        techBlog: [{ candidateId: "missing", summary: "요약", reason: "이유" }],
        ai: [],
        geek: [],
      },
    };
    expect(validateReadingSelection(selection, pool, sources))
      .toContain("후보 풀에 없는 candidateId: missing");
  });

  test("검증된 모델 선택을 추천 표시 모델로 변환한다", () => {
    const selection = {
      selections: {
        techBlog: [{ candidateId: "b:1", summary: "새 글 요약", reason: "오늘 읽을 이유" }],
        ai: [],
        geek: [],
      },
    };
    expect(validateReadingSelection(selection, pool, sources)).toEqual([]);
    const recommendations = recommendationsFromSelection(selection, pool);
    expect(recommendations.techBlog[0].whyNow).toEqual(["새 글 요약", "오늘 읽을 이유"]);
  });

  test("고정 키워드 사용을 선언한 후보 풀을 거부한다", () => {
    expect(validateReadingCandidatePool({
      ...pool,
      policy: { ...pool.policy, fixedKeywordsUsed: true },
    })).toContain("고정 키워드 사용은 허용하지 않는다.");
  });

  test("후보 풀의 런타임 타입 오류를 거부한다", () => {
    const invalidCandidate = {
      ...pool.candidates[0],
      recentlyRecommended: "false",
      estMinutes: 0,
    };
    const errors = validateReadingCandidatePool({
      ...pool,
      candidates: [invalidCandidate],
    });
    expect(errors).toContain("a:1.recentlyRecommended는 boolean이어야 한다.");
    expect(errors).toContain("a:1.estMinutes는 양의 정수여야 한다.");
  });
});
