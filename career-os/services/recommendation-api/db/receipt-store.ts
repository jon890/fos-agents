import type { ReceiptStore, RequestReceipt, StoredResponse } from "../http/idempotency.ts";

type ReceiptRow = {
  request_hash: string;
  state: "processing" | "completed";
  response_status: number | null;
  response_body: unknown | null;
};

function responseBody(value: unknown): unknown {
  return typeof value === "string" ? (JSON.parse(value) as unknown) : value;
}

// Bun의 MySQL driver는 DML 결과의 `count`에 반환한 행 수를 담으므로 INSERT와 UPDATE에서 항상 0이다.
// 실제로 바뀐 행 수는 `affectedRows`에만 들어온다.
function affectedRows(result: unknown): number {
  return (result as { affectedRows?: number }).affectedRows ?? 0;
}

export class SqlReceiptStore implements ReceiptStore {
  constructor(private readonly sql: Bun.SQL) {}

  async getReceipt(key: string): Promise<RequestReceipt | undefined> {
    const rows = await this.sql<ReceiptRow[]>`
      SELECT request_hash, state, response_status, response_body
      FROM request_receipts
      WHERE idempotency_key = ${key}
    `;
    const row = rows[0];
    if (!row) return undefined;
    return {
      requestHash: row.request_hash,
      state: row.state,
      response:
        row.state === "completed" && row.response_status !== null && row.response_body !== null
          ? { status: row.response_status, body: responseBody(row.response_body) }
          : undefined,
    };
  }

  async startReceipt(key: string, requestHash: string): Promise<boolean> {
    const result = await this.sql`
      INSERT IGNORE INTO request_receipts
        (idempotency_key, request_hash, state, created_at, updated_at)
      VALUES (${key}, ${requestHash}, 'processing', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
    `;
    return affectedRows(result) === 1;
  }

  async completeReceipt(key: string, requestHash: string, response: StoredResponse): Promise<void> {
    await this.sql`
      UPDATE request_receipts
      SET state = 'completed', response_status = ${response.status},
          response_body = ${JSON.stringify(response.body)}, updated_at = CURRENT_TIMESTAMP(3)
      WHERE idempotency_key = ${key} AND request_hash = ${requestHash}
    `;
  }

  async abandonReceipt(key: string, requestHash: string): Promise<void> {
    await this.sql`
      DELETE FROM request_receipts
      WHERE idempotency_key = ${key} AND request_hash = ${requestHash} AND state = 'processing'
    `;
  }
}
