export type FitJudgment =
  | "확인됨"
  | "강한 인접"
  | "인접 경험"
  | "공백"
  | "사용자 확인";

// data-schema.md의 「적합도 판정과 점수」를 따른다. null은 계산 제외다.
export const FIT_JUDGMENT_SCORES = {
  확인됨: 100,
  "강한 인접": 75,
  "인접 경험": 50,
  공백: 0,
  "사용자 확인": null,
} as const satisfies Record<FitJudgment, number | null>;

export const FIT_SECTION_WEIGHTS = {
  "주요 업무": 3,
  "기대 경험": 2,
  "우대 경험": 1,
} as const;
