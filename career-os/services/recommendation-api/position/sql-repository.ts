import type { SourceDiagnostic } from "../../../scripts/position-recommender/live-postings/contracts.ts";
import { withTransaction } from "../db/connection.ts";
import { ApiError } from "../http/errors.ts";
import { recommendationResponseSchema } from "./schema.ts";
import {
  MemoryPositionRepository,
  type PositionRepositoryState,
  type StoredAnalysis,
  type StoredAnalysisRun,
  type StoredCollection,
  type StoredCompanyTierAssessment,
  type StoredCompanyTierRun,
  type StoredPosition,
  type StoredTierProvenance,
} from "./memory-repository.ts";

type Row = Record<string, any>;

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return /Z$|[+-]\d\d:\d\d$/.test(text)
    ? new Date(text).toISOString()
    : new Date(`${text}Z`).toISOString();
}

function date(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function datetime(value: string): string;
function datetime(value: string | null): string | null;
function datetime(value: string | null): string | null {
  return value === null ? null : value.replace("T", " ").replace("Z", "");
}

function json<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function publicDiagnostics(
  diagnostics: Array<{ source: string; status: string; failedCount: number }>,
) {
  return diagnostics
    .filter((diagnostic) => diagnostic.status === "partial" || diagnostic.status === "failed")
    .sort((left, right) => left.source.localeCompare(right.source))
    .map((diagnostic) => ({
      source: diagnostic.source,
      status: diagnostic.status as "partial" | "failed",
      failedCount: diagnostic.failedCount,
      reason: "일부 공고를 확인하지 못해 후보가 누락됐을 수 있습니다.",
    }));
}

export class SqlPositionRepository extends MemoryPositionRepository {
  private loaded = false;
  private loading?: Promise<void>;
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(private readonly sql: Bun.SQL) {
    super();
  }

  override async ensureReady(): Promise<void> {
    if (this.loaded) return;
    this.loading ??= this.load();
    try {
      await this.loading;
      this.loaded = true;
    } catch {
      throw new ApiError(503, "DATABASE_UNAVAILABLE", "추천 상태 저장소를 사용할 수 없습니다.");
    } finally {
      this.loading = undefined;
    }
  }

  override async transaction<T>(
    callback: (state: PositionRepositoryState) => Promise<T> | T,
  ): Promise<T> {
    let release!: () => void;
    const previous = this.transactionTail;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      await this.ensureReady();
      const before = this.snapshot();
      try {
        const result = await super.transaction(callback);
        await this.persist(this.snapshot());
        return result;
      } catch (error) {
        this.state = before;
        if (error instanceof ApiError) throw error;
        throw new ApiError(503, "DATABASE_UNAVAILABLE", "추천 상태 저장소를 사용할 수 없습니다.");
      }
    } finally {
      release();
    }
  }

  private async load(): Promise<void> {
    const [
      policyRows,
      preferenceRows,
      positionRows,
      versionRows,
      analysisRows,
      collectionRows,
      diagnosticRows,
      collectionItemRows,
      analysisRunRows,
      analysisItemRows,
      recommendationRunRows,
      recommendationItemRows,
      companyTierRunRows,
      companyTierAssessmentRows,
      companyTierItemRows,
    ] = await Promise.all([
      this.sql<Row[]>`SELECT * FROM position_analysis_policy WHERE singleton_id = 1`,
      this.sql<Row[]>`SELECT * FROM company_preferences`,
      this.sql<Row[]>`SELECT * FROM positions`,
      this.sql<Row[]>`SELECT * FROM position_versions ORDER BY observed_at`,
      this.sql<Row[]>`SELECT * FROM position_analyses ORDER BY analyzed_at`,
      this.sql<Row[]>`SELECT * FROM position_collection_runs`,
      this.sql<Row[]>`SELECT * FROM position_source_run_diagnostics ORDER BY run_id, source_key`,
      this.sql<
        Row[]
      >`SELECT pci.run_id, p.source_key, p.identity_hash FROM position_collection_items pci JOIN positions p ON p.position_id = pci.position_id ORDER BY pci.run_id, pci.position_id`,
      this.sql<Row[]>`SELECT * FROM position_analysis_runs`,
      this.sql<Row[]>`SELECT * FROM position_analysis_run_items ORDER BY selection_order`,
      this.sql<Row[]>`SELECT * FROM position_recommendation_runs`,
      this.sql<Row[]>`SELECT * FROM position_recommendation_items ORDER BY rank_number`,
      this.sql<Row[]>`SELECT * FROM company_tier_assessment_runs`,
      this.sql<Row[]>`SELECT * FROM company_tier_assessments ORDER BY assessed_at`,
      this.sql<Row[]>`SELECT * FROM company_tier_assessment_run_items ORDER BY selection_order`,
    ]);

    const positions = new Map<string, StoredPosition>();
    const byPositionId = new Map<string, StoredPosition>();
    const versionsById = new Map<
      string,
      { contentHash: string; posting: StoredPosition["posting"] }
    >();
    for (const row of positionRows) {
      const identity = `${row.source_key}:${row.identity_hash}`;
      const position: StoredPosition = {
        positionId: row.position_id,
        candidateId: "",
        source: row.source_key,
        identity,
        contentHash: "",
        posting: undefined as never,
        versions: [],
        firstSeenAt: iso(row.first_seen_at),
        lastSeenAt: iso(row.last_seen_at),
        pendingSince: row.pending_since ? iso(row.pending_since) : null,
        lifecycle: row.lifecycle,
        analyses: [],
      };
      positions.set(identity, position);
      byPositionId.set(position.positionId, position);
    }
    for (const row of versionRows) {
      const position = byPositionId.get(row.position_id);
      if (!position) continue;
      const posting = json<StoredPosition["posting"]>(row.snapshot_json);
      position.versions.push({
        positionVersionId: row.position_version_id,
        contentHash: row.content_hash,
        posting,
        observedAt: iso(row.observed_at),
      });
      versionsById.set(row.position_version_id, { contentHash: row.content_hash, posting });
      position.contentHash = row.content_hash;
      position.posting = posting;
      position.candidateId = posting.id;
    }
    const analysesById = new Map<string, StoredAnalysis>();
    for (const row of analysisRows) {
      const position = byPositionId.get(row.position_id);
      if (!position) continue;
      const stored: StoredAnalysis = {
        analysisId: row.analysis_id,
        positionId: row.position_id,
        decision: row.decision,
        fitScore: Number(row.fit_score),
        scoreBreakdown: {
          roleFit: Number(row.role_fit),
          scopeUpside: Number(row.scope_upside),
          companyOpportunity: Number(row.company_opportunity),
          constraints: Number(row.constraints_score),
        },
        reason: row.reason,
        details: json(row.details_json),
        nextActions: json(row.next_actions_json),
        contentHash: versionsById.get(row.position_version_id)?.contentHash ?? "",
        candidateContextVersion: row.candidate_context_version,
        analysisContractVersion: Number(row.contract_version),
        createdByAnalysisRunId: row.created_by_analysis_run_id ?? null,
        analyzedAt: iso(row.analyzed_at),
        validUntil: date(row.valid_until),
        companyTierAtAnalysis: Number(row.company_tier_at_analysis),
      };
      position.analyses.push(stored);
      analysesById.set(stored.analysisId, stored);
    }

    const diagnosticsByRun = new Map<string, SourceDiagnostic[]>();
    for (const row of diagnosticRows) {
      const values = diagnosticsByRun.get(row.run_id) ?? [];
      values.push({
        source: row.source_key,
        status: row.status,
        collectedCount: Number(row.collected_count),
        importedCount: Number(row.imported_count),
        skippedCount: Number(row.skipped_count),
        failedCount: Number(row.failed_count),
        discoveryModes: [],
        message: row.public_message,
      });
      diagnosticsByRun.set(row.run_id, values);
    }
    const collectionIds = new Map<string, string[]>();
    for (const row of collectionItemRows) {
      const values = collectionIds.get(row.run_id) ?? [];
      values.push(`${row.source_key}:${row.identity_hash}`);
      collectionIds.set(row.run_id, values);
    }
    const collections = new Map<string, StoredCollection>();
    for (const row of collectionRows) {
      collections.set(row.run_id, {
        collectionRunId: row.run_id,
        collectedAt: iso(row.collected_at),
        candidateIds: collectionIds.get(row.run_id) ?? [],
        diagnostics: diagnosticsByRun.get(row.run_id) ?? [],
        personalExcludedCount: Number(row.personal_excluded_count),
      });
    }
    const itemsByRun = new Map<string, Row[]>();
    for (const row of analysisItemRows) {
      const values = itemsByRun.get(row.analysis_run_id) ?? [];
      values.push(row);
      itemsByRun.set(row.analysis_run_id, values);
    }
    const analysisRuns = new Map<string, StoredAnalysisRun>();
    for (const row of analysisRunRows) {
      const items = itemsByRun.get(row.analysis_run_id) ?? [];
      analysisRuns.set(row.analysis_run_id, {
        analysisRunId: row.analysis_run_id,
        collectionRunId: row.collection_run_id,
        candidateContextVersion: row.candidate_context_version,
        analysisContractVersion: Number(row.contract_version),
        createdAt: iso(row.created_at),
        completedAt: row.completed_at ? iso(row.completed_at) : null,
        status: row.status,
        items: new Map(
          items.map((item) => [
            item.position_id,
            {
              positionId: item.position_id,
              positionVersionId: item.position_version_id,
              selectionOrder: Number(item.selection_order),
              analysisStatus: item.analysis_status,
              selectionReason: item.selection_reason,
              companyTier: Number(item.company_tier),
              companyTierSource: item.company_tier_source,
              companyTierAssessmentId: item.company_tier_assessment_id ?? null,
              resultStatus: item.result_status,
              analysisId: item.analysis_id ?? null,
              failureCode: item.failure_code ?? null,
              attemptCount: Number(item.attempt_count),
              completedAt: item.completed_at ? iso(item.completed_at) : null,
            },
          ]),
        ),
        analyzedNowCount: Number(row.analyzed_now_count),
      });
    }
    const companyTierItemsByRun = new Map<string, Row[]>();
    for (const row of companyTierItemRows) {
      const values = companyTierItemsByRun.get(row.company_tier_run_id) ?? [];
      values.push(row);
      companyTierItemsByRun.set(row.company_tier_run_id, values);
    }
    const companyTierRuns = new Map<string, StoredCompanyTierRun>();
    for (const row of companyTierRunRows) {
      const items = companyTierItemsByRun.get(row.company_tier_run_id) ?? [];
      companyTierRuns.set(row.company_tier_run_id, {
        companyTierRunId: row.company_tier_run_id,
        collectionRunId: row.collection_run_id,
        candidateContextVersion: row.candidate_context_version,
        contractVersion: Number(row.contract_version),
        status: row.status,
        assessedNowCount: Number(row.assessed_now_count),
        createdAt: iso(row.created_at),
        completedAt: row.completed_at ? iso(row.completed_at) : null,
        items: new Map(
          items.map((item) => [
            item.company_key,
            {
              companyKey: item.company_key,
              companyName: item.company_name,
              selectionOrder: Number(item.selection_order),
              assessmentStatus: item.assessment_status,
              selectionReason: item.selection_reason,
              priorTier: item.prior_tier === null ? null : Number(item.prior_tier),
              activePositionCount: Number(item.active_position_count),
              resultStatus: item.result_status,
              companyTierAssessmentId: item.company_tier_assessment_id ?? null,
              failureCode: item.failure_code ?? null,
              attemptCount: Number(item.attempt_count),
              completedAt: item.completed_at ? iso(item.completed_at) : null,
            },
          ]),
        ),
      });
    }
    const companyTierAssessments = new Map<string, StoredCompanyTierAssessment>(
      companyTierAssessmentRows.map((row) => [
        row.company_tier_assessment_id,
        {
          companyTierAssessmentId: row.company_tier_assessment_id,
          companyKey: row.company_key,
          companyName: row.company_name,
          candidateContextVersion: row.candidate_context_version,
          contractVersion: Number(row.contract_version),
          createdByCompanyTierRunId: row.created_by_company_tier_run_id ?? null,
          recommendedTier: Number(row.recommended_tier),
          confidence: row.confidence,
          reason: row.reason,
          signals: json(row.signals_json),
          evidence: json(row.evidence_json),
          assumptions: json(row.assumptions_json),
          assessedAt: iso(row.assessed_at),
          validUntil: date(row.valid_until),
        },
      ]),
    );
    const policy = policyRows[0]
      ? {
          schemaVersion: 2 as const,
          candidateContextVersion: policyRows[0].candidate_context_version,
          dailyAnalysisLimit: Number(policyRows[0].daily_analysis_limit),
          prioritySlots: Number(policyRows[0].priority_slots),
          agingSlots: Number(policyRows[0].aging_slots),
          staleAfterDays: Number(policyRows[0].stale_after_days),
          defaultCompanyTier: Number(policyRows[0].default_company_tier),
          dailyCompanyTierLimit: Number(policyRows[0].daily_company_tier_limit),
          companyTierStaleAfterDays: Number(policyRows[0].company_tier_stale_after_days),
        }
      : undefined;
    const state: PositionRepositoryState = {
      policy,
      preferences: new Map(
        preferenceRows.map((row) => [
          row.company_key,
          {
            companyKey: row.company_key,
            companyName: row.company_name,
            tier: Number(row.tier),
            disposition: row.disposition,
            updatedAt: iso(row.updated_at),
          },
        ]),
      ),
      positions,
      collections,
      analysisRuns,
      companyTierRuns,
      companyTierAssessments,
      recommendationResponses: new Map(),
      recommendationAnalysisIds: new Map(),
      recommendationTierSources: new Map(),
    };
    const recommendationItemsByRun = new Map<string, Row[]>();
    for (const row of recommendationItemRows) {
      const values = recommendationItemsByRun.get(row.recommendation_run_id) ?? [];
      values.push(row);
      recommendationItemsByRun.set(row.recommendation_run_id, values);
    }
    for (const row of recommendationRunRows) {
      const run = analysisRuns.get(row.analysis_run_id);
      const collection = collections.get(row.collection_run_id);
      if (!run || !collection) continue;
      const generatedAt = iso(row.generated_at);
      const items = recommendationItemsByRun.get(row.recommendation_run_id) ?? [];
      const ranking = items.map((item) => {
        const position = byPositionId.get(item.position_id)!;
        const analysis = analysesById.get(item.analysis_id)!;
        const version = position.versions.find(
          (entry) => entry.contentHash === analysis.contentHash,
        )!;
        return {
          candidateId: version.posting.id,
          company: version.posting.company,
          title: version.posting.title,
          postingUrl: version.posting.url,
          companyTier: Number(item.company_tier),
          decision: item.decision,
          fitScore: analysis.fitScore,
          reason: analysis.reason,
          details: analysis.details,
          nextActions: analysis.nextActions,
        };
      });
      const pendingCandidates = json(row.pending_candidates_json);
      const response = recommendationResponseSchema.parse({
        schemaVersion: 1,
        recommendationRunId: row.recommendation_run_id,
        analysisRunId: row.analysis_run_id,
        reportDate: generatedAt.slice(0, 10),
        generatedAt,
        sourceSnapshot: { collectionRunId: row.collection_run_id },
        ranking,
        recommendations: ranking.filter((entry) => entry.decision !== "hold"),
        pendingCandidates,
        analysisSummary: {
          activeCount: collection.candidateIds.length,
          analyzedNowCount: Number(row.analyzed_now_count),
          reusedCount: Number(row.reused_count),
          pendingCount: Number(row.pending_count),
          personalExcludedCount: Number(row.personal_excluded_count),
        },
        collectionHealth: {
          candidateCount: collection.candidateIds.length,
          configuredSourceCount: collection.diagnostics.length,
          warningSources: publicDiagnostics(collection.diagnostics),
        },
      });
      state.recommendationResponses.set(row.analysis_run_id, response);
      state.recommendationAnalysisIds.set(
        row.analysis_run_id,
        new Map(
          items.map((item) => {
            const position = byPositionId.get(item.position_id)!;
            const analysis = analysesById.get(item.analysis_id)!;
            const version = position.versions.find(
              (entry) => entry.contentHash === analysis.contentHash,
            )!;
            return [version.posting.id, item.analysis_id];
          }),
        ),
      );
      state.recommendationTierSources.set(
        row.analysis_run_id,
        new Map(
          items.map((item) => {
            const position = byPositionId.get(item.position_id)!;
            const analysis = analysesById.get(item.analysis_id)!;
            const version = position.versions.find(
              (entry) => entry.contentHash === analysis.contentHash,
            )!;
            return [
              version.posting.id,
              {
                source: item.company_tier_source,
                assessmentId: item.company_tier_assessment_id ?? null,
              } satisfies StoredTierProvenance,
            ];
          }),
        ),
      );
    }
    this.state = state;
  }

  private async persist(state: PositionRepositoryState): Promise<void> {
    await withTransaction(this.sql, async (sql) => {
      if (state.policy) {
        const policy = state.policy;
        await sql`
          INSERT INTO position_analysis_policy
            (singleton_id, candidate_context_version, daily_analysis_limit, priority_slots,
             aging_slots, stale_after_days, default_company_tier, daily_company_tier_limit,
             company_tier_stale_after_days, updated_at)
          VALUES (1, ${policy.candidateContextVersion}, ${policy.dailyAnalysisLimit},
                  ${policy.prioritySlots}, ${policy.agingSlots}, ${policy.staleAfterDays},
                  ${policy.defaultCompanyTier}, ${policy.dailyCompanyTierLimit},
                  ${policy.companyTierStaleAfterDays}, CURRENT_TIMESTAMP(3))
          ON DUPLICATE KEY UPDATE
            candidate_context_version = VALUES(candidate_context_version),
            daily_analysis_limit = VALUES(daily_analysis_limit),
            priority_slots = VALUES(priority_slots), aging_slots = VALUES(aging_slots),
            stale_after_days = VALUES(stale_after_days),
            default_company_tier = VALUES(default_company_tier),
            daily_company_tier_limit = VALUES(daily_company_tier_limit),
            company_tier_stale_after_days = VALUES(company_tier_stale_after_days),
            updated_at = VALUES(updated_at)
        `;
      }
      for (const preference of state.preferences.values()) {
        await sql`
          INSERT INTO company_preferences
            (company_key, company_name, tier, disposition, updated_at)
          VALUES (${preference.companyKey}, ${preference.companyName}, ${preference.tier},
                  ${preference.disposition}, ${datetime(preference.updatedAt)})
          ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), tier = VALUES(tier),
            disposition = VALUES(disposition), updated_at = VALUES(updated_at)
        `;
      }
      for (const position of state.positions.values()) {
        await sql`
          INSERT INTO position_sources (source_key, enabled)
          VALUES (${position.source}, TRUE)
          ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
        `;
        await sql`
          INSERT INTO positions
            (position_id, source_key, identity_hash, normalized_url, company_key, company_name,
             title, lifecycle, first_seen_at, last_seen_at, pending_since)
          VALUES (${position.positionId}, ${position.source}, ${position.identity.slice(position.source.length + 1)},
                  ${position.posting.url}, ${position.posting.company.toLocaleLowerCase("ko-KR")},
                  ${position.posting.company}, ${position.posting.title}, ${position.lifecycle},
                  ${datetime(position.firstSeenAt)}, ${datetime(position.lastSeenAt)},
                  ${datetime(position.pendingSince)})
          ON DUPLICATE KEY UPDATE normalized_url = VALUES(normalized_url),
            company_key = VALUES(company_key), company_name = VALUES(company_name),
            title = VALUES(title), lifecycle = VALUES(lifecycle), last_seen_at = VALUES(last_seen_at),
            pending_since = VALUES(pending_since)
        `;
        for (const version of position.versions) {
          await sql`
            INSERT IGNORE INTO position_versions
              (position_version_id, position_id, content_hash, snapshot_json, observed_at)
            VALUES (${version.positionVersionId}, ${position.positionId}, ${version.contentHash},
                    ${JSON.stringify(version.posting)}, ${datetime(version.observedAt)})
          `;
        }
      }
      for (const collection of state.collections.values()) {
        await sql`
          INSERT INTO position_collection_runs
            (run_id, idempotency_key, collected_at, status, active_count, personal_excluded_count)
          VALUES (${collection.collectionRunId}, ${`collection:${collection.collectionRunId}`},
                  ${datetime(collection.collectedAt)}, 'completed', ${collection.candidateIds.length},
                  ${collection.personalExcludedCount})
          ON DUPLICATE KEY UPDATE status = VALUES(status), active_count = VALUES(active_count),
            personal_excluded_count = VALUES(personal_excluded_count)
        `;
        for (const diagnostic of collection.diagnostics) {
          await sql`
            INSERT INTO position_sources (source_key, enabled)
            VALUES (${diagnostic.source}, TRUE) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
          `;
          await sql`
            INSERT INTO position_source_run_diagnostics
              (run_id, source_key, status, collected_count, imported_count, skipped_count,
               failed_count, public_message)
            VALUES (${collection.collectionRunId}, ${diagnostic.source}, ${diagnostic.status},
                    ${diagnostic.collectedCount}, ${diagnostic.importedCount}, ${diagnostic.skippedCount},
                    ${diagnostic.failedCount},
                    ${diagnostic.status === "ok" ? "" : "일부 공고를 확인하지 못했습니다."})
            ON DUPLICATE KEY UPDATE status = VALUES(status), collected_count = VALUES(collected_count),
              imported_count = VALUES(imported_count), skipped_count = VALUES(skipped_count),
              failed_count = VALUES(failed_count), public_message = VALUES(public_message)
          `;
        }
        for (const identity of collection.candidateIds) {
          const position = state.positions.get(identity)!;
          const version = position.versions.find(
            (entry) => entry.contentHash === position.contentHash,
          )!;
          await sql`
            INSERT IGNORE INTO position_collection_items
              (run_id, position_id, position_version_id, posting_status, close_urgency)
            VALUES (${collection.collectionRunId}, ${position.positionId}, ${version.positionVersionId},
                    ${position.posting.postingStatus}, ${position.posting.closeUrgency})
          `;
        }
      }
      for (const run of state.companyTierRuns.values()) {
        await sql`
          INSERT INTO company_tier_assessment_runs
            (company_tier_run_id, collection_run_id, candidate_context_version, contract_version,
             status, assessed_now_count, created_at, completed_at)
          VALUES (${run.companyTierRunId}, ${run.collectionRunId}, ${run.candidateContextVersion},
                  ${run.contractVersion}, ${run.status}, ${run.assessedNowCount},
                  ${datetime(run.createdAt)}, ${datetime(run.completedAt)})
          ON DUPLICATE KEY UPDATE status = VALUES(status),
            assessed_now_count = VALUES(assessed_now_count), completed_at = VALUES(completed_at)
        `;
      }
      for (const assessment of state.companyTierAssessments.values()) {
        await sql`
          INSERT IGNORE INTO company_tier_assessments
            (company_tier_assessment_id, company_key, company_name, candidate_context_version,
             contract_version, created_by_company_tier_run_id, recommended_tier, confidence,
             reason, signals_json, evidence_json, assumptions_json, assessed_at, valid_until)
          VALUES (${assessment.companyTierAssessmentId}, ${assessment.companyKey},
                  ${assessment.companyName}, ${assessment.candidateContextVersion},
                  ${assessment.contractVersion}, ${assessment.createdByCompanyTierRunId},
                  ${assessment.recommendedTier}, ${assessment.confidence}, ${assessment.reason},
                  ${JSON.stringify(assessment.signals)}, ${JSON.stringify(assessment.evidence)},
                  ${JSON.stringify(assessment.assumptions)}, ${datetime(assessment.assessedAt)},
                  ${assessment.validUntil})
        `;
      }
      for (const run of state.companyTierRuns.values()) {
        for (const item of [...run.items.values()].sort(
          (left, right) => left.selectionOrder - right.selectionOrder,
        )) {
          await sql`
            INSERT INTO company_tier_assessment_run_items
              (company_tier_run_id, company_key, company_name, selection_order, assessment_status,
               selection_reason, prior_tier, active_position_count, result_status,
               company_tier_assessment_id, failure_code, attempt_count, completed_at)
            VALUES (${run.companyTierRunId}, ${item.companyKey}, ${item.companyName},
                    ${item.selectionOrder}, ${item.assessmentStatus}, ${item.selectionReason},
                    ${item.priorTier}, ${item.activePositionCount}, ${item.resultStatus},
                    ${item.companyTierAssessmentId}, ${item.failureCode}, ${item.attemptCount},
                    ${datetime(item.completedAt)})
            ON DUPLICATE KEY UPDATE result_status = VALUES(result_status),
              company_tier_assessment_id = VALUES(company_tier_assessment_id),
              failure_code = VALUES(failure_code), attempt_count = VALUES(attempt_count),
              completed_at = VALUES(completed_at)
          `;
        }
      }
      for (const run of state.analysisRuns.values()) {
        await sql`
          INSERT INTO position_analysis_runs
            (analysis_run_id, collection_run_id, candidate_context_version, contract_version,
             status, analyzed_now_count, created_at, completed_at)
          VALUES (${run.analysisRunId}, ${run.collectionRunId}, ${run.candidateContextVersion},
                  ${run.analysisContractVersion}, ${run.status},
                  ${run.analyzedNowCount}, ${datetime(run.createdAt)}, ${datetime(run.completedAt)})
          ON DUPLICATE KEY UPDATE status = VALUES(status),
            analyzed_now_count = VALUES(analyzed_now_count), completed_at = VALUES(completed_at)
        `;
      }
      for (const position of state.positions.values()) {
        for (const analysis of position.analyses) {
          const version = position.versions.find(
            (entry) => entry.contentHash === analysis.contentHash,
          )!;
          await sql`
            INSERT IGNORE INTO position_analyses
              (analysis_id, position_id, position_version_id, candidate_context_version,
               contract_version, created_by_analysis_run_id, analyzed_at, valid_until,
               company_tier_at_analysis, decision,
               fit_score, role_fit, scope_upside, company_opportunity, constraints_score,
               reason, details_json, next_actions_json)
            VALUES (${analysis.analysisId}, ${position.positionId}, ${version.positionVersionId},
                    ${analysis.candidateContextVersion}, ${analysis.analysisContractVersion},
                    ${analysis.createdByAnalysisRunId},
                    ${datetime(analysis.analyzedAt)}, ${analysis.validUntil}, ${analysis.companyTierAtAnalysis},
                    ${analysis.decision}, ${analysis.fitScore}, ${analysis.scoreBreakdown.roleFit},
                    ${analysis.scoreBreakdown.scopeUpside}, ${analysis.scoreBreakdown.companyOpportunity},
                    ${analysis.scoreBreakdown.constraints}, ${analysis.reason},
                    ${JSON.stringify(analysis.details)}, ${JSON.stringify(analysis.nextActions)})
          `;
        }
      }
      for (const run of state.analysisRuns.values()) {
        for (const item of [...run.items.values()].sort(
          (left, right) => left.selectionOrder - right.selectionOrder,
        )) {
          await sql`
            INSERT INTO position_analysis_run_items
              (analysis_run_id, position_id, position_version_id, selection_order,
               analysis_status, selection_reason, company_tier, company_tier_source,
               company_tier_assessment_id,
               result_status, analysis_id, failure_code, attempt_count, completed_at)
            VALUES (${run.analysisRunId}, ${item.positionId}, ${item.positionVersionId},
                    ${item.selectionOrder}, ${item.analysisStatus}, ${item.selectionReason},
                    ${item.companyTier}, ${item.companyTierSource},
                    ${item.companyTierAssessmentId}, ${item.resultStatus}, ${item.analysisId},
                    ${item.failureCode}, ${item.attemptCount}, ${datetime(item.completedAt)})
            ON DUPLICATE KEY UPDATE result_status = VALUES(result_status),
              company_tier_source = VALUES(company_tier_source),
              company_tier_assessment_id = VALUES(company_tier_assessment_id),
              analysis_id = VALUES(analysis_id), failure_code = VALUES(failure_code),
              attempt_count = VALUES(attempt_count), completed_at = VALUES(completed_at)
          `;
        }
      }
      for (const raw of state.recommendationResponses.values()) {
        const response = recommendationResponseSchema.parse(raw);
        const analysisIds = state.recommendationAnalysisIds.get(response.analysisRunId)!;
        const tierSources = state.recommendationTierSources.get(response.analysisRunId);
        await sql`
          INSERT IGNORE INTO position_recommendation_runs
            (recommendation_run_id, analysis_run_id, collection_run_id, generated_at,
             analyzed_now_count, reused_count, pending_count, pending_candidates_json,
             personal_excluded_count)
          VALUES (${response.recommendationRunId}, ${response.analysisRunId},
                  ${response.sourceSnapshot.collectionRunId}, ${datetime(response.generatedAt)},
                  ${response.analysisSummary.analyzedNowCount}, ${response.analysisSummary.reusedCount},
                  ${response.analysisSummary.pendingCount},
                  ${JSON.stringify(response.pendingCandidates)},
                  ${response.analysisSummary.personalExcludedCount})
        `;
        for (const [index, item] of response.ranking.entries()) {
          const position = [...state.positions.values()].find(
            (entry) => entry.candidateId === item.candidateId,
          )!;
          const analysisId = analysisIds.get(item.candidateId)!;
          const tierSource = tierSources?.get(item.candidateId) ?? {
            source: "default" as const,
            assessmentId: null,
          };
          await sql`
            INSERT IGNORE INTO position_recommendation_items
              (recommendation_run_id, position_id, analysis_id, rank_number, decision,
               company_tier, company_tier_source, company_tier_assessment_id)
            VALUES (${response.recommendationRunId}, ${position.positionId}, ${analysisId},
                    ${index + 1}, ${item.decision}, ${item.companyTier},
                    ${tierSource.source}, ${tierSource.assessmentId})
          `;
        }
      }
    });
  }
}
