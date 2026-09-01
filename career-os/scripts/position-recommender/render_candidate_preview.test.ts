import { expect, test } from "bun:test";
import { buildPostingCandidatePool } from "./live-postings/candidate_pool.ts";
import type { PostingCandidate } from "./live-postings/contracts.ts";
import type { CollectionDiagnostics, Posting } from "./live-postings/types.ts";
import { RecommendationRun } from "./recommendation_schema.ts";
import { renderCandidatePreviewHtml } from "./render_candidate_preview.ts";

const posting: Posting = {
  source: "wanted", company: "예시 회사", title: "백엔드 개발자", url: "https://example.com/jobs/1",
  linkType: "direct_posting", postingStatus: "active", activeEvidence: "상세 상태 확인", openedAt: "",
  closesAt: "", daysUntilClose: "", closeUrgency: "no_deadline", category: "개발", summary: "",
  tags: [], skills: ["Java", "Spring"], dueTime: "", mainTasks: "서버 개발", requirements: "Java", preferred: "",
};
const diagnostics: CollectionDiagnostics = {
  collectionRunId: "run-1", collectedAt: "2026-08-13T00:00:00.000Z", requestedSource: "all",
  configuredSources: ["wanted"], wantedLimit: 120, includeTossArticles: false,
  sourceDiagnostics: [], errors: [],
};
const postings = Array.from({ length: 11 }, (_, index): Posting => ({
  ...posting,
  company: `예시 회사 ${index + 1}`,
  title: index < 4 ? `백엔드 개발자 ${index + 1}` : `AI 플랫폼 백엔드 개발자 ${index + 1}`,
  url: `https://example.com/jobs/${index + 1}`,
  skills: index < 4 ? ["Java", "Spring"] : ["Java", "RAG"],
}));
const { pool } = buildPostingCandidatePool(postings, diagnostics);

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
    searchKeywords: isStretch ? ["RAG"] : ["Java"],
    whyFit: isStretch ? "AI 서비스 운영 경험을 확장할 수 있다." : "백엔드 운영 경험과 맞는다.",
    candidateEvidence: isStretch ? ["RAG 운영"] : ["Java 운영"],
    jdKeywords: isStretch ? ["Java", "RAG"] : ["Java", "Spring"],
    companyUpside: { level: "중간", reason: "추가 확인 필요" },
    welfareLearning: "정보 없음",
    techBlogSignal: "정보 없음",
    businessRisk: "정보 없음",
    ambiguity: "팀 범위 확인 필요",
    prepAction: "운영 사례 정리",
    ...(isStretch ? { stretchGap: "대규모 플랫폼 운영 범위를 확인해야 한다." } : {}),
  };
}

const run = RecommendationRun.parse({
  schemaVersion: 4, reportDate: "2026-08-13", generatedAt: "2026-08-13T09:00:00+09:00",
  conclusion: ["지원 검토 가치가 있다."], background: ["외부 공고 후보풀에서 선별했다."],
  tiers: {
    strong: pool.candidates.slice(0, 4).map((candidate, index) => positionItem(candidate, index + 1)),
    stretch: pool.candidates.slice(4, 7).map((candidate, index) => positionItem(candidate, index + 5, true)),
    hold: pool.candidates.slice(7).map((candidate) => ({
      company: candidate.company,
      title: candidate.title,
      link: candidate.url,
      reason: "역할 범위를 더 확인해야 한다.",
    })),
  },
  candidateRanking: pool.candidates.map((candidate, index) => ({
    candidateId: candidate.id,
    rank: index + 1,
    oneLineReason: index === 0
      ? "Java·Spring 운영 경험이 역할과 직접 연결된다."
      : `${candidate.title}의 역할 범위와 후보자 경험을 비교했다.`,
  })),
  additionalTargets: [], recentCheck: ["중복 없음"],
  weeklyActions: { apply: "공고 확인", resume: "경험 정리", study: "기술 복기" },
  sourceSnapshot: { collectionRunId: pool.collectionRunId, candidatePoolPath: "state/posting-candidates.json" },
});

test("추천 공고와 외부 후보풀을 같은 HTML에 표시한다", () => {
  const html = renderCandidatePreviewHtml(run, { candidatePool: pool, limit: null });
  expect(html.match(/<article class="hero-card /g)).toHaveLength(3);
  expect(html).toContain("<strong>7</strong><span class=\"recommendation-label\"><span>추천 공고</span><small>강력 4 · 도전 3</small>");
  expect(html).toContain("<h2>우선 검토</h2><span class=\"count\">상위 3건</span>");
  expect(html).toContain("<h2>추가 추천</h2><span class=\"count\">4건</span>");
  expect(html.match(/<article class="board-row tier-/g)).toHaveLength(8);
  expect(html).toContain("<h2>보류·주의</h2><span class=\"count\">4건</span>");
  expect(html).toContain("전체 후보 적합도 순위");
  expect(html).toContain("Java·Spring 운영 경험이 역할과 직접 연결된다.");
  expect(html).toContain("candidate-filter");
  expect(html).toContain(".candidate-row[hidden]{display:none}");
  expect(html).toContain(".priority-grid{grid-template-columns:1fr}");
  expect(html).toContain("min-height:44px");
  expect(html).toContain("08.13 09:00 수집");
  expect(html).toContain(pool.candidates[0].url);
  expect(html).toContain("백엔드 운영 경험과 맞는다.");
  expect(html).toContain(pool.collectionRunId);
  expect(html).not.toContain("<table");
  expect(html).not.toContain("min-width:900px");
});
