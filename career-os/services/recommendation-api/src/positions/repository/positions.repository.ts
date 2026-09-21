import { Injectable } from "@nestjs/common";

import type { PostingCandidate, SourceDiagnostic } from "../../contracts/posting-candidate.js";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { companyKey, positionContentHash, positionIdentity } from "../hash.js";
import type { AnalysisPolicy, CompanyPreference } from "../schema.js";
import type { CompanyTierFailureCode, StoredCompanyTierAssessment } from "../stored.js";

/** transaction 안팎에서 같은 질의를 쓸 수 있게 두 client 를 함께 받는다. */
export type DbClient = PrismaService | Prisma.TransactionClient;

export type CollectionRunRow = {
  collectionRunId: string;
  collectedAt: string;
  personalExcludedCount: number;
};

export type CollectionPositionRow = {
  positionId: string;
  positionVersionId: string;
  companyKey: string;
  companyName: string;
  postingUrl: string;
  contentHash: string;
};

export type PositionAnalysisRow = {
  positionId: string;
  contentHash: string;
  candidateContextVersion: string;
  contractVersion: number;
  validUntil: string;
  analyzedAt: string;
};

export type CompanyTierRunRow = {
  companyTierRunId: string;
  collectionRunId: string;
  candidateContextVersion: string;
  contractVersion: number;
  status: "pending" | "partial" | "completed";
  assessedNowCount: number;
  createdAt: string;
};

export type CompanyTierRunItemRow = {
  companyKey: string;
  companyName: string;
  selectionOrder: number;
  assessmentStatus: "new" | "stale";
  selectionReason: "discovery" | "refresh";
  priorTier: number | null;
  activePositionCount: number;
  resultStatus: "pending" | "created" | "reused" | "failed";
  companyTierAssessmentId: string | null;
  failureCode: CompanyTierFailureCode | null;
  attemptCount: number;
};

export type QueuedCompanyRow = {
  companyKey: string;
  companyName: string;
  activePositionCount: number;
  assessmentStatus: "new" | "stale";
  priorTier: number | null;
  priorReason: string | null;
  priorValidUntil: string | null;
};

export type CompanyTierRunItemUpdate = {
  companyTierRunId: string;
  companyKey: string;
  resultStatus: "created" | "reused" | "failed";
  companyTierAssessmentId: string | null;
  failureCode: CompanyTierFailureCode | null;
  completedAt: string;
};

export type AnalysisRunSummaryRow = {
  analysisRunId: string;
  contractVersion: number;
  resultStatuses: Array<"pending" | "created" | "reused" | "failed">;
};

type RawRow = Record<string, unknown>;

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return /Z$|[+-]\d\d:\d\d$/.test(text)
    ? new Date(text).toISOString()
    : new Date(`${text}Z`).toISOString();
}

function dateOnly(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function at(value: string): Date {
  return new Date(value);
}

function number(value: unknown): number {
  return typeof value === "bigint" ? Number(value) : Number(value);
}

function jsonValue<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

/** 공고 하나가 이번 수집에서 차지한 자리. `saveCollection` 이 만들어 응답 조립에 넘긴다. */
export type UpsertedPosition = {
  positionId: string;
  positionVersionId: string;
  contentHash: string;
  posting: PostingCandidate;
};

/**
 * 추천 상태를 질의 단위로 읽고 쓴다.
 *
 * 전체 상태를 메모리에 올리지 않는다. 메서드는 도메인이 실제로 요구하는 단위로만 둔다.
 * 쓰기 경로는 자기 실행 행을 먼저 잠근 뒤에 값을 바꾼다.
 */
@Injectable()
export class PositionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 쓰기 transaction 을 연다.
   *
   * 격리 수준을 `READ COMMITTED` 로 내린다.
   * MySQL 기본값인 `REPEATABLE READ` 에서는 transaction 의 첫 읽기가 snapshot 을 세우므로,
   * 행 잠금을 잡고 나서 읽어도 잠금을 기다리는 동안 남이 commit 한 값이 보이지 않는다.
   * 그러면 잠금이 순서만 세우고 덮어쓰기는 막지 못한다.
   */
  async transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback, {
      timeout: 30_000,
      isolationLevel: "ReadCommitted",
    });
  }

  // ---------------------------------------------------------------- 분석 정책

  async findPolicy(client: DbClient = this.prisma): Promise<AnalysisPolicy | undefined> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT candidate_context_version, daily_analysis_limit, priority_slots, aging_slots,
             stale_after_days, default_company_tier, daily_company_tier_limit,
             company_tier_stale_after_days
      FROM position_analysis_policy WHERE singleton_id = 1
    `;
    const row = rows[0];
    if (!row) return undefined;
    return {
      schemaVersion: 2,
      candidateContextVersion: String(row.candidate_context_version),
      dailyAnalysisLimit: number(row.daily_analysis_limit),
      prioritySlots: number(row.priority_slots),
      agingSlots: number(row.aging_slots),
      staleAfterDays: number(row.stale_after_days),
      defaultCompanyTier: number(row.default_company_tier),
      dailyCompanyTierLimit: number(row.daily_company_tier_limit),
      companyTierStaleAfterDays: number(row.company_tier_stale_after_days),
    };
  }

  /** 정책 행을 잠근다. 행이 없으면 잠글 것이 없고 `upsertPolicy` 의 unique key 가 순서를 세운다. */
  async lockPolicy(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT singleton_id FROM position_analysis_policy WHERE singleton_id = 1 FOR UPDATE`;
  }

  async upsertPolicy(
    policy: AnalysisPolicy,
    now: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO position_analysis_policy
        (singleton_id, candidate_context_version, daily_analysis_limit, priority_slots,
         aging_slots, stale_after_days, default_company_tier, daily_company_tier_limit,
         company_tier_stale_after_days, updated_at)
      VALUES (1, ${policy.candidateContextVersion}, ${policy.dailyAnalysisLimit},
              ${policy.prioritySlots}, ${policy.agingSlots}, ${policy.staleAfterDays},
              ${policy.defaultCompanyTier}, ${policy.dailyCompanyTierLimit},
              ${policy.companyTierStaleAfterDays}, ${at(now)})
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

  // ---------------------------------------------------------------- 회사 선호

  async listPreferences(client: DbClient = this.prisma): Promise<CompanyPreference[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT company_key, company_name, tier, disposition, updated_at FROM company_preferences
    `;
    return rows.map((row) => ({
      companyKey: String(row.company_key),
      companyName: String(row.company_name),
      tier: number(row.tier),
      disposition: row.disposition as "analyze" | "exclude",
      updatedAt: iso(row.updated_at),
    }));
  }

  async upsertPreference(
    preference: CompanyPreference,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO company_preferences (company_key, company_name, tier, disposition, updated_at)
      VALUES (${preference.companyKey}, ${preference.companyName}, ${preference.tier},
              ${preference.disposition}, ${at(preference.updatedAt)})
      ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), tier = VALUES(tier),
        disposition = VALUES(disposition), updated_at = VALUES(updated_at)
    `;
  }

  /** 이번 수집에 등장한 회사 가운데 사람 override 가 걸린 것만 고른다. */
  async findPreferencesFor(
    keys: string[],
    client: DbClient = this.prisma,
  ): Promise<Map<string, CompanyPreference>> {
    if (keys.length === 0) return new Map();
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT company_key, company_name, tier, disposition, updated_at
      FROM company_preferences WHERE company_key IN (${Prisma.join(keys)})
    `;
    return new Map(
      rows.map((row) => [
        String(row.company_key),
        {
          companyKey: String(row.company_key),
          companyName: String(row.company_name),
          tier: number(row.tier),
          disposition: row.disposition as "analyze" | "exclude",
          updatedAt: iso(row.updated_at),
        },
      ]),
    );
  }

  // ---------------------------------------------------------------- 수집 실행

  /**
   * 수집 실행 행을 잠근다.
   *
   * 아직 없는 실행이면 자리만 먼저 만들고 그 행을 잠근다.
   * 멱등 키가 다른 두 요청이 같은 수집에 동시에 와도 뒤의 것이 앞의 것을 기다리게 하려면
   * 잠글 행이 실제로 있어야 한다.
   */
  async lockCollectionRun(
    collectionRunId: string,
    collectedAt: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT IGNORE INTO position_collection_runs
        (run_id, idempotency_key, collected_at, status, active_count, personal_excluded_count)
      VALUES (${collectionRunId}, ${`collection:${collectionRunId}`}, ${at(collectedAt)},
              'processing', 0, 0)
    `;
    await tx.$queryRaw`
      SELECT run_id FROM position_collection_runs WHERE run_id = ${collectionRunId} FOR UPDATE
    `;
  }

  async findCollectionRun(
    collectionRunId: string,
    client: DbClient = this.prisma,
  ): Promise<CollectionRunRow | undefined> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT run_id, collected_at, personal_excluded_count
      FROM position_collection_runs WHERE run_id = ${collectionRunId}
    `;
    const row = rows[0];
    if (!row) return undefined;
    return {
      collectionRunId: String(row.run_id),
      collectedAt: iso(row.collected_at),
      personalExcludedCount: number(row.personal_excluded_count),
    };
  }

  async completeCollectionRun(
    collectionRunId: string,
    collectedAt: string,
    activeCount: number,
    personalExcludedCount: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE position_collection_runs
      SET collected_at = ${at(collectedAt)}, status = 'completed', active_count = ${activeCount},
          personal_excluded_count = ${personalExcludedCount}
      WHERE run_id = ${collectionRunId}
    `;
  }

  async ensureSources(sources: string[], tx: Prisma.TransactionClient): Promise<void> {
    for (const source of new Set(sources)) {
      await tx.$executeRaw`
        INSERT INTO position_sources (source_key, enabled) VALUES (${source}, TRUE)
        ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
      `;
    }
  }

  /**
   * 바뀐 공고만 쓴다.
   *
   * 본문이 그대로면 `position_versions` 에 새 행을 만들지 않고 기존 version 을 다시 쓴다.
   */
  async upsertPositions(
    candidates: PostingCandidate[],
    collectedAt: string,
    tx: Prisma.TransactionClient,
  ): Promise<UpsertedPosition[]> {
    const upserted: UpsertedPosition[] = [];
    for (const posting of candidates) {
      const identityHash = positionIdentity(posting).slice(posting.source.length + 1);
      const contentHash = positionContentHash(posting);
      await tx.$executeRaw`
        INSERT INTO positions
          (position_id, source_key, identity_hash, normalized_url, company_key, company_name,
           title, lifecycle, first_seen_at, last_seen_at, pending_since)
        VALUES (${crypto.randomUUID()}, ${posting.source}, ${identityHash}, ${posting.url},
                ${companyKey(posting.company)}, ${posting.company}, ${posting.title}, 'active',
                ${at(collectedAt)}, ${at(collectedAt)}, ${at(collectedAt)})
        ON DUPLICATE KEY UPDATE normalized_url = VALUES(normalized_url),
          company_key = VALUES(company_key), company_name = VALUES(company_name),
          title = VALUES(title), lifecycle = 'active', last_seen_at = VALUES(last_seen_at)
      `;
      const positionRows = await tx.$queryRaw<RawRow[]>`
        SELECT position_id FROM positions
        WHERE source_key = ${posting.source} AND identity_hash = ${identityHash}
      `;
      const positionId = String(positionRows[0]!.position_id);
      const positionVersionId = await this.insertPositionVersionIfNew(
        positionId,
        contentHash,
        posting,
        collectedAt,
        tx,
      );
      upserted.push({ positionId, positionVersionId, contentHash, posting });
    }
    return upserted;
  }

  async insertPositionVersionIfNew(
    positionId: string,
    contentHash: string,
    snapshot: PostingCandidate,
    observedAt: string,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    await tx.$executeRaw`
      INSERT IGNORE INTO position_versions
        (position_version_id, position_id, content_hash, snapshot_json, observed_at)
      VALUES (${crypto.randomUUID()}, ${positionId}, ${contentHash}, ${JSON.stringify(snapshot)},
              ${at(observedAt)})
    `;
    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT position_version_id FROM position_versions
      WHERE position_id = ${positionId} AND content_hash = ${contentHash}
    `;
    return String(rows[0]!.position_version_id);
  }

  /** 이번 수집에서 보이지 않은 공고를 `not_seen` 으로 내린다. 수집이 성공한 소스만 대상이다. */
  async markMissingPositionsNotSeen(
    okSources: string[],
    seenPositionIds: string[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (okSources.length === 0) return;
    const seen =
      seenPositionIds.length === 0
        ? Prisma.empty
        : Prisma.sql`AND position_id NOT IN (${Prisma.join(seenPositionIds)})`;
    await tx.$executeRaw`
      UPDATE positions SET lifecycle = 'not_seen'
      WHERE lifecycle = 'active' AND source_key IN (${Prisma.join(okSources)}) ${seen}
    `;
  }

  async setPendingSince(
    positionIds: string[],
    pendingSince: string | null,
    collectedAt: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (positionIds.length === 0) return;
    if (pendingSince === null) {
      await tx.$executeRaw`
        UPDATE positions SET pending_since = NULL
        WHERE position_id IN (${Prisma.join(positionIds)})
      `;
      return;
    }
    await tx.$executeRaw`
      UPDATE positions SET pending_since = COALESCE(pending_since, ${at(collectedAt)})
      WHERE position_id IN (${Prisma.join(positionIds)})
    `;
  }

  async upsertDiagnostics(
    collectionRunId: string,
    diagnostics: SourceDiagnostic[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const diagnostic of diagnostics) {
      await tx.$executeRaw`
        INSERT INTO position_source_run_diagnostics
          (run_id, source_key, status, collected_count, imported_count, skipped_count,
           failed_count, public_message)
        VALUES (${collectionRunId}, ${diagnostic.source}, ${diagnostic.status},
                ${diagnostic.collectedCount}, ${diagnostic.importedCount},
                ${diagnostic.skippedCount}, ${diagnostic.failedCount},
                ${diagnostic.status === "ok" ? "" : "일부 공고를 확인하지 못했습니다."})
        ON DUPLICATE KEY UPDATE status = VALUES(status),
          collected_count = VALUES(collected_count), imported_count = VALUES(imported_count),
          skipped_count = VALUES(skipped_count), failed_count = VALUES(failed_count),
          public_message = VALUES(public_message)
      `;
    }
  }

  async insertCollectionItems(
    collectionRunId: string,
    positions: UpsertedPosition[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const entry of positions) {
      await tx.$executeRaw`
        INSERT IGNORE INTO position_collection_items
          (run_id, position_id, position_version_id, posting_status, close_urgency)
        VALUES (${collectionRunId}, ${entry.positionId}, ${entry.positionVersionId},
                ${entry.posting.postingStatus}, ${entry.posting.closeUrgency})
      `;
    }
  }

  async listCollectionDiagnostics(
    collectionRunId: string,
    client: DbClient = this.prisma,
  ): Promise<Array<{ source: string; status: string; failedCount: number }>> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT source_key, status, failed_count FROM position_source_run_diagnostics
      WHERE run_id = ${collectionRunId} ORDER BY source_key
    `;
    return rows.map((row) => ({
      source: String(row.source_key),
      status: String(row.status),
      failedCount: number(row.failed_count),
    }));
  }

  /** 이번 수집이 담은 공고를 읽는다. 순서는 소스 안에서 안정된 `identity_hash` 순이다. */
  async listCollectionPositions(
    collectionRunId: string,
    client: DbClient = this.prisma,
  ): Promise<CollectionPositionRow[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT p.position_id, pv.position_version_id, p.company_key, p.company_name,
             p.normalized_url, pv.content_hash
      FROM position_collection_items pci
      JOIN positions p ON p.position_id = pci.position_id
      JOIN position_versions pv ON pv.position_version_id = pci.position_version_id
      WHERE pci.run_id = ${collectionRunId}
      ORDER BY p.source_key, p.identity_hash
    `;
    return rows.map((row) => ({
      positionId: String(row.position_id),
      positionVersionId: String(row.position_version_id),
      companyKey: String(row.company_key),
      companyName: String(row.company_name),
      postingUrl: String(row.normalized_url),
      contentHash: String(row.content_hash),
    }));
  }

  async listAnalysesForCollection(
    collectionRunId: string,
    client: DbClient = this.prisma,
  ): Promise<PositionAnalysisRow[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT pa.position_id, pv.content_hash, pa.candidate_context_version, pa.contract_version,
             pa.valid_until, pa.analyzed_at
      FROM position_analyses pa
      JOIN position_versions pv ON pv.position_version_id = pa.position_version_id
      JOIN position_collection_items pci
        ON pci.position_id = pa.position_id AND pci.run_id = ${collectionRunId}
      ORDER BY pa.analyzed_at
    `;
    return rows.map((row) => ({
      positionId: String(row.position_id),
      contentHash: String(row.content_hash),
      candidateContextVersion: String(row.candidate_context_version),
      contractVersion: number(row.contract_version),
      validUntil: dateOnly(row.valid_until),
      analyzedAt: iso(row.analyzed_at),
    }));
  }

  async findAnalysisRunByCollection(
    collectionRunId: string,
    client: DbClient = this.prisma,
  ): Promise<AnalysisRunSummaryRow | undefined> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT analysis_run_id, contract_version FROM position_analysis_runs
      WHERE collection_run_id = ${collectionRunId}
    `;
    const row = rows[0];
    if (!row) return undefined;
    const analysisRunId = String(row.analysis_run_id);
    const items = await client.$queryRaw<RawRow[]>`
      SELECT result_status FROM position_analysis_run_items
      WHERE analysis_run_id = ${analysisRunId} ORDER BY selection_order
    `;
    return {
      analysisRunId,
      contractVersion: number(row.contract_version),
      resultStatuses: items.map(
        (item) => item.result_status as "pending" | "created" | "reused" | "failed",
      ),
    };
  }

  // ------------------------------------------------------------ 회사 tier 실행

  async findCompanyTierRunByCollectionRun(
    collectionRunId: string,
    client: DbClient = this.prisma,
  ): Promise<CompanyTierRunRow | undefined> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT company_tier_run_id, collection_run_id, candidate_context_version, contract_version,
             status, assessed_now_count, created_at
      FROM company_tier_assessment_runs WHERE collection_run_id = ${collectionRunId}
    `;
    return rows[0] ? this.toCompanyTierRun(rows[0]) : undefined;
  }

  /**
   * 회사 tier 실행 행을 잠그고 읽는다.
   *
   * 멱등 키가 다른 두 요청이 같은 실행에 동시에 오면 뒤의 것이 여기서 기다린다.
   * 이 잠금이 없으면 둘이 같은 대기 항목을 각자 읽고 서로의 결과를 덮어쓴다.
   */
  async lockCompanyTierRun(
    companyTierRunId: string,
    tx: Prisma.TransactionClient,
  ): Promise<CompanyTierRunRow | undefined> {
    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT company_tier_run_id, collection_run_id, candidate_context_version, contract_version,
             status, assessed_now_count, created_at
      FROM company_tier_assessment_runs WHERE company_tier_run_id = ${companyTierRunId}
      FOR UPDATE
    `;
    return rows[0] ? this.toCompanyTierRun(rows[0]) : undefined;
  }

  private toCompanyTierRun(row: RawRow): CompanyTierRunRow {
    return {
      companyTierRunId: String(row.company_tier_run_id),
      collectionRunId: String(row.collection_run_id),
      candidateContextVersion: String(row.candidate_context_version),
      contractVersion: number(row.contract_version),
      status: row.status as "pending" | "partial" | "completed",
      assessedNowCount: number(row.assessed_now_count),
      createdAt: iso(row.created_at),
    };
  }

  async listCompanyTierRunItems(
    companyTierRunId: string,
    client: DbClient = this.prisma,
  ): Promise<CompanyTierRunItemRow[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT company_key, company_name, selection_order, assessment_status, selection_reason,
             prior_tier, active_position_count, result_status, company_tier_assessment_id,
             failure_code, attempt_count
      FROM company_tier_assessment_run_items
      WHERE company_tier_run_id = ${companyTierRunId} ORDER BY selection_order
    `;
    return rows.map((row) => ({
      companyKey: String(row.company_key),
      companyName: String(row.company_name),
      selectionOrder: number(row.selection_order),
      assessmentStatus: row.assessment_status as "new" | "stale",
      selectionReason: row.selection_reason as "discovery" | "refresh",
      priorTier: row.prior_tier === null ? null : number(row.prior_tier),
      activePositionCount: number(row.active_position_count),
      resultStatus: row.result_status as "pending" | "created" | "reused" | "failed",
      companyTierAssessmentId:
        row.company_tier_assessment_id === null ? null : String(row.company_tier_assessment_id),
      failureCode: (row.failure_code ?? null) as CompanyTierFailureCode | null,
      attemptCount: number(row.attempt_count),
    }));
  }

  /**
   * 임차권이 끝난 처리 중 표시를 회수한다.
   *
   * 2시간이 지나도록 결과가 오지 않은 항목은 `lease_expired` 로 닫고 실행을 마감한다.
   * 회수하지 않으면 그 회사가 다음 수집에서도 계속 다른 실행에 묶여 있다.
   */
  async reclaimExpiredCompanyTierLeases(
    leaseCutoff: string,
    now: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE company_tier_assessment_run_items i
      JOIN company_tier_assessment_runs r ON r.company_tier_run_id = i.company_tier_run_id
      SET i.result_status = 'failed', i.failure_code = 'lease_expired',
          i.completed_at = ${at(now)}, i.attempt_count = i.attempt_count + 1
      WHERE r.status = 'pending' AND r.created_at <= ${at(leaseCutoff)}
        AND i.result_status = 'pending'
    `;
    await tx.$executeRaw`
      UPDATE company_tier_assessment_runs r
      SET r.status = CASE
            WHEN EXISTS (
              SELECT 1 FROM company_tier_assessment_run_items i
              WHERE i.company_tier_run_id = r.company_tier_run_id AND i.result_status = 'failed'
            ) THEN 'partial' ELSE 'completed' END,
          r.completed_at = ${at(now)}
      WHERE r.status = 'pending' AND r.created_at <= ${at(leaseCutoff)}
    `;
  }

  /**
   * 회사 tier 대기열을 고른다.
   *
   * 유효한 평가가 없는 회사를 활성 공고 수가 많은 순으로 먼저 고르고,
   * 남은 자리를 만료된 이전 Tier 1, 2, 3 순으로 채운다.
   * 사람 override 가 걸린 회사와 다른 실행이 처리 중인 회사는 제외한다.
   * 순서는 `ORDER BY` 가 정한다. 여기서 고른 차례가 곧 `selection_order` 다.
   */
  async selectCompanyTierQueue(
    collectionRunId: string,
    candidateContextVersion: string,
    contractVersion: number,
    today: string,
    limit: number,
    tx: Prisma.TransactionClient,
  ): Promise<QueuedCompanyRow[]> {
    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT g.company_key, g.company_name, g.active_position_count, g.first_seen_at,
             prior.recommended_tier AS prior_tier, prior.reason AS prior_reason,
             prior.valid_until AS prior_valid_until
      FROM (
        SELECT p.company_key,
               MIN(p.company_name) AS company_name,
               COUNT(*) AS active_position_count,
               MIN(p.first_seen_at) AS first_seen_at
        FROM position_collection_items pci
        JOIN positions p ON p.position_id = pci.position_id
        WHERE pci.run_id = ${collectionRunId}
        GROUP BY p.company_key
      ) g
      LEFT JOIN LATERAL (
        SELECT a.recommended_tier, a.reason, a.valid_until
        FROM company_tier_assessments a
        WHERE a.company_key = g.company_key
          AND a.candidate_context_version = ${candidateContextVersion}
          AND a.contract_version = ${contractVersion}
        ORDER BY a.assessed_at DESC
        LIMIT 1
      ) prior ON TRUE
      WHERE NOT EXISTS (
          SELECT 1 FROM company_preferences pref WHERE pref.company_key = g.company_key
        )
        AND NOT EXISTS (
          SELECT 1 FROM company_tier_assessment_run_items li
          JOIN company_tier_assessment_runs lr ON lr.company_tier_run_id = li.company_tier_run_id
          WHERE li.company_key = g.company_key AND li.result_status = 'pending'
            AND lr.collection_run_id <> ${collectionRunId}
        )
        AND NOT EXISTS (
          SELECT 1 FROM company_tier_assessments va
          WHERE va.company_key = g.company_key
            AND va.candidate_context_version = ${candidateContextVersion}
            AND va.contract_version = ${contractVersion}
            AND va.valid_until >= ${today}
        )
      ORDER BY
        (prior.recommended_tier IS NOT NULL) ASC,
        CASE WHEN prior.recommended_tier IS NULL
             THEN -g.active_position_count ELSE prior.recommended_tier END ASC,
        CASE WHEN prior.recommended_tier IS NULL THEN g.first_seen_at ELSE NULL END ASC,
        CASE WHEN prior.recommended_tier IS NULL THEN NULL ELSE prior.valid_until END ASC,
        g.company_key ASC
      LIMIT ${Prisma.raw(String(Math.trunc(limit)))}
    `;
    return rows.map((row) => ({
      companyKey: String(row.company_key),
      companyName: String(row.company_name),
      activePositionCount: number(row.active_position_count),
      assessmentStatus: row.prior_tier === null ? "new" : "stale",
      priorTier: row.prior_tier === null ? null : number(row.prior_tier),
      priorReason: row.prior_reason === null ? null : String(row.prior_reason),
      priorValidUntil: row.prior_valid_until === null ? null : dateOnly(row.prior_valid_until),
    }));
  }

  async insertCompanyTierRun(
    run: CompanyTierRunRow,
    completedAt: string | null,
    items: QueuedCompanyRow[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO company_tier_assessment_runs
        (company_tier_run_id, collection_run_id, candidate_context_version, contract_version,
         status, assessed_now_count, created_at, completed_at)
      VALUES (${run.companyTierRunId}, ${run.collectionRunId}, ${run.candidateContextVersion},
              ${run.contractVersion}, ${run.status}, ${run.assessedNowCount}, ${at(run.createdAt)},
              ${completedAt === null ? null : at(completedAt)})
    `;
    for (const [index, company] of items.entries()) {
      await tx.$executeRaw`
        INSERT INTO company_tier_assessment_run_items
          (company_tier_run_id, company_key, company_name, selection_order, assessment_status,
           selection_reason, prior_tier, active_position_count, result_status,
           company_tier_assessment_id, failure_code, attempt_count, completed_at)
        VALUES (${run.companyTierRunId}, ${company.companyKey}, ${company.companyName},
                ${index + 1}, ${company.assessmentStatus},
                ${company.assessmentStatus === "new" ? "discovery" : "refresh"},
                ${company.assessmentStatus === "new" ? null : company.priorTier},
                ${company.activePositionCount}, 'pending', NULL, NULL, 0, NULL)
      `;
    }
  }

  // ------------------------------------------------------------ 회사 tier 평가

  /** 회사의 유효한 모델 평가를 찾는다. 만료된 것은 담지 않는다. */
  async findValidAssessments(
    companyKeys: string[],
    candidateContextVersion: string,
    contractVersion: number,
    today: string,
    client: DbClient = this.prisma,
  ): Promise<Map<string, StoredCompanyTierAssessment>> {
    if (companyKeys.length === 0) return new Map();
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT company_tier_assessment_id, company_key, company_name, candidate_context_version,
             contract_version, created_by_company_tier_run_id, recommended_tier, confidence,
             reason, signals_json, evidence_json, assumptions_json, assessed_at, valid_until
      FROM company_tier_assessments
      WHERE company_key IN (${Prisma.join(companyKeys)})
        AND candidate_context_version = ${candidateContextVersion}
        AND contract_version = ${contractVersion}
        AND valid_until >= ${today}
      ORDER BY assessed_at ASC
    `;
    const latest = new Map<string, StoredCompanyTierAssessment>();
    for (const row of rows) latest.set(String(row.company_key), this.toAssessment(row));
    return latest;
  }

  /** 만료 여부와 무관하게 회사마다 가장 최근 평가를 찾는다. */
  async findLatestAssessments(
    companyKeys: string[],
    candidateContextVersion: string,
    contractVersion: number,
    client: DbClient = this.prisma,
  ): Promise<Map<string, StoredCompanyTierAssessment>> {
    if (companyKeys.length === 0) return new Map();
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT company_tier_assessment_id, company_key, company_name, candidate_context_version,
             contract_version, created_by_company_tier_run_id, recommended_tier, confidence,
             reason, signals_json, evidence_json, assumptions_json, assessed_at, valid_until
      FROM company_tier_assessments
      WHERE company_key IN (${Prisma.join(companyKeys)})
        AND candidate_context_version = ${candidateContextVersion}
        AND contract_version = ${contractVersion}
      ORDER BY assessed_at ASC
    `;
    const latest = new Map<string, StoredCompanyTierAssessment>();
    for (const row of rows) latest.set(String(row.company_key), this.toAssessment(row));
    return latest;
  }

  private toAssessment(row: RawRow): StoredCompanyTierAssessment {
    return {
      companyTierAssessmentId: String(row.company_tier_assessment_id),
      companyKey: String(row.company_key),
      companyName: String(row.company_name),
      candidateContextVersion: String(row.candidate_context_version),
      contractVersion: number(row.contract_version),
      createdByCompanyTierRunId:
        row.created_by_company_tier_run_id === null
          ? null
          : String(row.created_by_company_tier_run_id),
      recommendedTier: number(row.recommended_tier),
      confidence: row.confidence as "low" | "medium" | "high",
      reason: String(row.reason),
      signals: jsonValue<Record<string, unknown>>(row.signals_json),
      evidence: jsonValue<unknown[]>(row.evidence_json),
      assumptions: jsonValue<string[]>(row.assumptions_json),
      assessedAt: iso(row.assessed_at),
      validUntil: dateOnly(row.valid_until),
    };
  }

  /** 평가는 더하기만 한다. 과거 행을 고치거나 지우지 않는다. */
  async insertCompanyTierAssessments(
    assessments: StoredCompanyTierAssessment[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const assessment of assessments) {
      await tx.$executeRaw`
        INSERT INTO company_tier_assessments
          (company_tier_assessment_id, company_key, company_name, candidate_context_version,
           contract_version, created_by_company_tier_run_id, recommended_tier, confidence,
           reason, signals_json, evidence_json, assumptions_json, assessed_at, valid_until)
        VALUES (${assessment.companyTierAssessmentId}, ${assessment.companyKey},
                ${assessment.companyName}, ${assessment.candidateContextVersion},
                ${assessment.contractVersion}, ${assessment.createdByCompanyTierRunId},
                ${assessment.recommendedTier}, ${assessment.confidence}, ${assessment.reason},
                ${JSON.stringify(assessment.signals)}, ${JSON.stringify(assessment.evidence)},
                ${JSON.stringify(assessment.assumptions)}, ${at(assessment.assessedAt)},
                ${assessment.validUntil})
      `;
    }
  }

  async updateCompanyTierRunItems(
    updates: CompanyTierRunItemUpdate[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const update of updates) {
      await tx.$executeRaw`
        UPDATE company_tier_assessment_run_items
        SET result_status = ${update.resultStatus},
            company_tier_assessment_id = ${update.companyTierAssessmentId},
            failure_code = ${update.failureCode},
            attempt_count = attempt_count + 1,
            completed_at = ${at(update.completedAt)}
        WHERE company_tier_run_id = ${update.companyTierRunId}
          AND company_key = ${update.companyKey}
      `;
    }
  }

  async closeCompanyTierRun(
    companyTierRunId: string,
    status: "partial" | "completed",
    assessedNowCount: number,
    completedAt: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE company_tier_assessment_runs
      SET status = ${status}, assessed_now_count = ${assessedNowCount},
          completed_at = ${at(completedAt)}
      WHERE company_tier_run_id = ${companyTierRunId}
    `;
  }
}
