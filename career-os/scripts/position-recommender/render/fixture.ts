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

function positionItem(candidate: PostingCandidate, rank: number, isStretch = false) {
  return {
    candidateId: candidate.id,
    rank,
    company: candidate.company,
    title: candidate.title,
    postingUrl: candidate.url,
    exploreLink: "-",
    linkEvidenceLevel: "개별 공고 active 확인",
    postingPeriod: "마감 정보 없음",
    source: candidate.source,
    closeDate: null,
    whyFit: isStretch ? "AI 서비스 운영 경험을 확장할 수 있다." : "백엔드 운영 경험과 맞는다.",
    candidateEvidence: isStretch ? ["RAG 운영"] : ["Java 운영"],
    jdKeywords: isStretch ? ["Java", "RAG"] : ["Java", "Spring"],
    companyAssessment: {
      summary: "성장 중인 제품의 핵심 백엔드를 맡을 가능성이 있다.",
      confidence: "medium",
      findings: [
        {
          kind: "fact",
          topic: "domain-growth",
          statement: "공고가 대규모 트래픽 환경을 명시한다.",
          evidenceUrls: [candidate.url],
          assumptions: [],
          confidence: "high",
        },
        {
          kind: "inference",
          topic: "role-ownership",
          statement: "공통 구조와 운영 안정성을 개선할 여지가 있다.",
          evidenceUrls: [candidate.url],
          assumptions: ["공고의 담당 범위가 입사 후에도 유지된다."],
          confidence: "medium",
        },
      ],
    },
    openQuestions: ["팀이 설계 결정과 운영 지표를 어느 범위까지 소유하는지 확인한다."],
    prepAction: "운영 사례 정리",
    ...(isStretch ? { stretchGap: "대규모 플랫폼 운영 범위를 확인해야 한다." } : {}),
  };
}

export const run = RecommendationRun.parse({
  schemaVersion: 6,
  reportDate: "2026-08-13",
  generatedAt: "2026-08-13T09:00:00+09:00",
  conclusion: ["지원 검토 가치가 있다."],
  background: ["외부 공고 후보풀에서 선별했다."],
  tiers: {
    strong: pool.candidates
      .slice(0, 4)
      .map((candidate, index) => positionItem(candidate, index + 1)),
    stretch: pool.candidates
      .slice(4, 7)
      .map((candidate, index) => positionItem(candidate, index + 5, true)),
    hold: pool.candidates.slice(7).map((candidate) => ({
      company: candidate.company,
      title: candidate.title,
      link: candidate.url,
      reason: "역할 범위를 더 확인해야 한다.",
    })),
  },
  evaluatedCandidateIds: pool.candidates.map((candidate) => candidate.id),
  additionalTargets: [],
  recentCheck: ["중복 없음"],
  weeklyActions: { apply: "공고 확인", resume: "경험 정리", study: "기술 복기" },
  sourceSnapshot: {
    collectionRunId: pool.collectionRunId,
    candidatePoolPath: "state/posting-candidates.json",
  },
});
