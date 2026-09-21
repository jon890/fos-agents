import { timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, RequestHandler, Response } from "express";

import { ApiError } from "./api-error.js";
import { writeApiError } from "./error-response.js";
import { requestIdOf } from "./request-id.middleware.js";

/**
 * 인증을 요구하지 않는 경로.
 *
 * 전환 전 `app.ts` 는 이 둘만 `authorize` 앞에 두었다.
 * `/api/v1/auth/check` 는 `authorize` 뒤에 있으므로 여기 넣지 않는다.
 */
export const UNAUTHENTICATED_PATHS: ReadonlySet<string> = new Set([
  "/health/live",
  "/health/ready",
]);

/** 길이가 다르면 `timingSafeEqual` 이 예외를 던지므로 비교 전에 거른다. */
export function sameSecret(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

/**
 * 라우팅보다 먼저 인증한다.
 *
 * guard 로 두면 매칭된 route 에서만 돌아, 인증 없는 호출자가 `404` 와 `401` 의 차이로
 * 어느 경로가 실재하는지 알아낼 수 있다.
 * 전환 전 `app.ts` 는 경로 분기 전에 `authorize` 를 불러 token 없이는 모든 경로가 `401` 이었다.
 */
export function createAuthMiddleware(expectedToken: string): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (request.method === "GET" && UNAUTHENTICATED_PATHS.has(request.path)) {
      next();
      return;
    }
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ") || !sameSecret(header.slice(7), expectedToken)) {
      writeApiError(
        response,
        new ApiError(401, "UNAUTHORIZED", "인증 정보가 올바르지 않습니다."),
        requestIdOf(request),
      );
      return;
    }
    next();
  };
}
