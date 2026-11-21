import { cleanMarkupText, containsKeyword } from "../../../lib/text.ts";
import {
  AI_TOOL_USAGE,
  AI_PLATFORM_ROLE_KEYWORDS,
  AI_WORK_PATTERNS,
  BACKEND_PLATFORM_ROLE_KEYWORDS,
  NON_TARGET_ROLE_KEYWORDS,
  NON_TARGET_TITLE_KEYWORDS,
  ROLE_QUALIFICATION_HEADING,
} from "./keywords.ts";

export function isNonTargetTitle(text: string): boolean {
  // AI Assistant는 공고의 제품명일 수 있다. 다른 비대상 직무 표현은 모두 검사한다.
  const role = text.replace(/\bAI[ /-]+assistants?\b|\bAI\s*어시스턴트/gi, " ");
  return NON_TARGET_TITLE_PATTERNS.some((pattern) => pattern.test(role));
}

const NON_TARGET_TITLE_PATTERNS = NON_TARGET_TITLE_KEYWORDS.map((keyword) => {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll(" ", "[ -]+");
  const start = /^\w/.test(keyword) ? "\\b" : "";
  const end = /\w$/.test(keyword) ? "\\b" : "";
  return new RegExp(`${start}${escaped}${end}`, "i");
});

/** 목록이나 원문을 상세 공고로 가져올 때 쓰는 넓은 사전 검색이다. */
export function isTargetRole(text: string): boolean {
  const hasBackendPlatformKeyword = containsKeyword(text, BACKEND_PLATFORM_ROLE_KEYWORDS);
  const hasAiPlatformKeyword = hasAiWork(text) || containsKeyword(text, AI_PLATFORM_ROLE_KEYWORDS);
  if (
    containsKeyword(text, NON_TARGET_ROLE_KEYWORDS) &&
    !hasBackendPlatformKeyword &&
    !hasAiPlatformKeyword
  ) {
    return false;
  }
  if (text.toLowerCase().includes("ml engineer") && !hasAiPlatformKeyword) return false;
  return hasBackendPlatformKeyword || hasAiPlatformKeyword;
}

export function isTargetRoleTitle(title: string): boolean {
  if (isNonTargetTitle(title)) return false;

  const normalized = title.toLowerCase();
  const explicitEngineeringRole =
    /backend|back-end|back end|백엔드|server developer|서버\s*개발|node\.?js\s*(?:developer|engineer)|devops|site reliability|\bsre\b|llmops|product engineer|프로덕트\s*엔지니어/.test(
      normalized,
    );
  const platformEngineeringRole =
    /(?:platform|플랫폼|infrastructure|인프라|infra).*(?:engineer|developer|architect|엔지니어|개발자|아키텍트)|(?:engineer|developer|architect|엔지니어|개발자|아키텍트).*(?:platform|플랫폼|infrastructure|인프라|infra)/.test(
      normalized,
    );
  const aiEngineeringRole =
    /(?:\bai\b|ai-native|ai native|ai agent|llm|rag|mlops|업무 자동화|개발 생산성).*(?:engineer|developer|specialist|엔지니어|개발자)|(?:engineer|developer|specialist|엔지니어|개발자).*(?:\bai\b|ai-native|ai native|ai agent|llm|rag|mlops|업무 자동화|개발 생산성)/.test(
      normalized,
    );

  return explicitEngineeringRole || platformEngineeringRole || aiEngineeringRole;
}

export function isContractRole(text: string): boolean {
  // 영문은 단어 전체를 검사한다. JD는 호출자가 넘기지 않는다.
  return /\b(?:contract|contractor|temporary|temp|freelance|intern|internship)\b|계약직|프리랜서|인턴|체험형|현장실습/i.test(
    text,
  );
}

/** 구조화 고용형태와 제목 중 하나라도 비정규 표기가 있으면 제외한다. */
export function isIneligibleEmployment(title: string, employmentType?: string): boolean {
  return isContractRole(employmentType ?? "") || isContractRole(title);
}

function hasAiWork(text: string): boolean {
  const work = text.replace(AI_TOOL_USAGE, " ");
  return AI_WORK_PATTERNS.some((pattern) => pattern.test(work));
}

/** 업무 칸에 담긴 전체 본문에서도 지원 조건 앞의 소개와 업무만 읽는다. */
function postingRoleDuties(text: string): string {
  return text.split(ROLE_QUALIFICATION_HEADING, 1)[0] ?? "";
}

/** 업무 제목이 있는 원문에서 소개와 업무를 각각 보존한다. */
export function extractPostingRoleDuties(text: string, dutiesHeading: RegExp): string {
  const duties = postingRoleDuties(text);
  const headingIndex = duties.search(dutiesHeading);
  if (headingIndex < 0) return cleanMarkupText(duties, 650);
  const introduction = cleanMarkupText(duties.slice(0, headingIndex), 650);
  const responsibilities = cleanMarkupText(duties.slice(headingIndex), 650);
  return [introduction, responsibilities].filter(Boolean).join(" ");
}

export function isTargetPostingRole(title: string, mainTasks: string): boolean {
  if (isNonTargetTitle(title)) return false;
  return hasAiWork(title) || hasAiWork(postingRoleDuties(mainTasks));
}
