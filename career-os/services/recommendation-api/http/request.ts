import { timingSafeEqual } from "node:crypto";
import { ApiError } from "./errors.ts";

function sameSecret(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function authorize(request: Request, expectedToken: string): void {
  const value = request.headers.get("Authorization");
  if (!value?.startsWith("Bearer ") || !sameSecret(value.slice(7), expectedToken)) {
    throw new ApiError(401, "UNAUTHORIZED", "인증 정보가 올바르지 않습니다.");
  }
}

export function requireIdempotencyKey(request: Request): string {
  const value = request.headers.get("Idempotency-Key")?.trim();
  if (!value || value.length > 200) {
    throw new ApiError(400, "BAD_REQUEST", "Idempotency-Key가 필요합니다.");
  }
  return value;
}

export async function readJson(request: Request, maxBodyBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    throw new ApiError(400, "BODY_TOO_LARGE", "요청 본문이 허용 크기를 넘었습니다.");
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBodyBytes) {
    throw new ApiError(400, "BODY_TOO_LARGE", "요청 본문이 허용 크기를 넘었습니다.");
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "JSON 요청 본문이 올바르지 않습니다.");
  }
}

export function requestId(request: Request): string {
  const supplied = request.headers.get("X-Request-Id")?.trim();
  return supplied && supplied.length <= 100 ? supplied : crypto.randomUUID();
}
