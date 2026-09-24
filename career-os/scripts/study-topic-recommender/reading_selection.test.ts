import { describe, expect, test } from "bun:test";
import type { ReadingCandidatePool } from "./reading_contracts.ts";
import { validateReadingSelection } from "./reading_selection.ts";

const pool: ReadingCandidatePool = {
  generatedAt: "2026-09-28T00:00:00.000Z",
  recentStudyTopicKeys: [],
  policy: { selection: "llm", fixedKeywordsUsed: false, sourcePriorityUsed: false, maxCandidatesPerSource: 8 },
  collectionLog: [],
  candidates: [{
    id: "candidate-1", contentKey: "candidate-1", canonicalUrl: "https://example.com/1",
    sourceKey: "source-1", sourceName: "소스", category: "techBlog", title: "자료",
    url: "https://example.com/1", published: "2026-09-28", kind: "feed-article", previouslyRecommended: false,
  }],
};

function selected(candidateId: string) {
  return {
    topics: [{
      topicKey: "stable-selection", title: "안정적인 선택", careerQuestion: "어떤 판단을 적용할 수 있는가?",
      items: [{ candidateId, summary: "요약", reason: "이유", careerValue: "current-work" }],
    }],
  };
}

describe("읽을거리 선택의 제외 판정", () => {
  test("후보풀 밖의 제외 candidateId를 거부한다", () => {
    expect(validateReadingSelection({ ...selected("candidate-1"), rejections: [{ candidateId: "missing", reason: "범위 밖" }] }, pool))
      .toContain("수집 결과에 없는 제외 candidateId: missing");
  });

  test("추천 자료와 겹치는 제외 candidateId를 거부한다", () => {
    expect(validateReadingSelection({ ...selected("candidate-1"), rejections: [{ candidateId: "candidate-1", reason: "겹침" }] }, pool))
      .toContain("추천 자료와 제외 자료가 겹친다: candidate-1");
  });

  test("같은 제외 candidateId를 두 번 쓰면 거부한다", () => {
    expect(validateReadingSelection({ ...selected("candidate-1"), rejections: [
      { candidateId: "candidate-1", reason: "첫 판정" },
      { candidateId: "candidate-1", reason: "두 번째 판정" },
    ] }, pool)).toContain("중복 제외 candidateId: candidate-1");
  });
});
