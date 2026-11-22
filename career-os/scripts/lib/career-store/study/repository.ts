import { Sql, type CareerDatabase } from "../database.ts";
import { CareerStoreError as ApiError } from "../errors.ts";
import type {
  StudyCandidatesQuery,
  StudyIngestion,
  StudyPublication,
  StudyRecommendationRun,
  StudyRecommendationRunView,
  StudySource,
  StudySourcePut,
} from "./schema.ts";

type RawRow = Record<string, unknown>;
type DbClient = CareerDatabase;

/** 시각은 UTC ISO 문자열로 저장한다. */
function nowIso(): string {
  return new Date().toISOString();
}

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
    category: row.category as StudySource["category"],
    url: row.url === null ? null : String(row.url),
    feedUrl: row.feed_url === null ? null : String(row.feed_url),
    adapter: row.adapter as StudySource["adapter"],
    enabled: Boolean(row.enabled),
    note: row.note === null ? null : String(row.note),
    version: number(row.version),
  };
}

export class StudyRepository {
  constructor(private readonly db: CareerDatabase) {}

  reader(): DbClient {
    return this.db;
  }

  /** 쓰기 transaction 을 연다. 파일의 쓰기 잠금이 Backend 의 행 잠금을 대신한다. */
  transaction<T>(callback: (tx: DbClient) => Promise<T>): Promise<T> {
    return this.db.transaction(() => callback(this.db));
  }

  async listSources(client: DbClient): Promise<StudySource[]> {
    const rows = await client.queryRaw<RawRow[]>`
      SELECT source_key, title, category, url, feed_url, adapter, enabled, note, version
      FROM study_sources ORDER BY source_key
    `;
    return rows.map(source);
  }

  async lockSource(sourceKey: string, tx: DbClient): Promise<StudySource | undefined> {
    const rows = await tx.queryRaw<RawRow[]>`
      SELECT source_key, title, category, url, feed_url, adapter, enabled, note, version
      FROM study_sources WHERE source_key = ${sourceKey}
    `;
    return rows[0] ? source(rows[0]) : undefined;
  }

  async insertSource(sourceKey: string, value: StudySourcePut, tx: DbClient): Promise<void> {
    await tx.executeRaw`
      INSERT INTO study_sources
        (source_key, title, category, adapter, url, feed_url, enabled, note, version, created_at, updated_at)
      VALUES (${sourceKey}, ${value.title}, ${value.category}, ${value.adapter}, ${value.url},
              ${value.feedUrl}, ${value.enabled}, ${value.note ?? null}, 1, ${nowIso()}, ${nowIso()})
    `;
  }

  async updateSource(sourceKey: string, value: StudySourcePut, tx: DbClient): Promise<void> {
    await tx.executeRaw`
      UPDATE study_sources
      SET title = ${value.title}, category = ${value.category}, adapter = ${value.adapter},
          url = ${value.url}, feed_url = ${value.feedUrl}, enabled = ${value.enabled},
          note = ${value.note ?? null}, version = version + 1, updated_at = ${nowIso()}
      WHERE source_key = ${sourceKey}
    `;
  }

  async getSource(sourceKey: string, client: DbClient): Promise<StudySource | undefined> {
    const rows = await client.queryRaw<RawRow[]>`
      SELECT source_key, title, category, url, feed_url, adapter, enabled, note, version
      FROM study_sources WHERE source_key = ${sourceKey}
    `;
    return rows[0] ? source(rows[0]) : undefined;
  }

  async getCursor(sourceKey: string, mode: string, client: DbClient) {
    const rows = await client.queryRaw<RawRow[]>`
      SELECT cursor_json, version FROM study_source_cursors
      WHERE source_key = ${sourceKey} AND mode = ${mode}
    `;
    const row = rows[0];
    return row ? { cursor: json(row.cursor_json), version: number(row.version) } : undefined;
  }

  async lockCursor(sourceKey: string, mode: string, tx: DbClient) {
    const rows = await tx.queryRaw<RawRow[]>`
      SELECT cursor_json, version FROM study_source_cursors
      WHERE source_key = ${sourceKey} AND mode = ${mode}
    `;
    const row = rows[0];
    return row ? { cursor: json(row.cursor_json), version: number(row.version) } : undefined;
  }

  async upsertMaterial(item: StudyIngestion["items"][number], sourceKey: string, tx: DbClient): Promise<void> {
    const publishedAt = item.publishedAt ? new Date(item.publishedAt).toISOString() : null;
    const collectedAt = new Date(item.collectedAt).toISOString();
    await tx.executeRaw`
      INSERT INTO study_materials
        (content_key, canonical_url, url, title, published, published_at, excerpt, kind, first_collected_at, last_collected_at)
      VALUES (${item.contentKey}, ${item.canonicalUrl}, ${item.url}, ${item.title}, ${item.published},
              ${publishedAt}, ${item.excerpt}, ${item.kind}, ${collectedAt}, ${collectedAt})
      ON CONFLICT(content_key) DO UPDATE SET title = excluded.title, excerpt = excluded.excerpt, last_collected_at = excluded.last_collected_at
    `;
    await tx.executeRaw`
      INSERT INTO study_material_sources (content_key, source_key, first_collected_at)
      VALUES (${item.contentKey}, ${sourceKey}, ${collectedAt})
      ON CONFLICT(content_key, source_key) DO NOTHING
    `;
  }

  async replaceCursor(
    sourceKey: string,
    mode: string,
    cursor: Record<string, unknown> | null,
    tx: DbClient,
  ): Promise<number> {
    const cursorJson = cursor === null ? null : JSON.stringify(cursor);
    await tx.executeRaw`
      INSERT INTO study_source_cursors (source_key, mode, cursor_json, version, updated_at)
      VALUES (${sourceKey}, ${mode}, ${cursorJson}, 1, ${nowIso()})
      ON CONFLICT(source_key, mode) DO UPDATE SET cursor_json = excluded.cursor_json, version = version + 1, updated_at = ${nowIso()}
    `;
    const saved = await this.lockCursor(sourceKey, mode, tx);
    if (!saved) throw new Error("cursor를 저장하지 못했습니다.");
    return saved.version;
  }

  async getRecommendationControl(client: DbClient): Promise<{ historyVersion: number } | undefined> {
    const rows = await client.queryRaw<RawRow[]>`
      SELECT history_version
      FROM study_recommendation_control WHERE singleton_id = 1
    `;
    const row = rows[0];
    return row ? { historyVersion: number(row.history_version) } : undefined;
  }

  async lockRecommendationControl(tx: DbClient): Promise<{ historyVersion: number } | undefined> {
    const rows = await tx.queryRaw<RawRow[]>`
      SELECT history_version
      FROM study_recommendation_control WHERE singleton_id = 1
    `;
    const row = rows[0];
    return row ? { historyVersion: number(row.history_version) } : undefined;
  }

  async recommendationRunExists(reportId: string, client: DbClient): Promise<boolean> {
    const rows = await client.queryRaw<RawRow[]>`
      SELECT report_id FROM study_recommendation_runs WHERE report_id = ${reportId}
    `;
    return rows.length > 0;
  }

  async latestRecommendationTopicKeys(client: DbClient): Promise<string[]> {
    return this.recentStudyTopicKeys(client);
  }

  async existingMaterialKeys(contentKeys: string[], client: DbClient): Promise<Set<string>> {
    if (contentKeys.length === 0) return new Set();
    const rows = await client.queryRaw<RawRow[]>`
      SELECT content_key FROM study_materials WHERE content_key IN (${Sql.join(contentKeys)})
    `;
    return new Set(rows.map((row) => String(row.content_key)));
  }

  async hasRecommendedMaterial(contentKeys: string[], client: DbClient): Promise<boolean> {
    if (contentKeys.length === 0) return false;
    const rows = await client.queryRaw<RawRow[]>`
      SELECT content_key FROM study_recommended_materials WHERE content_key IN (${Sql.join(contentKeys)}) LIMIT 1
    `;
    return rows.length > 0;
  }

  async insertRecommendationRun(value: StudyRecommendationRun, tx: DbClient): Promise<void> {
    await tx.executeRaw`
      INSERT INTO study_recommendation_runs (report_id, generated_at, candidate_context_version, created_at)
      VALUES (${value.reportId}, ${new Date(value.generatedAt).toISOString()}, ${value.candidateContextVersion}, ${nowIso()})
    `;
  }

  async insertRecommendationTopics(value: StudyRecommendationRun, tx: DbClient): Promise<void> {
    for (const [index, topic] of value.topics.entries()) {
      await tx.executeRaw`
        INSERT INTO study_recommendation_topics (report_id, topic_key, title, career_question, position)
        VALUES (${value.reportId}, ${topic.topicKey}, ${topic.title}, ${topic.careerQuestion}, ${index + 1})
      `;
    }
  }

  async insertRecommendedMaterials(value: StudyRecommendationRun, tx: DbClient): Promise<void> {
    for (const topic of value.topics) {
      for (const [index, item] of topic.items.entries()) {
        await tx.executeRaw`
          INSERT INTO study_recommended_materials
            (report_id, content_key, topic_key, summary, reason, career_value, position)
          VALUES (${value.reportId}, ${item.contentKey}, ${topic.topicKey}, ${item.summary}, ${item.reason},
                  ${item.careerValue}, ${index + 1})
        `;
      }
    }
  }

  async upsertRejections(value: StudyRecommendationRun, today: string, tx: DbClient): Promise<void> {
    for (const rejection of value.rejections) {
      await tx.executeRaw`
        INSERT INTO study_material_verdicts
          (content_key, candidate_context_version, verdict, reason, report_id, judged_at, valid_until)
        VALUES (${rejection.contentKey}, ${value.candidateContextVersion}, 'rejected', ${rejection.reason},
                ${value.reportId}, ${nowIso()}, date(${today}, '+30 days'))
        ON CONFLICT(content_key, candidate_context_version) DO UPDATE SET verdict = excluded.verdict, reason = excluded.reason, report_id = excluded.report_id,
                                judged_at = excluded.judged_at, valid_until = excluded.valid_until
      `;
    }
  }

  async incrementHistoryVersion(tx: DbClient): Promise<number> {
    await tx.executeRaw`
      UPDATE study_recommendation_control
      SET history_version = history_version + 1, updated_at = ${nowIso()}
      WHERE singleton_id = 1
    `;
    const control = await this.lockRecommendationControl(tx);
    if (!control) throw new Error("추천 이력 버전을 저장하지 못했습니다.");
    return control.historyVersion;
  }

  async insertPublication(value: StudyPublication, tx: DbClient): Promise<string> {
    const publicationId = crypto.randomUUID();
    await tx.executeRaw`
      INSERT INTO study_publications (publication_id, report_id, channel, url, external_id, published_at)
      VALUES (${publicationId}, ${value.reportId}, ${value.channel}, ${value.url}, ${value.externalId}, ${new Date(value.publishedAt).toISOString()})
    `;
    return publicationId;
  }

  /** 최신 `limit` 건의 추천 실행을 주제와 자료 제목까지 읽는다. 쿼리는 세 번이고 `limit` 이 100 이하라 크기가 작다. */
  async listRecommendationRuns(limit: number, client: DbClient): Promise<StudyRecommendationRunView[]> {
    const runRows = await client.queryRaw<RawRow[]>`
      SELECT report_id, generated_at
      FROM study_recommendation_runs
      ORDER BY generated_at DESC, report_id DESC
      LIMIT ${limit}
    `;
    if (runRows.length === 0) return [];
    const reportIds = runRows.map((row) => String(row.report_id));
    const topicRows = await client.queryRaw<RawRow[]>`
      SELECT report_id, topic_key, title, career_question
      FROM study_recommendation_topics
      WHERE report_id IN (${Sql.join(reportIds)})
      ORDER BY report_id ASC, position ASC, topic_key ASC
    `;
    const itemRows = await client.queryRaw<RawRow[]>`
      SELECT r.report_id, r.topic_key, r.content_key, m.title, m.url
      FROM study_recommended_materials r
      JOIN study_materials m ON m.content_key = r.content_key
      WHERE r.report_id IN (${Sql.join(reportIds)})
      ORDER BY r.report_id ASC, r.topic_key ASC, r.position ASC, r.content_key ASC
    `;
    const publicationRows = await client.queryRaw<RawRow[]>`
      SELECT report_id, channel, url, external_id, published_at
      FROM study_publications
      WHERE report_id IN (${Sql.join(reportIds)})
      ORDER BY published_at ASC, publication_id ASC
    `;
    return runRows.map((run) => {
      const reportId = String(run.report_id);
      return {
        reportId,
        publications: publicationRows
          .filter((publication) => String(publication.report_id) === reportId)
          .map((publication) => ({
            channel: String(publication.channel),
            url: publication.url === null ? null : String(publication.url),
            externalId: publication.external_id === null ? null : String(publication.external_id),
            publishedAt: (date(publication.published_at) as Date).toISOString(),
          })),
        generatedAt: (date(run.generated_at) as Date).toISOString(),
        topics: topicRows
          .filter((topic) => String(topic.report_id) === reportId)
          .map((topic) => ({
            topicKey: String(topic.topic_key),
            title: String(topic.title),
            careerQuestion: topic.career_question === null ? null : String(topic.career_question),
            items: itemRows
              .filter((item) => String(item.report_id) === reportId && String(item.topic_key) === String(topic.topic_key))
              .map((item) => ({ contentKey: String(item.content_key), title: String(item.title), url: String(item.url) })),
          })),
      };
    });
  }

  async recentStudyTopicKeys(client: DbClient): Promise<string[]> {
    const rows = await client.queryRaw<RawRow[]>`
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
    query: StudyCandidatesQuery & { candidateContextVersion: string; today: string },
    client: DbClient,
  ): Promise<CandidateRow[]> {
    const cursor = this.decodePageCursor(query.cursor);
    const conditions = [
      "EXISTS (SELECT 1 FROM study_material_sources active_sms JOIN study_sources active_ss ON active_ss.source_key = active_sms.source_key WHERE active_sms.content_key = m.content_key AND active_ss.enabled = 1)",
      "NOT EXISTS (SELECT 1 FROM study_recommended_materials recommended WHERE recommended.content_key = m.content_key)",
      "NOT EXISTS (SELECT 1 FROM study_material_verdicts verdict WHERE verdict.content_key = m.content_key AND verdict.candidate_context_version = ? AND verdict.valid_until > ?)",
    ];
    const params: unknown[] = [query.candidateContextVersion, query.today];
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
      params.push(new Date(query.publishedFrom).toISOString());
    }
    if (query.publishedTo) {
      conditions.push("m.published_at <= ?");
      params.push(new Date(query.publishedTo).toISOString());
    }
    if (cursor) {
      if (cursor.publishedAt === null) {
        conditions.push("m.published_at IS NULL AND m.content_key > ?");
        params.push(cursor.contentKey);
      } else {
        conditions.push("(m.published_at IS NULL OR m.published_at < ? OR (m.published_at = ? AND m.content_key > ?))");
        const cursorDate = new Date(cursor.publishedAt).toISOString();
        params.push(cursorDate, cursorDate, cursor.contentKey);
      }
    }
    params.push(query.limit + 1);
    const rows = await client.queryRawUnsafe<RawRow[]>(`
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
