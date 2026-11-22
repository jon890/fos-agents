import type { CareerDatabase } from "./database.ts";
import { CareerStoreError } from "./errors.ts";
import { canonicalRequestHash } from "./request-hash.ts";

const MAX_KEY_LENGTH = 200;

/**
 * 같은 명령을 다시 보냈을 때 처음 응답을 그대로 돌려준다.
 *
 * Backend 는 처리 전에 「처리 중」 행을 먼저 넣어 동시 요청을 막았다. 여기서는 그 행을 두지 않는다.
 * 실행기 프로세스가 도중에 죽으면 그 행이 남아 같은 명령이 영영 막히기 때문이다.
 * 처리와 응답 기록은 한 쓰기 transaction 이라, 기록이 없으면 처리도 반영되지 않은 것이다.
 */
export async function runWithReceipt<T>(
  db: CareerDatabase,
  idempotencyKey: string | undefined,
  body: unknown,
  status: number,
  handler: () => Promise<T>,
): Promise<T> {
  const key = idempotencyKey?.trim();
  if (!key || key.length > MAX_KEY_LENGTH) {
    throw new CareerStoreError(400, "BAD_REQUEST", "Idempotency-Key가 필요합니다.");
  }
  const requestHash = canonicalRequestHash(body);
  // 처리와 응답 기록을 한 transaction 으로 묶는다. handler 안의 쓰기 transaction 은 이 안에서 그대로 돈다.
  // 따로 두면 처리는 커밋됐는데 기록 전에 죽었을 때, 다시 보낸 같은 명령이 한 번 더 반영될 수 있다.
  // 기록도 쓰기 잠금 안에서 읽는다. 잠금 밖에서 읽으면 같은 키의 두 실행이 함께 「기록 없음」 을 보고 둘 다 처리한다.
  return db.transaction(async () => {
    const existing = db.get<{ request_hash: string; response_body: string }>(
      "SELECT request_hash, response_body FROM request_receipts WHERE idempotency_key = ?",
      [key],
    );
    if (existing) {
      if (existing.request_hash !== requestHash) {
        throw new CareerStoreError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "같은 멱등 키에 다른 요청 본문이 왔습니다.",
        );
      }
      return JSON.parse(existing.response_body) as T;
    }
    const result = await handler();
    db.run(
      `INSERT OR IGNORE INTO request_receipts
         (idempotency_key, request_hash, response_status, response_body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [key, requestHash, status, JSON.stringify(result ?? null), new Date().toISOString()],
    );
    return result;
  });
}
