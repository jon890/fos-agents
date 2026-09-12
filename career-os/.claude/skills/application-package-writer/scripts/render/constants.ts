import { resolve } from "node:path";
import type { FitColor, PackageStatus, TabKey } from "./types.ts";

/** 탭 밖 상단에 고정하는 섹션. 어느 탭을 보고 있든 보여야 한다. */
export const TOP_SECTION_TITLES = new Set(["결론", "제출 준비 상태", "사용자 확인 필요"]);

export const FIT_TAB_SECTION_TITLES = ["공고 항목별 적합도", "공개 자료로 확인한 팀과 인접 사례"] as const;

export const STRATEGY_TAB_SECTION_TITLES = [
  "이 포지션에서의 승부처",
  "지원동기",
  "입사 후 기여 시나리오",
  // 선택 절이다. 없으면 건너뛰고 나머지 순서는 그대로 둔다.
  "이 자리에서 얻을 경험과 성장",
  "보완할 공백",
  "회사 문화와의 연결",
  "면접에서 검증받을 내용",
] as const;

export const TEMPLATE_DIRECTORY = resolve(import.meta.dir, "../../templates");

/** 순서가 화면 순서이고 첫 항목이 기본 선택이다. 공고 원문을 먼저 읽고 적합도를 본다. */
export const TABS = [
  { key: "posting", label: "공고 원문" },
  { key: "fit", label: "공고 적합도" },
  { key: "strategy", label: "지원 전략" },
  { key: "detail", label: "상세 자료" },
] as const;

/** CSS 가 탭 키마다 선택자를 하드코딩하므로 테스트가 두 곳을 대조한다. */
export const TAB_KEYS: readonly TabKey[] = TABS.map((tab) => tab.key);

export const READINESS_LABELS: Record<NonNullable<PackageStatus["readiness"]>, string> = {
  ready: "제출 검토 가능",
  needs_user_input: "내 답변 필요",
  revise: "문장 보강 필요",
  do_not_apply: "지원 보류 권장",
};

export const EVIDENCE_LABELS: Record<NonNullable<PackageStatus["evidence"]>, string> = {
  safe: "근거 안전",
  revise: "근거 표현 조정",
  blocked: "근거 확인 전 사용 금지",
};

export const HUMAN_CONFIRMATION_LABELS: Record<NonNullable<PackageStatus["humanConfirmation"]>, string> = {
  complete: "사람 확인 완료",
  needs_input: "내 경험 확인 필요",
};

export const QUESTION_ORIGIN_LABELS = {
  posting_requirement: "공고 핵심 책임",
  evidence_defense: "제출 근거 방어",
  experience_gap: "경험 공백 확인",
} as const;

/** 점수를 색으로만 옮긴다. 이름은 붙이지 않는다. */
export const FIT_SCORE_COLOR_BANDS = [
  { minimum: 85, color: "excellent" },
  { minimum: 65, color: "good" },
  { minimum: 35, color: "fair" },
  { minimum: 0, color: "none" },
] as const satisfies readonly { minimum: number; color: FitColor }[];

export const FIT_COLOR_LABELS: Record<FitColor, string> = {
  excellent: "진한 초록",
  good: "초록",
  fair: "노랑",
  none: "빨강",
};

/** 끝에 붙은 구두점은 주소에서 뺀다. 문장 끝의 마침표와 쉼표가 주소에 딸려 들어가지 않게 한다. */
export const BARE_URL = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;
