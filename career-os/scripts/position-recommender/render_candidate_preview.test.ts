import assert from "node:assert/strict";
import { test } from "node:test";
import { renderCandidatePreviewHtml } from "./render_candidate_preview.ts";
import type { RecommendationRunType } from "./recommendation_schema.ts";

const sampleRun: RecommendationRunType = {
  schemaVersion: 2,
  reportDate: "2026-06-21",
  generatedAt: "2026-06-21T15:00:00+09:00",
  conclusion: ["결론"],
  background: ["배경"],
  tiers: {
    strong: [
      {
        rank: 1,
        company: "카카오페이",
        title: "서버 개발자 - 결제 서비스",
        postingUrl: "https://kakaopay.career.greetinghr.com/ko/o/192129",
        exploreLink: "-",
        linkEvidenceLevel: "개별 공고 open 확인",
        postingPeriod: "상시/마감 미정",
        source: "kakaopay",
        closeDate: null,
        searchKeywords: ["Java", "Spring"],
        whyFit: "결제 정합성 경험과 잘 맞는다.",
        candidateEvidence: ["정합성 경험"],
        jdKeywords: ["결제"],
        companyUpside: { level: "강함", reason: "핀테크 업사이드" },
        welfareLearning: "학습 환경 좋음",
        techBlogSignal: "기술 블로그 있음",
        businessRisk: "도메인 갭",
        ambiguity: "팀 범위",
        prepAction: "정합성 사례 정리"
      }
    ],
    stretch: [
      {
        rank: 1,
        company: "토스뱅크",
        title: "Server Developer (수신)",
        postingUrl: "https://toss.im/career/job-detail?job_id=6613962003",
        exploreLink: "-",
        linkEvidenceLevel: "개별 공고 open 확인",
        postingPeriod: "상시/마감 미정",
        source: "toss-careers",
        closeDate: null,
        searchKeywords: ["Kotlin", "Spring"],
        whyFit: "트랜잭션 정합성을 어필할 수 있다.",
        candidateEvidence: ["이벤트 경계 경험"],
        jdKeywords: ["MSA"],
        companyUpside: { level: "강함", reason: "핀테크 업사이드" },
        welfareLearning: "학습 환경 좋음",
        techBlogSignal: "기술 블로그 있음",
        businessRisk: "Kotlin 갭",
        ambiguity: "Kotlin 비중",
        prepAction: "Kotlin 정리",
        stretchGap: "Kotlin 운영 근거 부족"
      }
    ],
    hold: [
      {
        company: "NAVER",
        title: "AI Applied Engineer",
        link: "https://recruit.navercorp.com/rcrt/view.do?annoId=30004993&lang=ko",
        reason: "마감 임박과 Agent 설계 갭 때문에 보류"
      }
    ]
  },
  additionalTargets: [],
  recentCheck: ["반복 점검"],
  weeklyActions: { apply: "지원", resume: "이력서", study: "학습" },
  sourceSnapshot: { collectionRunId: null, snapshotPath: "career-os/data/runtime/live-position-postings.md" }
};

test("candidate preview renders clickable posting links and tier labels", () => {
  const html = renderCandidatePreviewHtml(sampleRun, { limit: 10 });

  assert.match(html, /<a class="title" href="https:\/\/kakaopay\.career\.greetinghr\.com\/ko\/o\/192129"/);
  assert.match(html, /강력 추천/);
  assert.match(html, /도전 추천/);
  assert.match(html, /보류·주의/);
  assert.match(html, /target="_blank"/);
});

test("candidate preview applies limit to tiered position rows", () => {
  const html = renderCandidatePreviewHtml(sampleRun, { limit: 1 });

  assert.match(html, /카카오페이/);
  assert.doesNotMatch(html, /토스뱅크/);
  assert.doesNotMatch(html, /NAVER/);
});


test("candidate preview can render all live posting rows while excluding CTO and AI model research", () => {
  const snapshot = `# Live Posting Snapshot

- [케이존] CTO / Agentic AI 기술 총괄 리드
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - skills: React, TypeScript
  - main_tasks: Agentic AI 기술 총괄
  - url: https://www.wanted.co.kr/wd/369442
- [토스] AI Engineer (Model)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - main_tasks: AI model research and model training
  - url: https://toss.im/career/job-detail?job_id=7758217003
- [토스] Server Developer (Product)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - main_tasks: 토스의 유저가 매일 사용하는 여러 서비스를 개발해요. Product Chapter는 유저가 직접 사용하는 토스의 서비스를 개발해요.
  - url: https://toss.im/career/job-detail?job_id=4071141003
- [토스] Tech Lead (Server)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - main_tasks: 여러 시스템을 아우르는 기술적 비전과 아키텍처를 설계하고 조직 전체에 영향을 미치는 기술 방향을 제시해요.
  - url: https://toss.im/career/job-detail?job_id=7519850003
- [카카오페이] 서버 개발자 - 결제 서비스
  - source: kakaopay
  - posting_status: open
  - link_type: direct_posting
  - skills: Java, Spring Boot
  - main_tasks: 결제 승인, 취소, 매입 서버를 개발합니다.
  - url: https://kakaopay.career.greetinghr.com/ko/o/192129
`;

  const html = renderCandidatePreviewHtml(sampleRun, { postingsMarkdown: snapshot, limit: null });

  assert.match(html, /표시 후보 1개/);
  assert.match(html, /카카오페이/);
  assert.match(html, /결제 승인, 취소, 매입 서버를 개발합니다/);
  assert.match(html, /https:\/\/kakaopay\.career\.greetinghr\.com\/ko\/o\/192129/);
  assert.doesNotMatch(html, /CTO/);
  assert.doesNotMatch(html, /AI Engineer \(Model\)/);
  assert.doesNotMatch(html, /Server Developer \(Product\)/);
  assert.doesNotMatch(html, /Tech Lead \(Server\)/);
  assert.doesNotMatch(html, /토스뱅크/);
});
