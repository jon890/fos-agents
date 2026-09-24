import { Injectable } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { StudySource, StudySourcePut } from "../schema.js";

type RawRow = Record<string, unknown>;
type DbClient = PrismaService | Prisma.TransactionClient;

function number(value: unknown): number {
  return Number(value);
}

function json(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  return (typeof value === "string" ? JSON.parse(value) : value) as Record<string, unknown>;
}

function source(row: RawRow): StudySource {
  return {
    sourceKey: String(row.source_key),
    title: String(row.title),
    category: String(row.category),
    url: row.url === null ? null : String(row.url),
    feedUrl: row.feed_url === null ? null : String(row.feed_url),
    adapter: row.adapter as StudySource["adapter"],
    enabled: Boolean(row.enabled),
    note: row.note === null ? null : String(row.note),
    version: number(row.version),
  };
}

@Injectable()
export class StudyRepository {
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

  async listSources(client: DbClient): Promise<StudySource[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT source_key, title, category, url, feed_url, adapter, enabled, note, version
      FROM study_sources ORDER BY source_key
    `;
    return rows.map(source);
  }

  async lockSource(sourceKey: string, tx: Prisma.TransactionClient): Promise<StudySource | undefined> {
    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT source_key, title, category, url, feed_url, adapter, enabled, note, version
      FROM study_sources WHERE source_key = ${sourceKey} FOR UPDATE
    `;
    return rows[0] ? source(rows[0]) : undefined;
  }

  async insertSource(sourceKey: string, value: StudySourcePut, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO study_sources
        (source_key, title, category, adapter, url, feed_url, enabled, note, version, created_at, updated_at)
      VALUES (${sourceKey}, ${value.title}, ${value.category}, ${value.adapter}, ${value.url},
              ${value.feedUrl}, ${value.enabled}, ${value.note ?? null}, 1, NOW(3), NOW(3))
    `;
  }

  async updateSource(sourceKey: string, value: StudySourcePut, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`
      UPDATE study_sources
      SET title = ${value.title}, category = ${value.category}, adapter = ${value.adapter},
          url = ${value.url}, feed_url = ${value.feedUrl}, enabled = ${value.enabled},
          note = ${value.note ?? null}, version = version + 1, updated_at = NOW(3)
      WHERE source_key = ${sourceKey}
    `;
  }

  async getSource(sourceKey: string, client: DbClient): Promise<StudySource | undefined> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT source_key, title, category, url, feed_url, adapter, enabled, note, version
      FROM study_sources WHERE source_key = ${sourceKey}
    `;
    return rows[0] ? source(rows[0]) : undefined;
  }

  async getCursor(sourceKey: string, mode: string, client: DbClient) {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT cursor_json, version FROM study_source_cursors
      WHERE source_key = ${sourceKey} AND mode = ${mode}
    `;
    const row = rows[0];
    return row ? { cursor: json(row.cursor_json), version: number(row.version) } : undefined;
  }
}
