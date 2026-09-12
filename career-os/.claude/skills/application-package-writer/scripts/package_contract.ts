
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

/** 적합도 표의 점수 열 이름. 화면이 이 열을 읽어 원과 색을 그린다. */
export const FIT_SCORE_COLUMN = "점수";
