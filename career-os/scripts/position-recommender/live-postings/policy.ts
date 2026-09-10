// 기존 adapter import 경로를 유지하는 공개 진입점이다.
// 교체 가능한 키워드는 policy/keywords.ts, 판정 로직은 역할별 모듈이 소유한다.
export {
  cleanMarkupText as cleanDetail,
  containsKeyword as hasKeyword,
  normalizeText as norm,
} from "../../lib/text.ts";
export * from "./policy/classification.ts";
export * from "./policy/keywords.ts";
export * from "./policy/lifecycle.ts";
export * from "./policy/role.ts";
