import assert from "node:assert/strict";
import { test } from "node:test";
import { renderCandidatePreviewHtml } from "./render_candidate_preview.ts";
import type { RecommendationRunType } from "./recommendation_schema.ts";

/**
 * 통합 HTML에서 "전체 조건 통과 공고" 섹션만 잘라낸다.
 * 전체 공고 섹션의 snapshot 제외 규칙만 검증할 때 추천 티어를 잘라낸다.
 */
function allPostingsSection(html: string): string {
  const index = html.indexOf("<h2>전체 조건 통과 공고");
  return index < 0 ? "" : html.slice(index);
}

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

test("candidate preview applies role exclusions to recommendation tiers", () => {
  const run = structuredClone(sampleRun);
  run.tiers.strong[0].company = "타인에이아이";
  run.tiers.strong[0].title = "Backend Developer";
  run.tiers.strong[0].postingUrl = "https://example.com/recommended-ai-native";
  run.tiers.strong[0].whyFit = "백엔드 제품을 개발한다.";
  run.tiers.strong[0].searchKeywords = ["MCP Gateway"];
  run.tiers.strong[0].jdKeywords = ["Agent Platform"];

  const html = renderCandidatePreviewHtml(run, { limit: 10 });

  assert.doesNotMatch(html, /Backend Developer/);
  assert.doesNotMatch(html, /MCP Gateway/);
  assert.match(html, /Server Developer \(수신\)/);

  const allowedRun = structuredClone(sampleRun);
  allowedRun.tiers.strong[0].title = "Server(배차시스템)";
  allowedRun.tiers.strong[0].searchKeywords = ["Java", "ML 모델 서빙"];
  allowedRun.tiers.strong[0].jdKeywords = ["대규모 실시간 백엔드"];
  allowedRun.tiers.strong[0].whyFit = "Java/Spring 대규모 배차 서버에 ML 모델 연동이 결합된 제품 백엔드 역할이다.";

  const allowedHtml = renderCandidatePreviewHtml(allowedRun, { limit: 10 });
  assert.match(allowedHtml, /Server\(배차시스템\)/);
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

  assert.match(html, /전체 조건 통과 공고 <span class="count">1건<\/span>/);
  assert.match(html, /수집 기준: 2026-06-21T06:00:00.000Z/);
  assert.match(html, /position-postings-2026-06-21T06:00:00.000Z/);
  assert.match(html, /카카오페이/);
  assert.match(html, /결제 정합성 경험과 잘 맞는다/);
  assert.match(html, /https:\/\/kakaopay\.career\.greetinghr\.com\/ko\/o\/192129/);
  assert.match(html, /table-scroll/);
  assert.match(html, /overflow-x: auto/);
  assert.match(html, /th:nth-child\(2\), td\.tier \{ display: none; \}/);
  const allSection = allPostingsSection(html);
  assert.doesNotMatch(allSection, /CTO/);
  assert.doesNotMatch(allSection, /AI Engineer \(Model\)/);
  assert.doesNotMatch(allSection, /Server Developer \(Product\)/);
  assert.doesNotMatch(allSection, /Node\.js Developer/);
  assert.doesNotMatch(allSection, /Tech Lead \(Server\)/);
  assert.doesNotMatch(allSection, /CJ올리브영/);
  assert.doesNotMatch(allSection, /토스뱅크/);
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
- [카카오모빌리티] 내비게이션 3D 지도 렌더링 엔진 개발자
  - source: kakaomobility
  - posting_status: open
  - link_type: direct_posting
  - skills: C++, OpenGL, Vulkan
  - main_tasks: 내비게이션용 3D 지도 렌더링 엔진과 크로스 플랫폼 엔진 코어를 개발합니다.
  - url: https://example.com/map-rendering-engine
- [토스뱅크] AIOps Platform Engineer
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - main_tasks: 인프라 이상 탐지와 Self-Healing 플랫폼을 운영합니다.
  - url: https://example.com/aiops
- [토스증권] Systems Engineer (5년 이상)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/systems-senior
- [토스증권] Systems Engineer (5년 미만)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/systems-junior
- [토스증권] Systems Engineer (가상화)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/systems-virtualization
- [토스뱅크] ML Platform Team Leader
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/ml-platform-leader
- [토스증권] ERP Ops Developer
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/erp-ops
- [토스] AI Engineer (Speech)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/speech-model
- [토스뱅크] Infrastructure Automation Engineer
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/infrastructure-automation
- [토스뱅크] Infrastructure Operations Engineer
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/infrastructure-operations
- [토스뱅크] OpenStack Cloud Engineer
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/openstack-cloud
- [프론텍] IT 인프라 구축 서버·스토리지 전문 엔지니어
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - url: https://example.com/it-infrastructure-specialist
- [트릴리온랩스] Software Engineer, AI Infrastructure
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - url: https://example.com/ai-infrastructure
- [다키클라우드코리아] Private Cloud 플랫폼 엔지니어링
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - url: https://example.com/private-cloud-platform
- [의식주컴퍼니] Senior DevSecOps / 클라우드 인프라 엔지니어
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - url: https://example.com/cloud-infrastructure
- [토스] Data Analytics Engineer (Feature)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/data-analytics
- [토스페이먼츠] Server Developer (TCP·전문통신)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/tcp-server
- [토스페이먼츠] Server Developer (3년 이하)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/junior-server
- [토스씨엑스] 상담팀 리드 (토스플랫폼 전담팀)
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/counseling-lead
- [토스뱅크] Finance Data System Developer
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/finance-data-system
- [토스증권] 계좌 도메인 운영 Manager
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/account-operations-manager
- [토스플레이스] Payment Software Engineer
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/payment-device-software
- [토스증권] UX Writer
  - source: toss-careers
  - posting_status: open
  - link_type: direct_posting
  - url: https://example.com/ux-writer
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

  assert.match(html, /전체 조건 통과 공고 <span class="count">2건<\/span>/);
  assert.match(html, /카카오모빌리티/);
  assert.match(html, /토스플레이스/);
  assert.doesNotMatch(html, /Data Pipeline Specialist/);
  assert.doesNotMatch(html, /Server Developer \(AI Platform\)/);
  assert.doesNotMatch(html, /AI Native Full Stack Engineer/);
  assert.doesNotMatch(html, /ML Engineer \(Platform\)/);
  assert.doesNotMatch(html, /액션파워/);
  assert.doesNotMatch(html, /퇴직연금 도메인 개발자/);
  assert.doesNotMatch(html, /3D 지도 렌더링 엔진 개발자/);
  assert.doesNotMatch(html, /AIOps Platform Engineer/);
  assert.doesNotMatch(html, /Systems Engineer/);
  assert.doesNotMatch(html, /ML Platform Team Leader/);
  assert.doesNotMatch(html, /ERP Ops Developer/);
  assert.doesNotMatch(html, /AI Engineer \(Speech\)/);
  assert.doesNotMatch(html, /Infrastructure Automation Engineer/);
  assert.doesNotMatch(html, /Infrastructure Operations Engineer/);
  assert.doesNotMatch(html, /OpenStack Cloud Engineer/);
  assert.doesNotMatch(html, /IT 인프라 구축 서버·스토리지 전문 엔지니어/);
  assert.doesNotMatch(html, /Software Engineer, AI Infrastructure/);
  assert.doesNotMatch(html, /Private Cloud 플랫폼 엔지니어링/);
  assert.doesNotMatch(html, /클라우드 인프라 엔지니어/);
  assert.doesNotMatch(html, /Data Analytics Engineer/);
  assert.doesNotMatch(html, /TCP·전문통신/);
  assert.doesNotMatch(html, /3년 이하/);
  assert.doesNotMatch(html, /상담팀 리드/);
  assert.doesNotMatch(html, /Finance Data System Developer/);
  assert.doesNotMatch(html, /계좌 도메인 운영 Manager/);
  assert.doesNotMatch(html, /Payment Software Engineer/);
  assert.doesNotMatch(html, /UX Writer/);
  assert.doesNotMatch(html, /Credit Rating Modeler/);
});

test("candidate preview excludes non-backend operations, support, full-stack, and autonomous AI roles", () => {
  const snapshot = `# Live Posting Snapshot

- [카카오페이] 사업 담당자 - 해외 온라인 결제
  - source: kakaopay
  - posting_status: open
  - link_type: direct_posting
  - main_tasks: 결제 사업 제휴와 채널 운영을 담당합니다.
  - url: https://example.com/business
- [마키나락스] AI Platform & Model Operations Engineer
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - main_tasks: 고객 환경의 AI 플랫폼 정기점검과 기술지원을 수행합니다.
  - url: https://example.com/model-operations
- [애자일소다] AI Platform System Architecture Engineer
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - main_tasks: 인프라 구성과 용량 산정, Kubernetes 플랫폼 구축을 지원합니다.
  - url: https://example.com/system-architecture
- [신한카드] 시스템 인프라 운영
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - main_tasks: 서버와 스토리지 인프라를 운영합니다.
  - url: https://example.com/infrastructure-operations
- [컬리] 서버 엔지니어
  - source: kurly-careers
  - posting_status: open
  - link_type: direct_posting
  - main_tasks: IDC와 온프레미스 서버 OS, VDI, AD, 하드웨어 라이프사이클을 운영합니다.
  - url: https://example.com/server-infrastructure
- [케어랩스] 구인구직 플랫폼 풀스택 개발자
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - main_tasks: React 프론트엔드와 백엔드를 함께 개발합니다.
  - url: https://example.com/full-stack
- [네오와이즈] 자율비행 AI 엔지니어
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - main_tasks: 장애물 회피, 항법, 센서퓨전과 비전 모델을 개발합니다.
  - url: https://example.com/autonomous-flight
- [타인에이아이] AI-Native Developer
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - main_tasks: Agentic DevOps와 Service Ops를 담당합니다.
  - url: https://example.com/ai-native-developer
- [데이터얼라이언스] GPU클라우드 엔터프라이즈 세일즈 리드
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - main_tasks: 엔터프라이즈 영업과 파트너 세일즈를 담당합니다.
  - url: https://example.com/gpu-cloud-sales
- [파이오링크] ADC(L4-L7 스위치) 애플리케이션 개발
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - requirements: network daemon, TCP/IP, 패킷 분석 경험
  - url: https://example.com/network-daemon
- [우아한형제들] 로보틱스 S/W 엔지니어링(SLAM 개발)
  - source: woowahan-careers
  - posting_status: open
  - link_type: direct_posting
  - main_tasks: 자율주행 로봇의 SLAM을 개발합니다.
  - url: https://example.com/slam
- [우아한형제들] 로보틱스 S/W 엔지니어링
  - source: woowahan-careers
  - posting_status: open
  - link_type: direct_posting
  - main_tasks: 자율주행 로봇의 SLAM 알고리즘과 로보틱스 ML을 개발합니다.
  - url: https://example.com/robotics-ml
- [포토위젯] AI 서비스 인프라 엔지니어
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - main_tasks: AI 인프라와 클라우드 운영을 담당합니다.
  - url: https://example.com/ai-service-infra
- [카카오모빌리티] 자율주행 시스템 엔지니어 (R&D)
  - source: kakaomobility
  - posting_status: open
  - link_type: direct_posting
  - main_tasks: 자율주행 차량 시스템 인프라 운영 및 유지보수와 데이터 구축 환경을 관리합니다.
  - url: https://example.com/autonomous-system-engineer
- [브릭] AI Agent 개발자
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - main_tasks: AI API 및 Backend를 개발합니다.
  - requirements: FastAPI 또는 Spring Boot 개발 경험
  - url: https://example.com/agent-backend
- [정상회사] Java 백엔드 개발자
  - source: wanted
  - posting_status: active
  - link_type: direct_posting
  - main_tasks: Java와 Spring Boot로 제품 API를 개발합니다.
  - preferred: TCP/IP 기본 이해
  - url: https://example.com/java-backend
`;

  const html = renderCandidatePreviewHtml(sampleRun, { postingsMarkdown: snapshot, limit: null });

  assert.match(html, /전체 조건 통과 공고 <span class="count">2건<\/span>/);
  assert.match(html, /브릭/);
  assert.match(html, /Java 백엔드 개발자/);
  assert.doesNotMatch(html, /사업 담당자/);
  assert.doesNotMatch(html, /Model Operations Engineer/);
  assert.doesNotMatch(html, /System Architecture Engineer/);
  assert.doesNotMatch(html, /시스템 인프라 운영/);
  assert.doesNotMatch(html, /컬리/);
  assert.doesNotMatch(html, /풀스택 개발자/);
  assert.doesNotMatch(html, /자율비행 AI 엔지니어/);
  assert.doesNotMatch(html, /AI-Native Developer/);
  assert.doesNotMatch(html, /세일즈 리드/);
  assert.doesNotMatch(html, /ADC\(L4-L7 스위치\)/);
  assert.doesNotMatch(html, /SLAM 개발/);
  assert.doesNotMatch(html, /로보틱스 S\/W 엔지니어링/);
  assert.doesNotMatch(html, /AI 서비스 인프라 엔지니어/);
  assert.doesNotMatch(html, /자율주행 시스템 엔지니어/);
});
