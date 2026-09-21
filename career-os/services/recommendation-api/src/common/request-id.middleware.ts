import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/** 요청 객체에 요청 ID 를 싣는 자리. filter 와 interceptor 가 같은 값을 읽는다. */
const REQUEST_ID = Symbol.for("recommendation-api.requestId");

/** 받은 `X-Request-Id` 를 그대로 쓸 수 있는 최대 길이. */
const MAX_SUPPLIED_LENGTH = 100;

type RequestWithId = Request & { [REQUEST_ID]?: string };

/**
 * 요청 ID 를 정하고 모든 응답에 공통 헤더를 붙인다.
 *
 * 받은 값이 100자를 넘으면 쓰지 않고 새로 만든다.
 */
export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const header = request.headers["x-request-id"];
  const supplied = (Array.isArray(header) ? header[0] : header)?.trim();
  const id = supplied && supplied.length <= MAX_SUPPLIED_LENGTH ? supplied : randomUUID();
  (request as RequestWithId)[REQUEST_ID] = id;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Request-Id", id);
  next();
}

/** middleware 가 실린 요청 ID 를 읽는다. 없으면 새로 만든다. */
export function requestIdOf(request: unknown): string {
  const carried = (request as RequestWithId | undefined)?.[REQUEST_ID];
  return carried ?? randomUUID();
}
