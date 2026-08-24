import { expect, test } from "bun:test";
import { buildPostingCandidatePool } from "./live-postings/candidate_pool.ts";
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
  configuredSources: ["wanted"], serverOnly: true, wantedLimit: 120, includeTossArticles: false,
  sourceDiagnostics: [], errors: [],
};
const { pool } = buildPostingCandidatePool([posting], diagnostics);
const candidate = pool.candidates[0];
const run = RecommendationRun.parse({
  schemaVersion: 4, reportDate: "2026-08-13", generatedAt: "2026-08-13T09:00:00+09:00",
  conclusion: ["지원 검토 가치가 있다."], background: ["외부 공고 후보풀에서 선별했다."],
  tiers: { strong: [{
    candidateId: candidate.id, rank: 1, company: candidate.company, title: candidate.title,
    postingUrl: candidate.url, exploreLink: "-", linkEvidenceLevel: "개별 공고 active 확인",
    postingPeriod: "마감 정보 없음", source: candidate.source, closeDate: null, searchKeywords: ["Java"],
    whyFit: "백엔드 운영 경험과 맞는다.", candidateEvidence: ["Java 운영"], jdKeywords: ["Java", "Spring"],
    companyUpside: { level: "중간", reason: "추가 확인 필요" }, welfareLearning: "정보 없음",
    techBlogSignal: "정보 없음", businessRisk: "정보 없음", ambiguity: "팀 범위 확인 필요", prepAction: "운영 사례 정리",
  }], stretch: [], hold: [] },
  candidateRanking: [{ candidateId: candidate.id, rank: 1, oneLineReason: "Java·Spring 운영 경험이 역할과 직접 연결된다." }],
  additionalTargets: [], recentCheck: ["중복 없음"],
  weeklyActions: { apply: "공고 확인", resume: "경험 정리", study: "기술 복기" },
  sourceSnapshot: { collectionRunId: pool.collectionRunId, candidatePoolPath: "state/posting-candidates.json" },
});

test("추천 공고와 외부 후보풀을 같은 HTML에 표시한다", () => {
  const html = renderCandidatePreviewHtml(run, { candidatePool: pool, limit: null });
  expect(html).toContain("hero-card");
  expect(html).toContain("</strong><span>강력 추천");
  expect(html).toContain("전체 후보 적합도 순위");
  expect(html).toContain("Java·Spring 운영 경험이 역할과 직접 연결된다.");
  expect(html).toContain("candidate-filter");
  expect(html).toContain(".priority-grid{grid-template-columns:1fr}");
  expect(html).toContain("min-height:44px");
  expect(html).toContain("08.13 09:00 수집");
  expect(html).toContain(candidate.url);
  expect(html).toContain("백엔드 운영 경험과 맞는다.");
  expect(html).toContain(pool.collectionRunId);
  expect(html).not.toContain("<table");
  expect(html).not.toContain("min-width:900px");
});
