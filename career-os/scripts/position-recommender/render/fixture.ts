import { buildPostingCandidatePool } from "../live-postings/candidate_pool.ts";
import type { PostingCandidate } from "../live-postings/contracts.ts";
import type { CollectionDiagnostics, Posting } from "../live-postings/types.ts";
import { RecommendationRun } from "../recommendation/schema.ts";
const posting: Posting = {
  source: "wanted",
  company: "예시 회사",
  title: "백엔드 개발자",
  url: "https://example.com/jobs/1",
  linkType: "direct_posting",
  postingStatus: "active",
  activeEvidence: "상세 상태 확인",
  openedAt: "",
  closesAt: "",
  daysUntilClose: "",
  closeUrgency: "no_deadline",
  category: "개발",
  summary: "",
  tags: [],
  skills: ["Java", "Spring"],
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
const postings = Array.from({ length: 11 }, (_, index): Posting => ({
  ...posting,
  company: `예시 회사 ${index + 1}`,
  title: index < 4 ? `백엔드 개발자 ${index + 1}` : `AI 플랫폼 백엔드 개발자 ${index + 1}`,
  url: `https://example.com/jobs/${index + 1}`,
  skills: index < 4 ? ["Java", "Spring"] : ["Java", "RAG"],
}));
export const { pool } = buildPostingCandidatePool(postings, diagnostics);

const tierSources = ["model", "manual", "default"] as const;

function companyTierProvenance(index: number) {
  const source = tierSources[index % tierSources.length];
  if (source !== "model") {
    return { companyTierSource: source, companyTierEvidenceUrls: [] as string[] };
  }
  return {
    companyTierSource: "model" as const,
    companyTierAssessmentId: `assessment-${index}`,
    companyTierAssessedAt: "2026-08-01T00:00:00.000Z",
    companyTierValidUntil: "2026-11-01",
    companyTierConfidence: "medium" as const,
    companyTierReason: "최근 투자 유치와 채용 확대 신호가 있다.",
    companyTierEvidenceUrls: ["https://example.com/news/1"],
  };
}

function positionItem(candidate: PostingCandidate, index: number) {
  return {
    candidateId: candidate.id,
    company: candidate.company,
    title: candidate.title,
    postingUrl: candidate.url,
    companyTier: 1 + (index % 3),
    ...companyTierProvenance(index),
    decision: index < 7 ? ("recommend" as const) : ("hold" as const),
    fitScore: 90 - index,
    label: index < 4 ? "우선 검토" : "경험 확장 후보",
    reason: index < 4 ? "백엔드 운영 경험과 맞는다." : "AI 서비스 운영 경험을 확장할 수 있다.",
    details: [
      {
        title: "회사와 역할",
        content: "성장 중인 제품의 핵심 백엔드를 맡을 가능성이 있다.",
        evidenceUrls: [candidate.url],
        assumptions: ["공고의 담당 범위가 입사 후에도 유지된다."],
      },
    ],
    nextActions: ["운영 사례 정리"],
  };
}

function rankedItem(candidate: PostingCandidate, index: number) {
  const { label: _label, ...item } = positionItem(candidate, index);
  return item;
}

export const run = RecommendationRun.parse({
  schemaVersion: 11,
  reportDate: "2026-08-13",
  generatedAt: "2026-08-13T09:00:00+09:00",
  summary: ["지원 검토 가치가 있다."],
  recommendations: pool.candidates
    .slice(0, 7)
    .map((candidate, index) => positionItem(candidate, index)),
  ranking: pool.candidates.map((candidate, index) => ({
    ...rankedItem(candidate, index),
    ...(index < 3 ? { note: "우선 검토 후보" } : {}),
  })),
  pendingCandidates: [],
  analysisSummary: {
    activeCount: pool.candidates.length,
    analyzedNowCount: 7,
    reusedCount: 4,
    pendingCount: 0,
    personalExcludedCount: 0,
  },
  companyTierSummary: {
    manualCount: pool.candidates.filter((_, index) => index % 3 === 1).length,
    modelCount: pool.candidates.filter((_, index) => index % 3 === 0).length,
    defaultCount: pool.candidates.filter((_, index) => index % 3 === 2).length,
    assessmentFailedCount: 0,
  },
  collectionHealth: {
    candidateCount: pool.candidates.length,
    configuredSourceCount: 1,
    warningSources: [],
  },
  nextActions: ["공고 확인", "관련 경험 정리"],
  sourceSnapshot: {
    collectionRunId: pool.collectionRunId,
  },
});
