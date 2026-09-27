import type { PipeTransform } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { ZodError, type ZodType } from "zod";

import { ApiError } from "./api-error.js";

/** zod 오류를 전환 전 구현과 같은 한 줄로 만든다. */
export function contractErrorMessage(error: ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

/**
 * zod schema 로 본문을 검증한다.
 *
 * `position/schema.ts` 가 계약을 소유하고 `scripts/` 가 그것을 함께 읽으므로
 * class-validator 로 두 벌을 만들지 않는다.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new ApiError(400, "BAD_REQUEST", contractErrorMessage(parsed.error));
    }
    return parsed.data;
  }
}

/** 라우트 안에서 `schema.parse` 를 직접 쓸 때 오류 형식을 맞춘다. */
export function toContractError(error: unknown): never {
  if (error instanceof ZodError) {
    throw new ApiError(400, "BAD_REQUEST", contractErrorMessage(error));
  }
  throw error;
}
