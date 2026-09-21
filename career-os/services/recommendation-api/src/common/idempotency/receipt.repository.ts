import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service.js";

export type StoredResponse = { status: number; body: unknown };

export type RequestReceipt = {
  requestHash: string;
  state: "processing" | "completed";
  response?: StoredResponse;
};

type ReceiptRow = {
  request_hash: string;
  state: "processing" | "completed";
  response_status: number | null;
  response_body: unknown;
};

function responseBody(value: unknown): unknown {
  return typeof value === "string" ? (JSON.parse(value) as unknown) : value;
}

@Injectable()
export class ReceiptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getReceipt(key: string): Promise<RequestReceipt | undefined> {
    const rows = await this.prisma.$queryRaw<ReceiptRow[]>`
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
          ? { status: Number(row.response_status), body: responseBody(row.response_body) }
          : undefined,
    };
  }

  /**
   * 선점한다. 같은 키가 이미 있으면 `false` 다.
   *
   * `INSERT IGNORE` 뒤 영향받은 행 수로 판정한다.
   * `$executeRaw` 가 그 수를 반환값으로 직접 준다.
   */
  async startReceipt(key: string, requestHash: string): Promise<boolean> {
    const affected = await this.prisma.$executeRaw`
      INSERT IGNORE INTO request_receipts
        (idempotency_key, request_hash, state, created_at, updated_at)
      VALUES (${key}, ${requestHash}, 'processing', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
    `;
    return affected === 1;
  }

  async completeReceipt(
    key: string,
    requestHash: string,
    response: StoredResponse,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE request_receipts
      SET state = 'completed', response_status = ${response.status},
          response_body = ${JSON.stringify(response.body)}, updated_at = CURRENT_TIMESTAMP(3)
      WHERE idempotency_key = ${key} AND request_hash = ${requestHash}
    `;
  }

  async abandonReceipt(key: string, requestHash: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM request_receipts
      WHERE idempotency_key = ${key} AND request_hash = ${requestHash} AND state = 'processing'
    `;
  }
}
