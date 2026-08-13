// Collection policy: keyword lists, role filters, and close-window helpers.
// Collector responsibility ends at clean active/open direct posting candidates.
// Ranking, fit/gap, and career narrative belong to the /position-recommender LLM report.

import type { Posting } from "./types.ts";

// ---- Keyword lists -------------------------------------------------------

export const SERVER_KEYWORDS = [
  // "back-end"/"back end"는 "backend"와 같은 역할인데 표기만 다르다.
  // 셋을 모두 두지 않으면 slug를 제목으로 바꾸는 adapter에서 공고가 조용히 탈락한다.
  "backend", "back-end", "back end", "백엔드", "server", "서버", "spring", "java", "kotlin", "api", "platform", "플랫폼", "gateway",
  "devops", "sre", "infrastructure", "인프라",
];
export const AI_PLATFORM_ROLE_KEYWORDS = [
  "ai transformation", "ax", "ai-native", "ai native", "ai agent", "agent", "llm", "rag", "llmops", "mlops",
  "ai 플랫폼", "ai플랫폼", "ai 서비스", "ai 엔지니어", "프로덕트 엔지니어", "전사 주요 프로젝트",
  "업무 자동화", "개발 생산성", "workflow", "tool calling", "memory",
];
export const EXCLUDE_NON_SERVER_KEYWORDS = [
  "data engineer", "데이터 엔지니어", "data scientist", "데이터 사이언티스트", "ai research", "research engineer",
  "frontend", "front-end", "프론트", "android", "ios", "qa", "product designer", "ux", "마케터",
];
export const NON_SERVER_TITLE_KEYWORDS = [
  "기획", "서비스 기획", "product manager", "product owner", "프로덕트 매니저", "po", "pm", "planner",
  "designer", "디자이너", "qa", "frontend", "프론트", "android", "ios", "data engineer",
  "데이터 엔지니어", "data scientist", "데이터 사이언티스트", "ai research", "research scientist",
  "applied scientist", "ai engineer (model)", "model researcher", "모델 연구",
  "cto", "chief technology officer", "tech lead", "server lead", "technical lead", "테크 리드", "기술 리드", "기술총괄", "기술 총괄",
  "manager", "team leader", "팀장", "조직장",
  "마케터", "marketing", "assistant", "어시스턴트", "정책", "e/e", "데이터 라벨링",
  // 법무·컴플라이언스
  "legal", "counsel", "법무", "변호사", "compliance manager", "컴플라이언스", "준법", "kyc", "aml", "privacy manager",
  // 재무·회계·감사
  "finance manager", "financial manager", "strategic finance", "재무", "accounting", "회계", "audit manager",
  // 채용·인사
  "recruiting", "recruiter", "채용", "talent acquisition", "hr manager", "인사", "people partner", "compensation",
  // ERP
  "sap",
  // 기술 문서
  "technical writer", "테크니컬 라이터",
  // 전략·기획
  "strategy manager", "비즈니스 애널리스트", "business analyst",
  // 운영 관리 (server operations/SRE와 구분하기 위해 복합 표현 사용)
  "operations manager", "운영 매니저",
  // 보안 직무 (security engineer 단독은 정보보안 직무)
  "security engineer",
];
export const CONTRACT_KEYWORDS = [
  "계약직", "contract", "contractor", "temporary", "temp", "freelance", "프리랜서",
  "intern", "internship", "인턴", "체험형", "현장실습",
];
export const JAVA_SPRING_KEYWORDS = [
  "java", "spring", "spring boot", "springboot", "jpa", "hibernate", "kotlin",
];
export const HARD_DOMAIN_KEYWORDS = [
  "commerce", "커머스", "order", "주문", "payment", "payments", "결제", "정산", "페이",
  "bank", "뱅크", "은행", "loan", "대출", "credit", "여신", "수신", "증권", "금융",
  "search", "검색", "platform", "플랫폼", "kafka", "streaming", "backend", "백엔드", "server", "서버",
];
export const AI_KEYWORDS = ["llm", "rag", "openai", "gemini", "머신러닝", "인공지능"];
// 선호 제외 회사는 config/position-filters.json의 excludedCompanies에서 읽는다.
// collect_live_postings.ts가 실행 시작 시
// setExcludedCompanies()로 이 목록을 주입한다. 아래 별칭 맵은 한국어 회사명만으로는
// 매칭되지 않는 로마자/영문 표기를 보강하는 매칭 보조일 뿐, 회사 결정 자체가 아니다.
const EXCLUDED_COMPANY_ALIASES: Record<string, string[]> = {
  "레브잇": ["rev-it", "revit"],
  "올웨이즈": ["always", "alway"],
  "피닉스랩": ["phoenixlab"],
  "와그(waug)": ["와그", "waug"],
};
let excludedCompanyKeywords: string[] = [];

/** config/position-filters.json의 excludedCompanies를 정규화하고 별칭을 확장한다. */
export function setExcludedCompanies(companies: string[]): void {
  const set = new Set<string>();
  for (const raw of companies) {
    const name = norm(raw).toLowerCase();
    if (!name) continue;
    set.add(name);
    for (const alias of EXCLUDED_COMPANY_ALIASES[name] ?? []) set.add(alias.toLowerCase());
  }
  excludedCompanyKeywords = [...set];
}

// ---- Text helpers --------------------------------------------------------

export function norm(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

export function hasKeyword(text: string, keywords: string[]): boolean {
  const low = text.toLowerCase();
  return keywords.some((k) => low.includes(k));
}

export function cleanDetail(text: unknown, limit = 420): string {
  let t = norm(text);
  t = t
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = norm(t);
  return t.length > limit ? t.slice(0, limit) + "…" : t;
}

// ---- Role filters --------------------------------------------------------

export function isNonServerTitle(text: string): boolean {
  return hasKeyword(text, NON_SERVER_TITLE_KEYWORDS);
}

export function isServerRole(text: string): boolean {
  const low = text.toLowerCase();
  const hasServerKeyword = SERVER_KEYWORDS.some((k) => low.includes(k));
  const hasAiPlatformKeyword = AI_PLATFORM_ROLE_KEYWORDS.some((k) => low.includes(k));
  // JD의 우대사항에 frontend, data 등의 인접 기술이 등장하는 것은 서버 역할을
  // 부정하는 근거가 아니다. 비서버 키워드만 있고 서버/AI 전환 신호도 없을 때만 제외한다.
  if (EXCLUDE_NON_SERVER_KEYWORDS.some((k) => low.includes(k)) && !hasServerKeyword && !hasAiPlatformKeyword) return false;
  if (low.includes("ml engineer") && !hasAiPlatformKeyword) return false;
  return hasServerKeyword || hasAiPlatformKeyword;
}

export function isContractRole(text: string): boolean {
  return hasKeyword(text, CONTRACT_KEYWORDS);
}

export function isExcludedCompany(text: string): boolean {
  if (excludedCompanyKeywords.length === 0) return false;
  return hasKeyword(text, excludedCompanyKeywords);
}

export function classify(text: string): string[] {
  const low = text.toLowerCase();
  const tags: string[] = [];
  if (
    ["bank", "뱅크", "은행", "loan", "대출", "여신", "수신", "증권"].some((k) => low.includes(k))
  )
    tags.push("internet-bank/fintech");
  if (
    ["commerce", "커머스", "order", "주문", "payment", "payments", "결제", "정산"].some((k) =>
      low.includes(k)
    )
  )
    tags.push("commerce/payment");
  if (["검색", "rag", "opensearch", "elastic", "vector"].some((k) => low.includes(k)))
    tags.push("search/rag");
  if (AI_KEYWORDS.some((k) => low.includes(k))) tags.push("ai-service");
  if (
    ["backend", "백엔드", "server", "서버", "spring", "java", "kafka"].some((k) =>
      low.includes(k)
    )
  )
    tags.push("backend-platform");
  return tags.length > 0 ? tags : ["other"];
}

// ---- Close-window helpers ------------------------------------------------

export function parseDueDate(raw: unknown): Date | null {
  const value = norm(raw);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function daysUntil(date: Date): number {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((date.getTime() - now.getTime()) / msPerDay);
}

export function closeWindow(rawDueTime: unknown): Pick<Posting, "closesAt" | "daysUntilClose" | "closeUrgency"> {
  const dueTime = norm(rawDueTime);
  if (!dueTime) {
    return {
      closesAt: "no_deadline",
      daysUntilClose: "no_deadline",
      closeUrgency: "no_deadline",
    };
  }

  const dueDate = parseDueDate(dueTime);
  if (!dueDate) {
    return {
      closesAt: dueTime,
      daysUntilClose: "unknown",
      closeUrgency: "unknown",
    };
  }

  const days = daysUntil(dueDate);
  const urgency =
    days < 0 ? "urgent" :
    days <= 3 ? "urgent" :
    days <= 7 ? "soon" :
    "normal";
  return {
    closesAt: dueTime,
    daysUntilClose: String(days),
    closeUrgency: urgency,
  };
}
