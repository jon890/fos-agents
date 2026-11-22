import type { z } from "zod";
import { CareerStoreError } from "./errors.ts";

/** 본문이 계약 schema 와 다르면 `400 BAD_REQUEST` 다. zod 문구는 어긋난 값을 담을 수 있어 싣지 않는다. */
export function parseRequest<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new CareerStoreError(400, "BAD_REQUEST", "요청 본문이 계약과 다릅니다.");
  }
  return parsed.data;
}
