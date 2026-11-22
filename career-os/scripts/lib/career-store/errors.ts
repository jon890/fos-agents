/**
 * 저장 모듈이 던지는 오류다. `status` 와 `code` 는 커리어 Backend 의 `ApiError` 가 쓰던 값과 같다.
 * 호출부가 HTTP 응답 대신 이 두 값으로 분기한다.
 */
export type CareerStoreErrorCode =
  | "BAD_REQUEST"
  | "CANDIDATE_CONTEXT_MISSING"
  | "COMPANY_TIER_LEASE_EXPIRED"
  | "COMPANY_TIER_RUN_MISSING"
  | "COMPANY_TIER_RUN_PENDING"
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL_ERROR"
  | "NOT_FOUND"
  | "POLICY_NOT_CONFIGURED"
  | "VERSION_CONFLICT"
  /** 다른 실행이 파일을 쓰고 있어 잠금을 얻지 못했다. 다음 실행이 이어 간다. */
  | "CAREER_STORE_BUSY"
  /** 파일을 열 수 없거나 검사에 실패했다. 덮어쓰지 않는다. */
  | "CAREER_STORE_CORRUPT"
  /** 이 실행기보다 새 실행기가 만든 파일이다. 파일은 멀쩡하므로 지우지 않고 실행기를 올린다. */
  | "CAREER_STORE_SCHEMA_NEWER";

export class CareerStoreError extends Error {
  constructor(
    readonly status: number,
    readonly code: CareerStoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CareerStoreError";
  }
}

/**
 * 실행기가 표준 오류 첫 줄에 내는 문장이다. 에이전트가 이 줄을 결과 글 첫 줄에 옮긴다.
 * 저장소 오류가 아니면 `undefined` 다.
 */
export function careerStoreFailureLine(error: unknown): string | undefined {
  if (!(error instanceof CareerStoreError)) return undefined;
  return `${error.code}: ${error.message}`;
}
