import { expect, test } from "bun:test";
import { buildPostingCandidatePool } from "../live-postings/candidate_pool.ts";
import type { CollectionDiagnostics, Posting } from "../live-postings/types.ts";
import { validateRecommendationAgainstPool } from "../validate_recommendation.ts";
import { RecommendationRun } from "./schema.ts";

const posting: Posting = {
  source: "wanted",
  company: "예시",
  title: "백엔드 개발자",
  url: "https://example.com/jobs/1",
  linkType: "direct_posting",
  postingStatus: "active",
  activeEvidence: "상세 API 상태 확인",
  openedAt: "",
  closesAt: "",
  daysUntilClose: "",
  closeUrgency: "no_deadline",
  category: "개발",
  summary: "서버 개발",
  tags: [],
  skills: ["Java"],
  dueTime: "",
  mainTasks: "서버 개발",
  requirements: "Java",
  preferred: "",
};

const diagnostics: CollectionDiagnostics = {
  collectionRunId: "run-1",
  collectedAt: "2026-08-13T00:00:00.000Z",
  requestedSource: "all",
  configuredSources: ["wanted"],
  wantedLimit: 120,
  includeTossArticles: false,
  sourceDiagnostics: [],
  errors: [],
};

function ranked(candidate: { id: string; company: string; title: string; url: string }) {
  return {
    candidateId: candidate.id,
    company: candidate.company,
    title: candidate.title,
    postingUrl: candidate.url,
    companyTier: 2,
    companyTierSource: "default" as const,
    companyTierEvidenceUrls: [] as string[],
    decision: "recommend" as const,
    fitScore: 80,
    reason: "적합하다.",
    details: [],
    nextActions: [],
  };
}

function envelope(
  recommendations: Record<string, unknown>[] = [],
  ranking: Record<string, unknown>[] = [],
) {
  return {
    schemaVersion: 11 as const,
    reportDate: "2026-08-13",
    generatedAt: "2026-08-13T09:00:00+09:00",
    summary: [] as string[],
    recommendations,
    ranking,
    pendingCandidates: [] as Record<string, unknown>[],
    analysisSummary: {
      activeCount: ranking.length,
      analyzedNowCount: ranking.length,
      reusedCount: 0,
      pendingCount: 0,
      personalExcludedCount: 0,
    },
    companyTierSummary: {
      manualCount: 0,
      modelCount: 0,
      defaultCount: ranking.length,
      assessmentFailedCount: 0,
    },
    collectionHealth: {
      candidateCount: ranking.length,
      configuredSourceCount: 1,
      warningSources: [],
    },
    nextActions: [] as string[],
    sourceSnapshot: { collectionRunId: "run-1" },
  };
}

test("후보풀에 없는 공고는 추천하지 못하게 막는다", () => {
  const { pool } = buildPostingCandidatePool([posting], diagnostics);
  const raw = envelope(
    [
      {
        candidateId: "wanted:missing",
        company: pool.candidates[0].company,
        title: pool.candidates[0].title,
        postingUrl: pool.candidates[0].url,
        reason: "적합하다.",
        companyTier: 2,
        companyTierSource: "default",
        companyTierEvidenceUrls: [],
        decision: "recommend",
        fitScore: 80,
        details: [],
        nextActions: [],
      },
    ],
    [
      {
        ...ranked(pool.candidates[0]),
        candidateId: "wanted:missing",
      },
    ],
  );
  const run = RecommendationRun.parse(raw);
  expect(validateRecommendationAgainstPool(run, pool)).toContain(
    "후보풀에 없는 추천 공고 ID: wanted:missing",
  );
});

test("추천 공고의 회사명과 공고명과 URL을 후보풀 원문에 대조한다", () => {
  const { pool } = buildPostingCandidatePool([posting], diagnostics);
  const candidate = pool.candidates[0];
  const run = RecommendationRun.parse(
    envelope(
      [
        {
          candidateId: candidate.id,
          company: "다른 회사",
          title: "다른 공고",
          postingUrl: "https://example.com/jobs/other",
          reason: "적합하다.",
          companyTier: 2,
          companyTierSource: "default",
          companyTierEvidenceUrls: [],
          decision: "recommend",
          fitScore: 80,
          details: [],
          nextActions: [],
        },
      ],
      [ranked(candidate)],
    ),
  );
  expect(validateRecommendationAgainstPool(run, pool)).toEqual([
    `${candidate.id}: 추천 공고 URL이 후보풀과 다르다.`,
    `${candidate.id}: 추천 회사명이 후보풀과 다르다.`,
    `${candidate.id}: 추천 공고명이 후보풀과 다르다.`,
  ]);
});

test("추천 분류와 상세 근거는 자유롭게 생략하거나 구성한다", () => {
  const { pool } = buildPostingCandidatePool([posting], diagnostics);
  const candidate = pool.candidates[0];
  const minimal = envelope(
    [
      {
        candidateId: candidate.id,
        company: candidate.company,
        title: candidate.title,
        postingUrl: candidate.url,
        reason: "운영 안정성과 공통 구조 경험을 확장할 수 있다.",
        companyTier: 2,
        companyTierSource: "default",
        companyTierEvidenceUrls: [],
        decision: "recommend",
        fitScore: 80,
        details: [],
        nextActions: [],
      },
    ],
    [ranked(candidate)],
  );
  expect(RecommendationRun.safeParse(minimal).success).toBe(true);
  const detailed = structuredClone(minimal);
  detailed.recommendations[0] = {
    ...detailed.recommendations[0],
    label: "지금 가장 검토할 포지션",
    details: [
      {
        title: "회사 성장과 역할",
        content: "공개 자료에서 확인한 사실을 토대로 중요한 모듈을 맡을 가능성을 판단했다.",
        evidenceUrls: [candidate.url],
        assumptions: ["공고의 역할 범위가 실제 팀에서도 유지된다."],
      },
    ],
  };
  expect(RecommendationRun.safeParse(detailed).success).toBe(true);
});

test("전체 순위는 후보풀의 모든 공고를 한 번씩 포함한다", () => {
  const second = {
    ...posting,
    title: "플랫폼 백엔드 개발자",
    url: "https://example.com/jobs/2",
  };
  const { pool } = buildPostingCandidatePool([posting, second], diagnostics);
  const run = RecommendationRun.parse(envelope([], [ranked(pool.candidates[0])]));
  expect(validateRecommendationAgainstPool(run, pool)).toContain(
    `순위와 분석 대기에서 빠진 공고 ID: ${pool.candidates[1].id}`,
  );
});

test("상세 추천은 전체 순위의 앞부분과 같은 순서를 사용한다", () => {
  const second = {
    ...posting,
    title: "플랫폼 백엔드 개발자",
    url: "https://example.com/jobs/2",
  };
  const { pool } = buildPostingCandidatePool([posting, second], diagnostics);
  const top = pool.candidates[0];
  expect(() =>
    RecommendationRun.parse(
      envelope(
        [
          {
            ...ranked(top),
            reason: "상세 검토할 가치가 있다.",
          },
        ],
        [ranked(pool.candidates[1]), ranked(top)],
      ),
    ),
  ).toThrow("상세 추천이 분석 순위 앞부분과 다릅니다");
});
