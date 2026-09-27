export type ApiErrorCode =
  | "BAD_REQUEST"
  | "BODY_TOO_LARGE"
  | "COMPANY_TIER_LEASE_EXPIRED"
  | "COMPANY_TIER_RUN_MISSING"
  | "COMPANY_TIER_RUN_PENDING"
  | "DATABASE_UNAVAILABLE"
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL_ERROR"
  | "NOT_FOUND"
  | "POLICY_NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "VERSION_CONFLICT";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 공개 오류 응답 본문. client 가 `error.code` 로 분기한다. */
export type ApiErrorBody = {
  error: { code: ApiErrorCode; message: string; requestId: string };
};
