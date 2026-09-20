import { expect, test } from "bun:test";
import { resolve } from "node:path";
import type { PostingCandidatePool } from "../../../scripts/position-recommender/live-postings/contracts.ts";
import { MemoryPositionRepository } from "../position/memory-repository.ts";
import { PositionService } from "../position/service.ts";
import { SqlPositionRepository } from "../position/sql-repository.ts";
import { applyMigrations, loadMigrations } from "./migrations.ts";

const databaseUrl = process.env.CAREER_RECOMMENDATION_TEST_DATABASE_URL;

if (!databaseUrl) {
  console.info(
    "CAREER_RECOMMENDATION_TEST_DATABASE_URL이 없어 MySQL 통합 검사를 건너뜁니다. 기록 순서와 감사 조회는 확인하지 않았습니다.",
  );
}

const tables = [
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

async function resetSchema(sql: Bun.SQL): Promise<void> {
  await sql`SET FOREIGN_KEY_CHECKS = 0`;
  for (const table of [...tables, "schema_migrations"]) {
    await sql.unsafe(`DROP TABLE IF EXISTS ${table}`).simple();
  }
  await sql`SET FOREIGN_KEY_CHECKS = 1`;
  await applyMigrations(sql, loadMigrations(resolve(import.meta.dir, "../migrations")));
}

async function completedState() {
  const repository = new MemoryPositionRepository();
  const service = new PositionService(repository);
  await service.configurePolicy({
    schemaVersion: 1,
    candidateContextVersion: "context-1",
    dailyAnalysisLimit: 20,
    prioritySlots: 16,
    agingSlots: 4,
    staleAfterDays: 30,
    defaultCompanyTier: 3,
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
        schemaVersion: 1,
        candidateContextVersion: "context-1",
        dailyAnalysisLimit: 20,
        prioritySlots: 16,
        agingSlots: 4,
        staleAfterDays: 30,
        defaultCompanyTier: 3,
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
