export type ApiErrorCode =
  | "BAD_REQUEST"
  | "BODY_TOO_LARGE"
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

export function errorResponse(error: unknown, requestId: string): Response {
  const apiError =
    error instanceof ApiError
      ? error
      : new ApiError(500, "INTERNAL_ERROR", "요청을 처리하지 못했습니다.");
  return Response.json(
    {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId,
      },
    },
    {
      status: apiError.status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}

export function jsonResponse(body: unknown, status: number, requestId: string): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}
