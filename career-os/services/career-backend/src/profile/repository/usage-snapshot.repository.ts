import { Injectable } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { UsageSnapshot, UsageSnapshotPut } from "../schema.js";

type RawRow = Record<string, unknown>;
type DbClient = PrismaService | Prisma.TransactionClient;

function isoDateTime(value: unknown): string {
  return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

/** 프로세스 시간대가 UTC 라 `DATE` 칸을 `Date` 로 받아도 날짜가 밀리지 않는다. */
function isoDay(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(String(value));
}

function snapshot(row: RawRow): UsageSnapshot {
  return {
    month: String(row.month),
    claudeTokens: Number(row.claude_tokens),
    codexTokens: Number(row.codex_tokens),
    claudeCostUsd: nullableNumber(row.claude_cost_usd),
    codexCostUsd: nullableNumber(row.codex_cost_usd),
    sessions: nullableNumber(row.sessions),
    unpricedTokens: Number(row.unpriced_tokens),
    measuredOn: isoDay(row.measured_on),
    source: String(row.source) as UsageSnapshot["source"],
    note: row.note === null || row.note === undefined ? null : String(row.note),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
  };
}

const columns = Prisma.sql`
  month, claude_tokens, codex_tokens, claude_cost_usd, codex_cost_usd, sessions,
  unpriced_tokens, measured_on, source, note, created_at, updated_at
`;

@Injectable()
export class UsageSnapshotRepository {
  constructor(private readonly prisma: PrismaService) {}

  reader(): DbClient {
    return this.prisma;
  }

  transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback, {
      maxWait: 30_000,
      timeout: 30_000,
      isolationLevel: "ReadCommitted",
    });
  }

  async listSnapshots(client: DbClient): Promise<UsageSnapshot[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT ${columns} FROM agent_usage_snapshots ORDER BY month
    `;
    return rows.map(snapshot);
  }

  async getSnapshot(month: string, client: DbClient): Promise<UsageSnapshot | undefined> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT ${columns} FROM agent_usage_snapshots WHERE month = ${month}
    `;
    return rows[0] ? snapshot(rows[0]) : undefined;
  }

  async lockSnapshot(month: string, tx: Prisma.TransactionClient): Promise<UsageSnapshot | undefined> {
    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT ${columns} FROM agent_usage_snapshots WHERE month = ${month} FOR UPDATE
    `;
    return rows[0] ? snapshot(rows[0]) : undefined;
  }

  /**
   * 그 달의 행이 없을 때만 넣는다. 넣었으면 `true`, 이미 있었으면 `false` 다.
   *
   * `INSERT IGNORE` 뒤 `$executeRaw` 가 돌려준 영향받은 행 수로 판정한다.
   */
  async insertIfAbsent(month: string, value: UsageSnapshotPut, tx: Prisma.TransactionClient): Promise<boolean> {
    const affected = await tx.$executeRaw`
      INSERT IGNORE INTO agent_usage_snapshots
        (month, claude_tokens, codex_tokens, claude_cost_usd, codex_cost_usd, sessions,
         unpriced_tokens, measured_on, source, note, created_at, updated_at)
      VALUES (${month}, ${value.claudeTokens}, ${value.codexTokens}, ${value.claudeCostUsd ?? null},
        ${value.codexCostUsd ?? null}, ${value.sessions ?? null}, ${value.unpricedTokens},
        ${value.measuredOn}, ${value.source}, ${value.note ?? null}, NOW(3), NOW(3))
    `;
    return affected === 1;
  }

  /** `created_at` 을 뺀 값 칸을 모두 바꾼다. 사람이 사유를 남긴 교체에서만 부른다. */
  async replaceSnapshot(month: string, value: UsageSnapshotPut, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`
      UPDATE agent_usage_snapshots
      SET claude_tokens = ${value.claudeTokens}, codex_tokens = ${value.codexTokens},
          claude_cost_usd = ${value.claudeCostUsd ?? null}, codex_cost_usd = ${value.codexCostUsd ?? null},
          sessions = ${value.sessions ?? null}, unpriced_tokens = ${value.unpricedTokens},
          measured_on = ${value.measuredOn}, source = ${value.source}, note = ${value.note ?? null},
          updated_at = NOW(3)
      WHERE month = ${month}
    `;
  }
}
