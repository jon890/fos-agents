import { containsKeyword } from "../../../lib/text.ts";
import {
  AI_PLATFORM_ROLE_KEYWORDS,
  BACKEND_PLATFORM_ROLE_KEYWORDS,
  CONTRACT_KEYWORDS,
  NON_TARGET_ROLE_KEYWORDS,
  NON_TARGET_TITLE_KEYWORDS,
} from "./keywords.ts";

export function isNonTargetTitle(text: string): boolean {
  return containsKeyword(text, NON_TARGET_TITLE_KEYWORDS);
}

export function isTargetRole(text: string): boolean {
  const hasBackendPlatformKeyword = containsKeyword(text, BACKEND_PLATFORM_ROLE_KEYWORDS);
  const hasAiPlatformKeyword = containsKeyword(text, AI_PLATFORM_ROLE_KEYWORDS);
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
  return containsKeyword(text, CONTRACT_KEYWORDS);
}
