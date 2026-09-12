
/**
 * 반드시 참이어야 하는 것만 둔다.
 * 어떤 파일과 절을 만드는지는 `SKILL.md` 의 지침과 `docs/data-schema.md` 가 소유하고 모델이 채운다.
 */

/** 준비 상태 세 줄이 사는 파일. 렌더러가 여기서 읽는다. */
export const STATUS_FILE = "evidence/status.md";

/** 적합도 표가 사는 파일. */
export const FIT_FILE = "evidence/fit.md";

export const EVIDENCE_DIRECTORY = "evidence";
export const REVIEW_DIRECTORY = "review";

/**
 * 제출 문서에 남으면 안 되는 것. 내부 경로, 저장소 안에서만 뜻이 통하는 표시,
 * 작업 번호와 커밋 해시다. 외부로 나가는 문서에만 적용한다.
 */
export const SUBMISSION_LEAK_PATTERNS = [
  /\/Users\//,
  /sources\/fos-study/i,
  /needs_evidence/i,
  /\b(?:plan|task)[-_ ]?\d{2,}\b/i,
  /\b[0-9a-f]{40}\b/i,
] as const;

/**
 * 점수가 판정 이름을 정한다. 문서에는 점수만 적고 이름은 화면이 붙인다.
 * 구간을 문서에서 관리하면 지원 건마다 달라져 총점을 비교할 수 없다.
 */
export const FIT_VERDICT_BANDS = [
  { minimum: 85, verdict: "확인됨" },
  { minimum: 65, verdict: "강한 인접" },
  { minimum: 35, verdict: "인접 경험" },
  { minimum: 0, verdict: "공백" },
] as const;

/** 적합도 표의 점수 열 이름. 이 이름이 보이면 화면이 판정 열을 만든다. */
export const FIT_SCORE_COLUMN = "점수";
export const FIT_VERDICT_COLUMN = "판정";

export function fitVerdict(score: number): string {
  return FIT_VERDICT_BANDS.find((band) => score >= band.minimum)?.verdict ?? "공백";
}
