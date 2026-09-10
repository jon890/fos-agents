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

export function isContractRole(text: string): boolean {
  return containsKeyword(text, CONTRACT_KEYWORDS);
}
