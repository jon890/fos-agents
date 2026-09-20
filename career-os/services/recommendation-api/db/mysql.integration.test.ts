import { expect, test } from "bun:test";
import { resolve } from "node:path";
import type { PostingCandidatePool } from "../../../scripts/position-recommender/live-postings/contracts.ts";
import { MemoryPositionRepository } from "../position/memory-repository.ts";
import { PositionService } from "../position/service.ts";
import { SqlPositionRepository } from "../position/sql-repository.ts";
import { applyMigrations, loadMigrations, splitMigrationStatements } from "./migrations.ts";

const databaseUrl = process.env.CAREER_RECOMMENDATION_TEST_DATABASE_URL;

if (!databaseUrl) {
  console.info(
    "CAREER_RECOMMENDATION_TEST_DATABASE_URL이 없어 MySQL 통합 검사를 건너뜁니다. 기록 순서와 감사 조회는 확인하지 않았습니다.",
  );
}

const tables = [
  "company_tier_assessment_run_items",
  "company_tier_assessments",
  "company_tier_assessment_runs",
  "position_recommendation_items",
  "position_recommendation_runs",
  "position_analysis_run_items",
  "position_analyses",
  "position_analysis_runs",
  "position_collection_items",
  "position_source_run_diagnostics",
  "position_collection_runs",
  "position_versions",
  "positions",
  "position_sources",
  "company_preferences",
  "position_analysis_policy",
  "request_receipts",
];

function pool(runId: string): PostingCandidatePool {
  return {
    schemaVersion: 1,
    collectionRunId: runId,
    collectedAt: "2026-09-17T00:00:00.000Z",
    requestedSource: "all",
    configuredSources: ["wanted"],
    policy: {
      selection: "llm",
      activeDirectOnly: true,
      fixedPreferenceKeywordsUsed: false,
      sourcePriorityUsed: false,
    },
    candidates: [1, 2].map((index) => ({
      id: `wanted:candidate-${index}`,
      source: "wanted",
      company: `회사 ${index}`,
      title: `Backend Engineer ${index}`,
      url: `https://example.com/jobs/${index}`,
      identityHash: `wanted:${index}`,
      linkType: "direct_posting",
      postingStatus: "active",
      activeEvidence: "active",
      openedAt: "",
      closesAt: "",
      daysUntilClose: "",
      closeUrgency: "normal",
      category: "개발",
      summary: "서버 개발",
      tags: [],
      skills: ["Java"],
      dueTime: "",
      mainTasks: "서버 개발",
      requirements: "Java",
      preferred: "",
    })),
    sourceDiagnostics: [
      {
        source: "wanted",
        status: "ok",
        collectedCount: 2,
        importedCount: 2,
        skippedCount: 0,
        failedCount: 0,
        discoveryModes: ["broad"],
        message: "ok",
      },
    ],
    filterSummary: { personalExcludedCount: 0 },
    errors: [],
  };
}

function analysisResult(positionId: string) {
  return {
    positionId,
    decision: "recommend" as const,
    fitScore: 80,
    scoreBreakdown: { roleFit: 35, scopeUpside: 20, companyOpportunity: 15, constraints: 10 },
    reason: "현재 경험을 확장할 수 있다.",
    details: [],
    nextActions: [],
  };
}

test.skipIf(!databaseUrl)(
  "CAREER_RECOMMENDATION_TEST_DATABASE_URL이 있으면 MySQL 연결을 확인한다",
  async () => {
    const sql = new Bun.SQL(databaseUrl!);
    try {
      const rows = await sql<Array<{ value: number }>>`SELECT 1 AS value`;
      expect(Number(rows[0].value)).toBe(1);
    } finally {
      await sql.close();
    }
  },
);

const migrationDirectory = resolve(import.meta.dir, "../migrations");

async function dropAllTables(sql: Bun.SQL): Promise<void> {
  await sql`SET FOREIGN_KEY_CHECKS = 0`;
  for (const table of [...tables, "schema_migrations"]) {
    await sql.unsafe(`DROP TABLE IF EXISTS ${table}`).simple();
  }
  await sql`SET FOREIGN_KEY_CHECKS = 1`;
}

async function resetSchema(sql: Bun.SQL): Promise<void> {
  await dropAllTables(sql);
  await applyMigrations(sql, loadMigrations(migrationDirectory));
}

async function completedState() {
  const repository = new MemoryPositionRepository();
  const service = new PositionService(repository);
  await service.configurePolicy({
    schemaVersion: 2,
    candidateContextVersion: "context-1",
    dailyAnalysisLimit: 20,
    prioritySlots: 16,
    agingSlots: 4,
    staleAfterDays: 30,
    defaultCompanyTier: 3,
    dailyCompanyTierLimit: 5,
    companyTierStaleAfterDays: 90,
  });
  const queue = await service.saveCollection(
    { schemaVersion: 2, analysisContractVersion: 1, pool: pool("collection-memory") },
    "2026-09-17T01:00:00.000Z",
  );
  await service.saveAnalysisResults(
    queue.analysisRunId,
    {
      schemaVersion: 2,
      collectionRunId: queue.collectionRunId,
      results: queue.candidates.map((candidate) => analysisResult(candidate.positionId)),
    },
    "2026-09-17T02:00:00.000Z",
  );
  await service.createRecommendation(queue.analysisRunId, "2026-09-17T03:00:00.000Z");
  return repository.snapshot();
}

test.skipIf(!databaseUrl)(
  "빈 database에 한 transaction으로 기록해도 foreign key 순서를 지킨다",
  async () => {
    const sql = new Bun.SQL(databaseUrl!);
    try {
      await resetSchema(sql);
      const state = await completedState();
      const repository = new SqlPositionRepository(sql);
      await repository.ensureReady();
      await repository.transaction((draft) => {
        Object.assign(draft, state);
      });
      const analyses = await sql`
        SELECT analysis_id, created_by_analysis_run_id FROM position_analyses
      `;
      const items = await sql`
        SELECT result_status, analysis_id FROM position_analysis_run_items
      `;
      expect(analyses).toHaveLength(2);
      expect(
        analyses.every((row: Record<string, unknown>) => row.created_by_analysis_run_id),
      ).toBe(true);
      expect(items.map((row: Record<string, unknown>) => row.result_status)).toEqual([
        "created",
        "created",
      ]);
    } finally {
      await sql.close();
    }
  },
);

test.skipIf(!databaseUrl)(
  "실제 MySQL에서 실행 원장과 생성 출처를 저장하고 감사 조회로 답한다",
  async () => {
    const sql = new Bun.SQL(databaseUrl!);
    try {
      await resetSchema(sql);

      const service = new PositionService(new SqlPositionRepository(sql));
      await service.configurePolicy({
        schemaVersion: 2,
        candidateContextVersion: "context-1",
        dailyAnalysisLimit: 20,
        prioritySlots: 16,
        agingSlots: 4,
        staleAfterDays: 30,
        defaultCompanyTier: 3,
        dailyCompanyTierLimit: 5,
        companyTierStaleAfterDays: 90,
      });
      const queue = await service.saveCollection(
        { schemaVersion: 2, analysisContractVersion: 1, pool: pool("collection-1") },
        "2026-09-17T01:00:00.000Z",
      );
      expect(queue.candidates).toHaveLength(2);
      const [analyzed, failed] = queue.candidates;

      const partial = await service.saveAnalysisResults(
        queue.analysisRunId,
        {
          schemaVersion: 2,
          collectionRunId: queue.collectionRunId,
          results: [analysisResult(analyzed.positionId)],
          failures: [{ positionId: failed.positionId, failureCode: "model_unavailable" }],
        },
        "2026-09-17T02:00:00.000Z",
      );
      expect(partial).toMatchObject({ status: "partial", createdCount: 1, failedCount: 1 });

      const completed = await service.saveAnalysisResults(
        queue.analysisRunId,
        {
          schemaVersion: 2,
          collectionRunId: queue.collectionRunId,
          results: [analysisResult(failed.positionId)],
        },
        "2026-09-17T03:00:00.000Z",
      );
      expect(completed).toMatchObject({ status: "completed", createdCount: 2, failedCount: 0 });

      const recommendation = await service.createRecommendation(
        queue.analysisRunId,
        "2026-09-17T04:00:00.000Z",
      );
      expect(recommendation.ranking).toHaveLength(2);

      const analysisRunId = queue.analysisRunId;
      const recommendationRunId = recommendation.recommendationRunId;

      const selected = await sql`
        SELECT i.selection_order, p.company_name, p.title, i.analysis_status, i.selection_reason
        FROM position_analysis_run_items i
        JOIN positions p ON p.position_id = i.position_id
        WHERE i.analysis_run_id = ${analysisRunId}
        ORDER BY i.selection_order
      `;
      expect(selected).toHaveLength(2);

      const outcomes = await sql`
        SELECT p.title, i.result_status, i.failure_code, i.attempt_count, i.completed_at
        FROM position_analysis_run_items i
        JOIN positions p ON p.position_id = i.position_id
        WHERE i.analysis_run_id = ${analysisRunId}
        ORDER BY i.selection_order
      `;
      expect(outcomes.map((row: Record<string, unknown>) => row.result_status).sort()).toEqual([
        "created",
        "created",
      ]);

      const linked = await sql`
        SELECT i.position_id, i.result_status, i.analysis_id, a.analyzed_at, a.valid_until
        FROM position_analysis_run_items i
        LEFT JOIN position_analyses a ON a.analysis_id = i.analysis_id
        WHERE i.analysis_run_id = ${analysisRunId}
        ORDER BY i.selection_order
      `;
      expect(
        linked.every((row: Record<string, unknown>) => row.analysis_id && row.analyzed_at),
      ).toBe(true);

      const provenance = await sql`
        SELECT a.analysis_id, a.analyzed_at, a.created_by_analysis_run_id, r.collection_run_id
        FROM position_analyses a
        LEFT JOIN position_analysis_runs r ON r.analysis_run_id = a.created_by_analysis_run_id
        WHERE a.position_id = ${analyzed.positionId}
        ORDER BY a.analyzed_at
      `;
      expect(provenance).toHaveLength(1);
      expect(provenance[0].created_by_analysis_run_id).toBe(analysisRunId);

      const origins = await sql`
        SELECT ri.rank_number, p.title, ri.analysis_id,
               CASE WHEN a.created_by_analysis_run_id = rr.analysis_run_id
                    THEN 'created' ELSE 'reused' END AS origin
        FROM position_recommendation_items ri
        JOIN position_recommendation_runs rr
          ON rr.recommendation_run_id = ri.recommendation_run_id
        JOIN position_analyses a ON a.analysis_id = ri.analysis_id
        JOIN positions p ON p.position_id = ri.position_id
        WHERE ri.recommendation_run_id = ${recommendationRunId}
        ORDER BY ri.rank_number
      `;
      expect(origins.map((row: Record<string, unknown>) => row.origin)).toEqual([
        "created",
        "created",
      ]);

      const retried = await sql`
        SELECT p.title, i.result_status, i.failure_code, i.attempt_count, i.completed_at, r.status
        FROM position_analysis_run_items i
        JOIN position_analysis_runs r ON r.analysis_run_id = i.analysis_run_id
        JOIN positions p ON p.position_id = i.position_id
        WHERE i.analysis_run_id = ${analysisRunId} AND i.attempt_count > 1
        ORDER BY i.selection_order
      `;
      expect(retried).toHaveLength(1);
      expect(Number(retried[0].attempt_count)).toBe(2);

      const mismatched = await sql`
        SELECT i.analysis_run_id, i.position_id
        FROM position_analysis_run_items i
        JOIN position_analyses a ON a.analysis_id = i.analysis_id
        WHERE i.result_status = 'created'
          AND a.created_by_analysis_run_id <> i.analysis_run_id
      `;
      expect(mismatched).toHaveLength(0);
    } finally {
      await sql.close();
    }
  },
);

async function seedLegacyRows(sql: Bun.SQL): Promise<void> {
  await sql`INSERT INTO position_sources (source_key, enabled) VALUES ('wanted', TRUE)`;
  await sql`
    INSERT INTO position_collection_runs
      (run_id, idempotency_key, collected_at, status, active_count, personal_excluded_count)
    VALUES ('legacy-collection', 'collection:legacy', '2026-09-16 00:00:00.000', 'completed', 1, 0)
  `;
  await sql`
    INSERT INTO positions
      (position_id, source_key, identity_hash, normalized_url, company_key, company_name,
       title, lifecycle, first_seen_at, last_seen_at)
    VALUES (${legacy.positionId}, 'wanted', 'wanted:legacy', 'https://example.com/jobs/legacy',
            'legacy company', 'Legacy Company', 'Backend Engineer', 'active',
            '2026-09-16 00:00:00.000', '2026-09-16 00:00:00.000')
  `;
  await sql`
    INSERT INTO position_versions
      (position_version_id, position_id, content_hash, snapshot_json, observed_at)
    VALUES (${legacy.positionVersionId}, ${legacy.positionId}, ${legacy.contentHash},
            ${JSON.stringify({ id: "wanted:legacy" })}, '2026-09-16 00:00:00.000')
  `;
  await sql`
    INSERT INTO position_analysis_policy
      (singleton_id, candidate_context_version, daily_analysis_limit, priority_slots,
       aging_slots, stale_after_days, default_company_tier)
    VALUES (1, 'context-legacy', 20, 16, 4, 30, 3)
  `;
  await sql`
    INSERT INTO position_analysis_runs
      (analysis_run_id, collection_run_id, candidate_context_version, contract_version,
       status, analyzed_now_count)
    VALUES (${legacy.analysisRunId}, 'legacy-collection', 'context-legacy', 1, 'completed', 1)
  `;
  await sql`
    INSERT INTO position_analyses
      (analysis_id, position_id, position_version_id, candidate_context_version, contract_version,
       created_by_analysis_run_id, analyzed_at, valid_until, company_tier_at_analysis, decision,
       fit_score, role_fit, scope_upside, company_opportunity, constraints_score,
       reason, details_json, next_actions_json)
    VALUES (${legacy.analysisId}, ${legacy.positionId}, ${legacy.positionVersionId},
            'context-legacy', 1, ${legacy.analysisRunId}, '2026-09-16 01:00:00.000',
            '2026-10-16', 3, 'recommend', 80, 35, 20, 15, 10,
            'legacy reason', ${"[]"}, ${"[]"})
  `;
  await sql`
    INSERT INTO position_analysis_run_items
      (analysis_run_id, position_id, position_version_id, selection_order,
       analysis_status, selection_reason, company_tier, result_status, attempt_count)
    VALUES (${legacy.analysisRunId}, ${legacy.positionId}, ${legacy.positionVersionId}, 1,
            'new', 'priority', 3, 'pending', 0)
  `;
  await sql`
    INSERT INTO position_recommendation_runs
      (recommendation_run_id, analysis_run_id, collection_run_id, generated_at,
       analyzed_now_count, reused_count, pending_count, pending_candidates_json,
       personal_excluded_count)
    VALUES (${legacy.recommendationRunId}, ${legacy.analysisRunId}, 'legacy-collection',
            '2026-09-16 02:00:00.000', 1, 0, 0, ${"[]"}, 0)
  `;
  await sql`
    INSERT INTO position_recommendation_items
      (recommendation_run_id, position_id, analysis_id, rank_number, decision, company_tier)
    VALUES (${legacy.recommendationRunId}, ${legacy.positionId}, ${legacy.analysisId}, 1,
            'recommend', 3)
  `;
}

const legacy = {
  positionId: "a0000000-0000-4000-8000-000000000001",
  positionVersionId: "a1000000-0000-4000-8000-000000000001",
  contentHash: `sha256:${"a".repeat(64)}`,
  analysisRunId: "a2000000-0000-4000-8000-000000000001",
  analysisId: "a3000000-0000-4000-8000-000000000001",
  recommendationRunId: "a4000000-0000-4000-8000-000000000001",
} as const;

async function applyStatements(sql: Bun.SQL, statements: string[]): Promise<void> {
  await sql.begin(async (transaction) => {
    for (const statement of statements) {
      await transaction.unsafe(statement).simple();
    }
  });
}

async function scalar(sql: Bun.SQL, query: Promise<unknown>): Promise<Record<string, unknown>> {
  const rows = (await query) as Array<Record<string, unknown>>;
  return rows[0];
}

async function rejectionMessage(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("거절돼야 하는 문장이 성공했습니다.");
}

test.skipIf(!databaseUrl)(
  "002는 기존 행을 이관하고 같은 문장을 다시 적용해도 실패하지 않는다",
  async () => {
    const sql = new Bun.SQL(databaseUrl!);
    try {
      await dropAllTables(sql);
      const migrations = loadMigrations(migrationDirectory);
      expect(migrations.map((entry) => entry.version)).toEqual([
        "001_position_schema",
        "002_company_tier_assessments",
      ]);
      await applyMigrations(sql, [migrations[0]]);
      await seedLegacyRows(sql);

      const before = await sql`
        SELECT COUNT(*) AS value FROM position_analysis_run_items
      `;
      expect(Number(before[0].value)).toBe(1);
      const beforeRecommendation = await sql`
        SELECT COUNT(*) AS value FROM position_recommendation_items
      `;
      expect(Number(beforeRecommendation[0].value)).toBe(1);

      const applied = await applyMigrations(sql, migrations);
      expect(applied).toEqual(["002_company_tier_assessments"]);

      const createdTables = await sql`
        SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN ('company_tier_assessment_runs', 'company_tier_assessments',
                             'company_tier_assessment_run_items')
        ORDER BY TABLE_NAME
      `;
      expect(createdTables.map((row: Record<string, unknown>) => row.TABLE_NAME)).toEqual([
        "company_tier_assessment_run_items",
        "company_tier_assessment_runs",
        "company_tier_assessments",
      ]);

      const foreignKeys = await sql`
        SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'FOREIGN KEY'
          AND CONSTRAINT_NAME IN ('fk_company_tier_runs_collection',
                                  'fk_company_tier_assessments_created_run',
                                  'fk_company_tier_items_run',
                                  'fk_company_tier_items_assessment')
        ORDER BY CONSTRAINT_NAME
      `;
      expect(foreignKeys).toHaveLength(4);

      const checks = await sql`
        SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'CHECK'
          AND CONSTRAINT_NAME IN ('chk_position_policy_company_tier_limit',
                                  'chk_position_policy_company_tier_stale',
                                  'chk_position_analysis_item_tier_source',
                                  'chk_position_recommendation_item_tier_source')
        ORDER BY CONSTRAINT_NAME
      `;
      expect(checks).toHaveLength(4);

      const columns = await sql`
        SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND ((TABLE_NAME = 'position_analysis_policy'
                AND COLUMN_NAME IN ('daily_company_tier_limit', 'company_tier_stale_after_days'))
            OR (TABLE_NAME IN ('position_analysis_run_items', 'position_recommendation_items')
                AND COLUMN_NAME IN ('company_tier_source', 'company_tier_assessment_id')))
        ORDER BY TABLE_NAME, COLUMN_NAME
      `;
      expect(columns).toHaveLength(6);
      const notNullable = columns.filter(
        (row: Record<string, unknown>) => row.COLUMN_NAME !== "company_tier_assessment_id",
      );
      expect(
        notNullable.every((row: Record<string, unknown>) => row.IS_NULLABLE === "NO"),
      ).toBe(true);
      expect(
        notNullable.every((row: Record<string, unknown>) => row.COLUMN_DEFAULT === null),
      ).toBe(true);

      const migrated = await scalar(
        sql,
        sql`
          SELECT company_tier_source, company_tier_assessment_id
          FROM position_analysis_run_items
        `,
      );
      expect(migrated.company_tier_source).toBe("default");
      expect(migrated.company_tier_assessment_id).toBe(null);
      const migratedRecommendation = await scalar(
        sql,
        sql`
          SELECT company_tier_source, company_tier_assessment_id
          FROM position_recommendation_items
        `,
      );
      expect(migratedRecommendation.company_tier_source).toBe("default");
      const policy = await scalar(
        sql,
        sql`
          SELECT daily_company_tier_limit, company_tier_stale_after_days
          FROM position_analysis_policy WHERE singleton_id = 1
        `,
      );
      expect(Number(policy.daily_company_tier_limit)).toBe(5);
      expect(Number(policy.company_tier_stale_after_days)).toBe(90);

      const statements = splitMigrationStatements(migrations[1].sql);
      expect(statements).toHaveLength(51);
      await applyStatements(sql, statements);
      await applyStatements(sql, statements);

      const afterRerun = await scalar(
        sql,
        sql`SELECT company_tier_source FROM position_analysis_run_items`,
      );
      expect(afterRerun.company_tier_source).toBe("default");
      const afterRerunRecommendation = await scalar(
        sql,
        sql`SELECT company_tier_source FROM position_recommendation_items`,
      );
      expect(afterRerunRecommendation.company_tier_source).toBe("default");
      const afterRerunPolicy = await scalar(
        sql,
        sql`
          SELECT daily_company_tier_limit, company_tier_stale_after_days
          FROM position_analysis_policy WHERE singleton_id = 1
        `,
      );
      expect(Number(afterRerunPolicy.daily_company_tier_limit)).toBe(5);
      expect(Number(afterRerunPolicy.company_tier_stale_after_days)).toBe(90);

      expect(
        await rejectionMessage(
          () => sql`
            UPDATE position_analysis_run_items
            SET company_tier_source = 'model' WHERE analysis_run_id = ${legacy.analysisRunId}
          `,
        ),
      ).toContain("chk_position_analysis_item_tier_source");
      expect(
        await rejectionMessage(
          () => sql`
            UPDATE position_recommendation_items
            SET company_tier_source = 'model'
            WHERE recommendation_run_id = ${legacy.recommendationRunId}
          `,
        ),
      ).toContain("chk_position_recommendation_item_tier_source");
      expect(
        await rejectionMessage(
          () => sql`
            UPDATE position_analysis_policy SET daily_company_tier_limit = 0 WHERE singleton_id = 1
          `,
        ),
      ).toContain("chk_position_policy_company_tier_limit");
      expect(
        await rejectionMessage(
          () => sql`
            UPDATE position_analysis_policy
            SET company_tier_stale_after_days = 400 WHERE singleton_id = 1
          `,
        ),
      ).toContain("chk_position_policy_company_tier_stale");

      const untouched = await scalar(
        sql,
        sql`SELECT company_tier_source FROM position_analysis_run_items`,
      );
      expect(untouched.company_tier_source).toBe("default");
    } finally {
      await sql.close();
    }
  },
);
