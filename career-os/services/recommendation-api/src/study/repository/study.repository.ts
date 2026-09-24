import { Injectable } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client.js";
import { ApiError } from "../../common/api-error.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type {
  StudyCandidatesQuery,
  StudyIngestion,
  StudyPublication,
  StudyRecommendationRun,
  StudySource,
  StudySourcePut,
} from "../schema.js";

type RawRow = Record<string, unknown>;
type DbClient = PrismaService | Prisma.TransactionClient;

function number(value: unknown): number {
  return Number(value);
}

function json(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  return (typeof value === "string" ? JSON.parse(value) : value) as Record<string, unknown>;
}

function date(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value : new Date(String(value));
}

type PageCursor = { publishedAt: string | null; contentKey: string };

type CandidateRow = {
  contentKey: string;
  canonicalUrl: string;
  sourceKey: string;
  sourceName: string;
  category: "techBlog" | "geek" | "ai" | "video";
  title: string;
  url: string;
  published: string;
  excerpt: string | null;
  kind: "feed-article" | "feed-video" | "page-link" | "page-video";
  publishedAt: Date | null;
};

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

  async lockCursor(sourceKey: string, mode: string, tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT cursor_json, version FROM study_source_cursors
      WHERE source_key = ${sourceKey} AND mode = ${mode} FOR UPDATE
    `;
    const row = rows[0];
    return row ? { cursor: json(row.cursor_json), version: number(row.version) } : undefined;
  }

  async upsertMaterial(item: StudyIngestion["items"][number], sourceKey: string, tx: Prisma.TransactionClient): Promise<void> {
    const publishedAt = item.publishedAt ? new Date(item.publishedAt) : null;
    const collectedAt = new Date(item.collectedAt);
    await tx.$executeRaw`
      INSERT INTO study_materials
        (content_key, canonical_url, url, title, published, published_at, excerpt, kind, first_collected_at, last_collected_at)
      VALUES (${item.contentKey}, ${item.canonicalUrl}, ${item.url}, ${item.title}, ${item.published},
              ${publishedAt}, ${item.excerpt}, ${item.kind}, ${collectedAt}, ${collectedAt})
      ON DUPLICATE KEY UPDATE title = VALUES(title), excerpt = VALUES(excerpt), last_collected_at = VALUES(last_collected_at)
    `;
    await tx.$executeRaw`
      INSERT INTO study_material_sources (content_key, source_key, first_collected_at)
      VALUES (${item.contentKey}, ${sourceKey}, ${collectedAt})
      ON DUPLICATE KEY UPDATE content_key = content_key
    `;
  }

  async replaceCursor(
    sourceKey: string,
    mode: string,
    cursor: Record<string, unknown> | null,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const cursorJson = cursor === null ? null : JSON.stringify(cursor);
    await tx.$executeRaw`
      INSERT INTO study_source_cursors (source_key, mode, cursor_json, version, updated_at)
      VALUES (${sourceKey}, ${mode}, ${cursorJson}, 1, NOW(3))
      ON DUPLICATE KEY UPDATE cursor_json = VALUES(cursor_json), version = version + 1, updated_at = NOW(3)
    `;
    const saved = await this.lockCursor(sourceKey, mode, tx);
    if (!saved) throw new Error("cursor를 저장하지 못했습니다.");
    return saved.version;
  }

  async getRecommendationControl(client: DbClient): Promise<{ candidateContextVersion: string; historyVersion: number } | undefined> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT candidate_context_version, history_version
      FROM study_recommendation_control WHERE singleton_id = 1
    `;
    const row = rows[0];
    return row
      ? { candidateContextVersion: String(row.candidate_context_version), historyVersion: number(row.history_version) }
      : undefined;
  }

  async lockRecommendationControl(tx: Prisma.TransactionClient): Promise<{ candidateContextVersion: string; historyVersion: number } | undefined> {
    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT candidate_context_version, history_version
      FROM study_recommendation_control WHERE singleton_id = 1 FOR UPDATE
    `;
    const row = rows[0];
    return row
      ? { candidateContextVersion: String(row.candidate_context_version), historyVersion: number(row.history_version) }
      : undefined;
  }

  async recommendationRunExists(reportId: string, client: DbClient): Promise<boolean> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT report_id FROM study_recommendation_runs WHERE report_id = ${reportId}
    `;
    return rows.length > 0;
  }

  async latestRecommendationTopicKeys(client: DbClient): Promise<string[]> {
    return this.recentStudyTopicKeys(client);
  }

  async existingMaterialKeys(contentKeys: string[], client: DbClient): Promise<Set<string>> {
    if (contentKeys.length === 0) return new Set();
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT content_key FROM study_materials WHERE content_key IN (${Prisma.join(contentKeys)})
    `;
    return new Set(rows.map((row) => String(row.content_key)));
  }

  async hasRecommendedMaterial(contentKeys: string[], client: DbClient): Promise<boolean> {
    if (contentKeys.length === 0) return false;
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT content_key FROM study_recommended_materials WHERE content_key IN (${Prisma.join(contentKeys)}) LIMIT 1
    `;
    return rows.length > 0;
  }

  async insertRecommendationRun(value: StudyRecommendationRun, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO study_recommendation_runs (report_id, generated_at, candidate_context_version, created_at)
      VALUES (${value.reportId}, ${new Date(value.generatedAt)}, ${value.candidateContextVersion}, NOW(3))
    `;
  }

  async insertRecommendationTopics(value: StudyRecommendationRun, tx: Prisma.TransactionClient): Promise<void> {
    for (const [index, topic] of value.topics.entries()) {
      await tx.$executeRaw`
        INSERT INTO study_recommendation_topics (report_id, topic_key, title, career_question, position)
        VALUES (${value.reportId}, ${topic.topicKey}, ${topic.title}, ${topic.careerQuestion}, ${index + 1})
      `;
    }
  }

  async insertRecommendedMaterials(value: StudyRecommendationRun, tx: Prisma.TransactionClient): Promise<void> {
    for (const topic of value.topics) {
      for (const [index, item] of topic.items.entries()) {
        await tx.$executeRaw`
          INSERT INTO study_recommended_materials
            (report_id, content_key, topic_key, summary, reason, career_value, position)
          VALUES (${value.reportId}, ${item.contentKey}, ${topic.topicKey}, ${item.summary}, ${item.reason},
                  ${item.careerValue}, ${index + 1})
        `;
      }
    }
  }

  async upsertRejections(value: StudyRecommendationRun, today: string, tx: Prisma.TransactionClient): Promise<void> {
    for (const rejection of value.rejections) {
      await tx.$executeRaw`
        INSERT INTO study_material_verdicts
          (content_key, candidate_context_version, verdict, reason, report_id, judged_at, valid_until)
        VALUES (${rejection.contentKey}, ${value.candidateContextVersion}, 'rejected', ${rejection.reason},
                ${value.reportId}, NOW(3), DATE_ADD(${today}, INTERVAL 30 DAY))
        ON DUPLICATE KEY UPDATE verdict = VALUES(verdict), reason = VALUES(reason), report_id = VALUES(report_id),
                                judged_at = VALUES(judged_at), valid_until = VALUES(valid_until)
      `;
    }
  }

  async incrementHistoryVersion(tx: Prisma.TransactionClient): Promise<number> {
    await tx.$executeRaw`
      UPDATE study_recommendation_control
      SET history_version = history_version + 1, updated_at = NOW(3)
      WHERE singleton_id = 1
    `;
    const control = await this.lockRecommendationControl(tx);
    if (!control) throw new Error("추천 이력 버전을 저장하지 못했습니다.");
    return control.historyVersion;
  }

  async updateCandidateContextVersion(candidateContextVersion: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`
      UPDATE study_recommendation_control
      SET candidate_context_version = ${candidateContextVersion}, updated_at = NOW(3)
      WHERE singleton_id = 1
    `;
  }

  async insertPublication(value: StudyPublication, tx: Prisma.TransactionClient): Promise<string> {
    const publicationId = crypto.randomUUID();
    await tx.$executeRaw`
      INSERT INTO study_publications (publication_id, report_id, channel, url, external_id, published_at)
      VALUES (${publicationId}, ${value.reportId}, ${value.channel}, ${value.url}, ${value.externalId}, ${new Date(value.publishedAt)})
    `;
    return publicationId;
  }

  async recentStudyTopicKeys(client: DbClient): Promise<string[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT topic_key
      FROM study_recommendation_topics
      WHERE report_id = (
        SELECT report_id FROM study_recommendation_runs
        ORDER BY generated_at DESC, report_id DESC LIMIT 1
      )
      ORDER BY position ASC, topic_key ASC
    `;
    return rows.map((row) => String(row.topic_key));
  }

  decodePageCursor(value: string | undefined): PageCursor | undefined {
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<PageCursor>;
      if ((typeof parsed.publishedAt !== "string" && parsed.publishedAt !== null) || typeof parsed.contentKey !== "string" || !parsed.contentKey) {
        throw new Error("invalid");
      }
      if (parsed.publishedAt !== null && Number.isNaN(new Date(parsed.publishedAt).getTime())) throw new Error("invalid");
      return { publishedAt: parsed.publishedAt ?? null, contentKey: parsed.contentKey };
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "후보 cursor가 올바르지 않습니다.");
    }
  }

  encodePageCursor(row: CandidateRow): string {
    return Buffer.from(JSON.stringify({ publishedAt: row.publishedAt?.toISOString() ?? null, contentKey: row.contentKey }), "utf8").toString("base64url");
  }

  async listCandidates(
    query: StudyCandidatesQuery & { today: string },
    client: DbClient,
  ): Promise<CandidateRow[]> {
    const cursor = this.decodePageCursor(query.cursor);
    const conditions = [
      "EXISTS (SELECT 1 FROM study_material_sources active_sms JOIN study_sources active_ss ON active_ss.source_key = active_sms.source_key WHERE active_sms.content_key = m.content_key AND active_ss.enabled = TRUE)",
      "NOT EXISTS (SELECT 1 FROM study_recommended_materials recommended WHERE recommended.content_key = m.content_key)",
      "NOT EXISTS (SELECT 1 FROM study_material_verdicts verdict JOIN study_recommendation_control control ON control.singleton_id = 1 WHERE verdict.content_key = m.content_key AND verdict.candidate_context_version = control.candidate_context_version AND verdict.valid_until > ?)",
    ];
    const params: unknown[] = [query.today];
    if (query.sourceKey) {
      conditions.push("ss.source_key = ?");
      params.push(query.sourceKey);
    }
    if (query.category) {
      conditions.push("ss.category = ?");
      params.push(query.category);
    }
    if (query.publishedFrom) {
      conditions.push("m.published_at >= ?");
      params.push(new Date(query.publishedFrom));
    }
    if (query.publishedTo) {
      conditions.push("m.published_at <= ?");
      params.push(new Date(query.publishedTo));
    }
    if (cursor) {
      if (cursor.publishedAt === null) {
        conditions.push("m.published_at IS NULL AND m.content_key > ?");
        params.push(cursor.contentKey);
      } else {
        conditions.push("(m.published_at IS NULL OR m.published_at < ? OR (m.published_at = ? AND m.content_key > ?))");
        const cursorDate = new Date(cursor.publishedAt);
        params.push(cursorDate, cursorDate, cursor.contentKey);
      }
    }
    params.push(query.limit + 1);
    const rows = await client.$queryRawUnsafe<RawRow[]>(`
      SELECT m.content_key, m.canonical_url, m.url, m.title, m.published, m.published_at, m.excerpt, m.kind,
             ss.source_key, ss.title AS source_name, ss.category
      FROM study_materials m
      JOIN study_material_sources sms ON sms.content_key = m.content_key
      JOIN study_sources ss ON ss.source_key = sms.source_key
      WHERE NOT EXISTS (
        SELECT 1 FROM study_material_sources earlier
        WHERE earlier.content_key = sms.content_key
          AND (earlier.first_collected_at < sms.first_collected_at
            OR (earlier.first_collected_at = sms.first_collected_at AND earlier.source_key < sms.source_key))
      )
      AND ${conditions.join("\n      AND ")}
      ORDER BY m.published_at IS NULL ASC, m.published_at DESC, m.content_key ASC
      LIMIT ?
    `, ...params);
    return rows.map((row) => ({
      contentKey: String(row.content_key),
      canonicalUrl: String(row.canonical_url),
      sourceKey: String(row.source_key),
      sourceName: String(row.source_name),
      category: row.category as CandidateRow["category"],
      title: String(row.title),
      url: String(row.url),
      published: String(row.published),
      excerpt: row.excerpt === null ? null : String(row.excerpt),
      kind: row.kind as CandidateRow["kind"],
      publishedAt: date(row.published_at),
    }));
  }
}
