import { expect, test } from "bun:test";
import { postingFromTossApiJob } from "./adapters/toss.ts";
import { parseDaangnJob } from "./adapters/daangn-careers.ts";
import { postingFromWantedDetail } from "./adapters/wanted.ts";
import { parseWoowahanRecruit } from "./adapters/woowahan-careers.ts";
import { buildPostingCandidatePool } from "./candidate_pool.ts";
import type { Posting } from "./types.ts";
import { createPostingEligibilityPolicy } from "./validator.ts";

const policy = createPostingEligibilityPolicy();
const now = new Date("2026-11-21T00:00:00Z");

function posting(overrides: Partial<Posting>): Posting {
  return {
    source: "woowahan-careers",
    discoveryMode: "official-listing",
    company: "가상서비스",
    title: "백엔드 개발자",
    url: "https://example.com/jobs/1",
    linkType: "direct_posting",
    postingStatus: "open",
    activeEvidence: "합성 공고",
    openedAt: "",
    closesAt: "no_deadline",
    daysUntilClose: "no_deadline",
    closeUrgency: "no_deadline",
    category: "기술",
    summary: "",
    tags: [],
    skills: [],
    dueTime: "",
    mainTasks: "",
    requirements: "",
    preferred: "",
    ...overrides,
  };
}

// 2026-11-21 브리핑 상위 공고의 제목·업무 형태와 REQ1의 추가 양성 사례.
for (const [company, title, mainTasks] of [
  [
    "당근",
    "백엔드 엔지니어 (Content & User Understanding)",
    "LLM API로 콘텐츠를 분류하고 분류 품질을 평가한다.",
  ],
  [
    "크래프톤",
    "AI Native Full Stack Engineer",
    "Kotlin과 Python으로 AI 제품을 만들고 추론을 연결한다.",
  ],
  [
    "42dot",
    "Software Engineer (Personalized & Proactive Agent)",
    "대화의 맥락을 기억하고 먼저 제안하는 기능과 Agent 평가를 구현한다.",
  ],
  ["당근", "AI Platform Engineer", "Agent Runtime과 MCP 연동 기능을 개발한다."],
  [
    "LINE Pay Plus",
    "Software Engineer (AI/Data Platform)",
    "Spring과 Kafka를 쓰는 서비스에 RAG 검색을 붙인다.",
  ],
  [
    "당근",
    "백엔드 엔지니어 (피드 ML Data Platform)",
    "실서비스 추천 엔진과 임베딩 플랫폼을 개발하고 운영한다.",
  ],
  ["가상서비스", "MLOps Engineer", "LLM 서빙의 배포와 운영을 자동화한다."],
  ["가상서비스", "Software Engineer", "LLM 서빙 API와 모델 배포를 운영한다."],
  ["가상서비스", "AI Product Engineer", ""],
  ["가상서비스", "Software Engineer (AI Assistant)", ""],
  ["가상서비스", "백엔드 엔지니어", "실서비스 피드에 사용자 임베딩을 적용하고 운영한다."],
  ["가상서비스", "Software Engineer", "대화형 에이전트를 개발한다."],
  ["가상서비스", "Backend Engineer", "서비스의 ML 추천 기능을 개발한다."],
  ["가상서비스", "검색 서버 개발자", "벡터 검색과 임베딩을 이용한 검색 서버를 운영한다."],
  ["가상서비스", "플랫폼 엔지니어", "모델 추론 서빙 플랫폼을 운영한다."],
  ["가상서비스", "피드 서버 개발자", "개인화 추천 피드 서버를 개발한다."],
]) {
  test(`${company} ${title} 공고가 공통 직무 필터를 통과한다`, () => {
    expect(policy.evaluate(posting({ company, title, mainTasks }), now)).toEqual({
      eligible: true,
    });
  });
}

for (const [title, mainTasks] of [
  ["SRE", "서비스 지표와 장애 대응 체계를 운영한다."],
  ["SRE", "엔드포인트 보안 Agent 개발과 운영을 맡는다."],
  ["DevOps Engineer", "Prometheus Agent Runtime을 운영한다."],
  ["DevOps Engineer", "모니터링 에이전트 플랫폼을 구축한다."],
  ["Data-Scientist (LLM)", "사용자 데이터로 LLM 모델을 학습시킨다."],
  ["DevOps Engineer", "빌드와 릴리스 워크플로를 자동화한다."],
  ["Infra Service Engineer", "서버와 스토리지를 증설한다."],
  ["백엔드 엔지니어", "AI 개발 도구를 활용해 정산 API를 개발한다."],
  ["백엔드 엔지니어", "AI Agent를 활용한 개발 문화에서 결제 API를 운영한다."],
  ["백엔드 엔지니어", "AI 서비스를 적극 활용하는 문화에서 주문 API를 개발한다."],
  ["백엔드 엔지니어 (광고)", "광고 입찰 API와 메모리를 최적화한다."],
  ["Data Scientist", "LLM으로 사용자 데이터를 분석한다."],
  ["AI Model Research Engineer", "LLM 모델 학습 기법을 연구한다."],
  ["Research Engineer, LLM Serving", "LLM 서빙에 맞는 모델 구조를 연구한다."],
  ["Category MD", "상품 추천 시스템 개발 조직과 협업한다."],
  ["Executive Assistant", "임원 일정과 회의를 관리한다."],
  ["SRE (Monitoring Agent)", "서버에 설치된 수집 agent와 memory 사용량을 모니터링한다."],
  ["Backend Engineer", "AI 코딩 도구와 GitHub Copilot을 활용해 결제 API를 개발한다."],
]) {
  test(`${title} 공고를 공통 직무 필터에서 제외한다 (${mainTasks})`, () => {
    expect(policy.evaluate(posting({ title, mainTasks }), now).rejectionCode).toBe(
      "not_target_role",
    );
  });
}

test("자격과 우대에만 AI 신호가 있으면 제외한다", () => {
  const item = posting({
    mainTasks: "광고 송출 API를 운영한다.",
    requirements: "AI 코딩 도구 사용 경험",
    preferred: "Coding Agent 활용 경험과 LLM API 사용 경험",
  });
  expect(policy.evaluate(item, now).rejectionCode).toBe("not_target_role");

  for (const heading of [
    "[우대사항]",
    "자격 요건:",
    "Preferred Qualifications",
    "Preferred Skills:",
    "우대:",
    "Nice to have",
    "Bonus points",
    "이런 경험이 있으면 좋아요",
    "Preferred:",
  ]) {
    const mainTasks = `${item.mainTasks} ${heading} LLM API와 RAG 사용 경험`;
    expect(policy.evaluate({ ...item, mainTasks }, now).rejectionCode).toBe("not_target_role");
  }
});

test("당근 어댑터에서 업무 헤더 앞의 LLM 서빙 설명을 후보풀까지 보존한다", () => {
  const item = parseDaangnJob({
    id: 1,
    title: "Software Engineer",
    location: { name: "서울" },
    content:
      "<p>LLM 서빙을 운영하는 팀입니다.</p><h2>이런 일을 해요</h2><p>배포 API를 개발해요.</p>",
  });
  expect(item).not.toBeNull();
  expect(policy.evaluate(item!, now)).toEqual({ eligible: true });
  const result = buildPostingCandidatePool([item!], {
    collectionRunId: "synthetic-run",
    collectedAt: now.toISOString(),
    requestedSource: "daangn-careers",
    configuredSources: ["daangn-careers"],
    wantedLimit: 1,
    includeTossArticles: false,
    sourceDiagnostics: [],
    errors: [],
  });
  expect(result.validationErrors).toEqual([]);
  expect(result.pool.candidates).toHaveLength(1);
});

test("당근 어댑터에서 업무 구분이 없어도 우대 문구는 주요 업무에서 제외한다", () => {
  const item = parseDaangnJob({
    id: 2,
    title: "백엔드 엔지니어",
    location: { name: "서울" },
    content: "<p>광고 송출 API를 운영합니다.</p><h2>우대 사항</h2><p>LLM 서비스 개발 경험</p>",
  });
  expect(item).not.toBeNull();
  expect(policy.evaluate(item!, now).rejectionCode).toBe("not_target_role");
});

test("분류 전에 마감과 비정규 고용을 확인한다", () => {
  const item = posting({ title: "LLM Platform Engineer" });
  expect(policy.evaluate({ ...item, postingStatus: "unknown" }, now).rejectionCode).toBe(
    "unverified_status",
  );
  expect(policy.evaluate({ ...item, closesAt: "2026-11-20" }, now).rejectionCode).toBe(
    "expired_deadline",
  );
  expect(policy.evaluate({ ...item, employmentType: "계약직" }, now).rejectionCode).toBe(
    "ineligible_employment",
  );
  expect(policy.evaluate({ ...item, title: "LLM Platform Engineer 인턴" }, now).rejectionCode).toBe(
    "ineligible_employment",
  );
});

test("일반 서버 업무는 어댑터 수집 뒤 공통 직무 필터에서 제외한다", () => {
  for (const title of ["Server(배차시스템)", "Software Engineer, Search"]) {
    const item = parseWoowahanRecruit(
      { recruitSeq: 1, recruitNumber: "synthetic-1", recruitName: title },
      "서버 API 개발 및 운영",
    );
    expect(item).not.toBeNull();
    expect(policy.evaluate(item!, now).rejectionCode).toBe("not_target_role");
  }
});

test("토스 어댑터에서도 일반 제목과 소개에 적힌 AI 업무를 통과시킨다", () => {
  const { posting: item } = postingFromTossApiJob(
    {},
    {
      id: 1,
      title: "Software Engineer",
      company_name: "가상서비스",
      content: "LLM 서빙 팀입니다. 주요 업무는 배포 API 개발입니다. 지원 자격 서버 개발 경험",
    },
    true,
  );
  expect(item).toBeDefined();
  expect(policy.evaluate(item!, now)).toEqual({ eligible: true });
});

test("우아한형제들 공고의 소개에서 업무 근거를 읽는다", () => {
  const item = parseWoowahanRecruit(
    { recruitSeq: 1, recruitNumber: "synthetic-1", recruitName: "Software Engineer" },
    "<p>LLM 서빙 팀입니다.</p><h2>주요 업무</h2><p>배포 API를 개발합니다.</p><h2>자격 요건</h2>서버 개발 경험",
  );
  expect(item).not.toBeNull();
  expect(policy.evaluate(item!, now)).toEqual({ eligible: true });
});

test("원티드 상세의 소개에서 AI 업무를 읽는다", () => {
  const item = postingFromWantedDetail(
    1,
    {
      status: "active",
      company: { name: "가상서비스" },
      position: "Software Engineer",
      detail: { intro: "LLM 서빙 팀입니다.", main_tasks: "배포 API를 개발합니다." },
    },
    "broad",
    true,
  );
  expect(item).not.toBeNull();
  expect(policy.evaluate(item!, now)).toEqual({ eligible: true });
});
