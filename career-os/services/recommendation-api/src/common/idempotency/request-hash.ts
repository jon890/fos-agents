import { createHash } from "node:crypto";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

/**
 * 요청 본문의 정규화 해시.
 *
 * 운영 `request_receipts.request_hash` 에 이미 저장된 값과 같아야 한다.
 * 만드는 방식이 달라지면 배포 직후의 재시도가 전부 `409 IDEMPOTENCY_CONFLICT` 가 된다.
 */
export function canonicalRequestHash(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;
}
