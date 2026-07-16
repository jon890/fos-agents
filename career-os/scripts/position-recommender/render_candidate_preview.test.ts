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
  sourceSnapshot: { collectionRunId: null, snapshotPath: "career-os/cache/live-position-postings.md" }
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

- collection_run_id: position-postings-2026-06-21T06:00:00.000Z
- collected_at: 2026-06-21T06:00:00.000Z

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
- [토스] Node.js Developer
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - main_tasks: 여러 계열사의 공고를 함께 보여주는 그룹 페이지입니다.
  - url: https://toss.im/career/job-detail?job_id=7734083003
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
- [씨제이올리브영(CJ올리브영)] Backend Engineer (광고/DSP)
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - skills: Java, Spring Boot
  - main_tasks: 리테일미디어 플랫폼 백엔드 개발
  - url: https://www.wanted.co.kr/wd/365596
`;

  const html = renderCandidatePreviewHtml(sampleRun, { postingsMarkdown: snapshot, limit: null });

  assert.match(html, /표시 공고 1개/);
  assert.match(html, /수집 기준: 2026-06-21T06:00:00.000Z/);
  assert.match(html, /position-postings-2026-06-21T06:00:00.000Z/);
  assert.match(html, /카카오페이/);
  assert.match(html, /결제 정합성 경험과 잘 맞는다/);
  assert.match(html, /https:\/\/kakaopay\.career\.greetinghr\.com\/ko\/o\/192129/);
  assert.match(html, /table-scroll/);
  assert.match(html, /overflow-x: auto/);
  assert.match(html, /th:nth-child\(2\), td\.tier \{ display: none; \}/);
  assert.doesNotMatch(html, /CTO/);
  assert.doesNotMatch(html, /AI Engineer \(Model\)/);
  assert.doesNotMatch(html, /Server Developer \(Product\)/);
  assert.doesNotMatch(html, /Node\.js Developer/);
  assert.doesNotMatch(html, /Tech Lead \(Server\)/);
  assert.doesNotMatch(html, /CJ올리브영/);
  assert.doesNotMatch(html, /토스뱅크/);
});

test("candidate preview excludes roles with candidate-known core gaps and keeps a regular backend role", () => {
  const snapshot = `# Live Posting Snapshot

- [크래프톤] AI Data Pipeline Specialist
  - source: krafton-careers
  - posting_status: open
  - link_type: direct_posting
  - requirements: Airflow, Spark, data warehouse 운영 경험
  - url: https://example.com/data-pipeline
- [토스플레이스] Server Developer (AI Platform)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - main_tasks: Model Router, MCP Gateway, long-term memory를 공용 agent platform으로 제공합니다.
  - url: https://example.com/agent-platform
- [크래프톤] AI Native Full Stack Engineer
  - source: krafton-careers
  - posting_status: open
  - link_type: direct_posting
  - career_upside_risk_flags: 전문계약직 고용형태의 계약 기간 확인 필요
  - url: https://example.com/contract
- [토스] ML Engineer (Platform)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/ml-platform
- [액션파워] AI Backend 개발자
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - skills: Java, Spring Boot
  - url: https://example.com/actionpower
- [카카오뱅크] 퇴직연금 도메인 개발자
  - source: kakaobank-careers
  - posting_status: open
  - link_type: direct_posting
  - skills: Java, Spring Boot, RDBMS
  - requirements: 퇴직연금 시스템 개발 및 운영 5년 이상
  - url: https://recruit.kakaobank.com/jobs/244006
- [카카오모빌리티] 백엔드 개발자(주차 플랫폼 개발)
  - source: kakaomobility
  - posting_status: open
  - link_type: direct_posting
  - skills: Java, Spring Boot, Kafka
  - main_tasks: 주차 플랫폼 API와 서버를 개발합니다.
  - url: https://example.com/backend
- [토스플레이스] Server Developer (Platform)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - skills: Java, Kotlin, Spring Framework
  - main_tasks: API Gateway와 Monitoring 시스템을 개발하고 운영합니다.
  - requirements: 서버 플랫폼 팀은 Server Developer, DevOps Engineer, DBA로 구성됩니다.
  - url: https://example.com/server-platform
- [토스뱅크] Credit Rating Modeler
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/credit-modeler
`;

  const html = renderCandidatePreviewHtml(sampleRun, { postingsMarkdown: snapshot, limit: null });

  assert.match(html, /표시 공고 2개/);
  assert.match(html, /카카오모빌리티/);
  assert.match(html, /토스플레이스/);
  assert.doesNotMatch(html, /Data Pipeline Specialist/);
  assert.doesNotMatch(html, /Server Developer \(AI Platform\)/);
  assert.doesNotMatch(html, /AI Native Full Stack Engineer/);
  assert.doesNotMatch(html, /ML Engineer \(Platform\)/);
  assert.doesNotMatch(html, /액션파워/);
  assert.doesNotMatch(html, /퇴직연금 도메인 개발자/);
  assert.doesNotMatch(html, /Credit Rating Modeler/);
});
