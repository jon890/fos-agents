import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

import { Prisma } from "../generated/prisma/client.js";
import { ApiError, type ApiErrorCode } from "./api-error.js";
import { writeApiError } from "./error-response.js";
import { requestIdOf } from "./request-id.middleware.js";

/** Prisma 가 연결 자체를 만들지 못했을 때 내는 오류 코드. */
const CONNECTION_ERROR_CODES: ReadonlySet<string> = new Set(["P1001", "P1002", "P1017"]);

const STATUS_CODES = new Map<number, ApiErrorCode>([
  [HttpStatus.BAD_REQUEST, "BAD_REQUEST"],
  [HttpStatus.UNAUTHORIZED, "UNAUTHORIZED"],
  [HttpStatus.FORBIDDEN, "UNAUTHORIZED"],
  [HttpStatus.NOT_FOUND, "NOT_FOUND"],
  [HttpStatus.CONFLICT, "VERSION_CONFLICT"],
  [HttpStatus.PAYLOAD_TOO_LARGE, "BODY_TOO_LARGE"],
  [HttpStatus.SERVICE_UNAVAILABLE, "DATABASE_UNAVAILABLE"],
]);

const STATUS_MESSAGES = new Map<number, string>([
  [HttpStatus.BAD_REQUEST, "요청이 올바르지 않습니다."],
  [HttpStatus.UNAUTHORIZED, "인증 정보가 올바르지 않습니다."],
  [HttpStatus.FORBIDDEN, "인증 정보가 올바르지 않습니다."],
  [HttpStatus.NOT_FOUND, "경로를 찾을 수 없습니다."],
  [HttpStatus.CONFLICT, "요청이 현재 상태와 맞지 않습니다."],
  [HttpStatus.PAYLOAD_TOO_LARGE, "요청 본문이 허용 크기를 넘었습니다."],
  [HttpStatus.SERVICE_UNAVAILABLE, "추천 상태 저장소를 사용할 수 없습니다."],
]);

/**
 * Prisma 의 연결 실패인지 판정한다.
 *
 * 전환 전에는 저장소 구현이 `503 DATABASE_UNAVAILABLE` 을 직접 던졌다.
 * 그 구현이 사라지므로 이 filter 가 그 책임을 받는다.
 */
export function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (!error || typeof error !== "object") return false;
  const code = (error as { errorCode?: unknown; code?: unknown }).errorCode ?? (error as { code?: unknown }).code;
  return typeof code === "string" && CONNECTION_ERROR_CODES.has(code);
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isDatabaseUnavailable(error)) {
    return new ApiError(503, "DATABASE_UNAVAILABLE", "추천 상태 저장소를 사용할 수 없습니다.");
  }
  if (error instanceof HttpException) {
    const status = error.getStatus();
    const code = STATUS_CODES.get(status);
    if (code) {
      return new ApiError(status, code, STATUS_MESSAGES.get(status)!);
    }
  }
  // 원본 메시지는 담지 않는다. 내부 사정이 공개 응답으로 새어 나가지 않게 한다.
  return new ApiError(500, "INTERNAL_ERROR", "요청을 처리하지 못했습니다.");
}

/**
 * 모든 오류를 `{ error: { code, message, requestId } }` 하나로 낸다.
 *
 * NestJS 의 기본 형식(`{ statusCode, message, error }`)을 쓰지 않는다.
 * client 가 `error.code` 로 분기하므로 기본값이 나가면 오류 코드를 읽지 못한다.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const requestId = requestIdOf(http.getRequest());
    writeApiError(response, toApiError(exception), requestId);
  }
}
