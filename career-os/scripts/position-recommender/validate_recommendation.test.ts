import { describe, expect, test } from "bun:test";
import { buildPostingCandidatePool } from "./live-postings/candidate_pool.ts";
import type { CollectionDiagnostics, Posting } from "./live-postings/types.ts";
import { RecommendationRun } from "./recommendation_schema.ts";
import { validateRecommendationAgainstPool } from "./validate_recommendation.ts";

const posting: Posting = {
  source: "wanted", company: "예시", title: "백엔드 개발자", url: "https://example.com/jobs/1",
  linkType: "direct_posting", postingStatus: "active", activeEvidence: "상세 API 상태 확인",
  openedAt: "", closesAt: "", daysUntilClose: "", closeUrgency: "no_deadline", category: "개발",
  summary: "", tags: [], skills: ["Java"], dueTime: "", mainTasks: "서버 개발", requirements: "Java", preferred: "",
};
const diagnostics: CollectionDiagnostics = {
  collectionRunId: "run-1", collectedAt: "2026-08-13T00:00:00.000Z", requestedSource: "all",
  configuredSources: ["wanted"], wantedLimit: 120, includeTossArticles: false,
  sourceDiagnostics: [], errors: [],
};

test("모델이 후보풀에 없는 공고를 추천하지 못하게 막는다", () => {
  const { pool } = buildPostingCandidatePool([posting], diagnostics);
  const candidate = pool.candidates[0];
  const run = RecommendationRun.parse({
    schemaVersion: 5, reportDate: "2026-08-13", generatedAt: "2026-08-13T09:00:00+09:00",
    conclusion: ["결론"], background: ["배경"],
    tiers: { strong: [{
      candidateId: "wanted:missing", rank: 1, company: candidate.company, title: candidate.title,
      postingUrl: candidate.url, exploreLink: "-", linkEvidenceLevel: "개별 공고 active 확인",
      postingPeriod: "상시", source: candidate.source, closeDate: null, searchKeywords: ["Java"],
      whyFit: "적합", candidateEvidence: ["경험"], jdKeywords: ["Java"],
      companyUpside: {
        level: "중간",
        reason: "추가 확인 필요",
        axes: [
          { axis: "문제의 난도", direction: "상향", reason: "공고가 대규모 트래픽 환경을 명시한다." },
          { axis: "오너십과 파는 깊이", direction: "확인 필요", reason: "팀의 문제 정의 범위가 공고에 없다." },
          { axis: "도메인 확장 여지", direction: "상향", reason: "인접 제품군이 여러 개다." },
          { axis: "보상", direction: "확인 필요", reason: "공고에 보상 구간이 없다." },
        ],
      },
      welfareLearning: "확인 필요",
      techBlogSignal: "확인 필요", businessRisk: "확인 필요", ambiguity: "확인 필요", prepAction: "준비",
    }], stretch: [], hold: [] },
    candidateRanking: [{ candidateId: candidate.id, rank: 1, upsideDirection: "확인 필요", oneLineReason: "Java 경험은 맞지만 추천 ID가 잘못됐다." }],
    additionalTargets: [], recentCheck: ["확인"],
    weeklyActions: { apply: "지원", resume: "수정", study: "학습" },
    sourceSnapshot: { collectionRunId: pool.collectionRunId, candidatePoolPath: "state/posting-candidates.json" },
  });
  expect(validateRecommendationAgainstPool(run, pool)).toContain("후보풀에 없는 공고 ID: wanted:missing");
});

test("전체 후보 순위에서 누락된 공고를 검출한다", () => {
  const secondPosting: Posting = {
    ...posting,
    title: "플랫폼 개발자",
    url: "https://example.com/jobs/2",
  };
  const { pool } = buildPostingCandidatePool([posting, secondPosting], diagnostics);
  const run = RecommendationRun.parse({
    schemaVersion: 5,
    reportDate: "2026-08-13",
    generatedAt: "2026-08-13T09:00:00+09:00",
    conclusion: ["결론"],
    background: ["배경"],
    tiers: { strong: [], stretch: [], hold: [] },
    candidateRanking: [{
      candidateId: pool.candidates[0].id,
      rank: 1,
      upsideDirection: "상향",
      oneLineReason: "Java 경험이 역할과 연결된다.",
    }],
    additionalTargets: [],
    recentCheck: ["확인"],
    weeklyActions: { apply: "지원", resume: "수정", study: "학습" },
    sourceSnapshot: { collectionRunId: pool.collectionRunId, candidatePoolPath: "state/posting-candidates.json" },
  });

  const errors = validateRecommendationAgainstPool(run, pool);
  expect(errors.some((error) => error.includes("전체 후보 순위에서 1개 공고가 누락됐다"))).toBe(true);
  expect(errors).toContain("전체 후보 순위는 1부터 2까지 중복 없이 이어져야 한다.");
});
