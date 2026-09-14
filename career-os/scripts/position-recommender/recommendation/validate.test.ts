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

function envelope(candidateIds: string[]) {
  return {
    schemaVersion: 6 as const,
    reportDate: "2026-08-13",
    generatedAt: "2026-08-13T09:00:00+09:00",
    conclusion: ["결론"],
    background: ["배경"],
    tiers: { strong: [] as Record<string, unknown>[], stretch: [], hold: [] },
    evaluatedCandidateIds: candidateIds,
    autoExclusionSuggestions: [] as Record<string, unknown>[],
    additionalTargets: [],
    recentCheck: ["확인"],
    weeklyActions: { apply: "지원", resume: "수정", study: "학습" },
    sourceSnapshot: { collectionRunId: "run-1", candidatePoolPath: "pool.json" },
  };
}

test("모델이 후보풀에 없는 공고를 추천하지 못하게 막는다", () => {
  const { pool } = buildPostingCandidatePool([posting], diagnostics);
  const candidate = pool.candidates[0];
  const raw = envelope([candidate.id]);
  raw.tiers.strong = [
    {
      candidateId: "wanted:missing",
      rank: 1,
      company: candidate.company,
      title: candidate.title,
      postingUrl: candidate.url,
      exploreLink: "-",
      linkEvidenceLevel: "개별 공고 active 확인",
      postingPeriod: "상시",
      source: candidate.source,
      closeDate: null,
      whyFit: "적합",
      candidateEvidence: ["경험"],
      jdKeywords: ["Java"],
      companyAssessment: {
        summary: "이 역할에서 중요한 모듈을 맡을 가능성이 있다.",
        confidence: "medium",
        findings: [
          {
            kind: "inference",
            topic: "role-ownership",
            statement: "공고의 담당 업무에서 설계 소유 가능성을 읽었다.",
            evidenceUrls: [candidate.url],
            assumptions: ["공고의 역할 범위가 실제 팀 운영과 같다."],
            confidence: "medium",
          },
        ],
      },
      openQuestions: [],
      prepAction: "준비",
    },
  ];
  const run = RecommendationRun.parse(raw);
  expect(validateRecommendationAgainstPool(run, pool)).toContain(
    "후보풀에 없는 공고 ID: wanted:missing",
  );
});

test("검토한 후보 목록에서 누락된 공고를 검출한다", () => {
  const secondPosting = { ...posting, title: "플랫폼 개발자", url: "https://example.com/jobs/2" };
  const { pool } = buildPostingCandidatePool([posting, secondPosting], diagnostics);
  const run = RecommendationRun.parse(envelope([pool.candidates[0].id]));
  expect(
    validateRecommendationAgainstPool(run, pool).some((error) =>
      error.includes("검토한 후보 목록에서 1개 공고가 누락됐다"),
    ),
  ).toBe(true);
});

test("자동 제외는 고정 축 대신 판단 근거를 받고 회사 제외만 근거 둘을 요구한다", () => {
  const base = envelope(["wanted:example"]);
  base.autoExclusionSuggestions = [
    {
      candidateId: "wanted:example",
      scope: "posting",
      reason: "공고가 원하는 역할 소유권과 맞지 않는다.",
      evidenceUrls: ["https://example.com/jobs/1"],
      confidence: "medium",
    },
  ];
  expect(RecommendationRun.safeParse(base).success).toBe(true);
  const company = structuredClone(base);
  company.autoExclusionSuggestions[0].scope = "company";
  expect(RecommendationRun.safeParse(company).success).toBe(false);
  (company.autoExclusionSuggestions[0].evidenceUrls as string[]).push(
    "https://example.com/company",
  );
  expect(RecommendationRun.safeParse(company).success).toBe(true);
});
