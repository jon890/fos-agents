import type { Response } from "express";

import type { ApiError, ApiErrorBody } from "./api-error.js";

/**
 * 공개 오류 응답을 쓴다.
 *
 * 계약은 `{ error: { code, message, requestId } }` 하나다.
 * 라우팅 전 middleware 와 exception filter 가 같은 형식을 내도록 이 함수 하나가 소유한다.
 */
export function writeApiError(
  response: Response,
  apiError: ApiError,
  requestId: string,
): void {
  const body: ApiErrorBody = {
    error: { code: apiError.code, message: apiError.message, requestId },
  };
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Request-Id", requestId);
  response.status(apiError.status).json(body);
}
