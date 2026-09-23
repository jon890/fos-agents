import { Injectable } from "@nestjs/common";

import { ApiError } from "../common/api-error.js";
import type { Prisma } from "../generated/prisma/client.js";
import { companyKey, positionIdentity, stableUuid } from "./hash.js";
import { todaySeoulIsoDate } from "./seoul-date.js";
import {
  PositionsRepository,
  type AnalysisRunItemRow,
  type AnalysisRunItemUpdate,
  type AnalysisRunRow,
  type CollectionPositionRow,
  type CompanyTierRunItemRow,
  type CompanyTierRunItemUpdate,
  type CompanyTierRunRow,
  type NewAnalysisRow,
  type PositionAnalysisRow,
  type RecommendationAnalysisRow,
  type RecommendationInputs,
  type RecommendationItemRow,
  type RecommendationPositionRow,
  type StoredRecommendation,
  type UpsertedPosition,
} from "./repository/positions.repository.js";
import {
  analysisPolicySchema,
  analysisQueueResponseSchema,
  analysisResultsResponseSchema,
  companyPreferenceSchema,
  companyTierQueueResponseSchema,
  companyTierResultsResponseSchema,
  positionPreparationResponseSchema,
  type AnalysisPolicy,
  type AnalysisQueueResponse,
  type AnalysisResultsRequest,
  type AnalysisResultsResponse,
  type CollectionRequest,
  type CompanyPreference,
  type CompanyTierQueueResponse,
  type CompanyTierResultsRequest,
  type CompanyTierResultsResponse,
  type ExclusionsRequest,
  type PositionExclusion,
  recommendationResponseSchema,
  type PositionPreparationResponse,
  type RecommendationResponse,
} from "./schema.js";
import type { CompanyTierSource, StoredCompanyTierAssessment } from "./stored.js";
import { companyTierProvenanceFields } from "./tier-provenance.js";

/** 회사 tier 평가 임차권의 길이. 이 시간이 지나면 처리 중 표시를 회수한다. */
const COMPANY_TIER_LEASE_MS = 2 * 60 * 60 * 1000;

/** 회사 tier 실행이 없는 옛 수집을 해석할 때 쓰는 계약 버전이다. 요청 schema 의 기본값과 같다. */
const DEFAULT_ANALYSIS_CONTRACT_VERSION = 1;

/** 회사 tier 실행이 없는 옛 수집의 회사 tier 계약 버전. 요청 schema 의 기본값과 같다. */
const DEFAULT_COMPANY_TIER_CONTRACT_VERSION = 1;

type AnalysisStatus = "fresh" | "new" | "changed" | "stale";

/** 추천 순위의 1차 기준. 낮을수록 앞이다. */
const DECISION_ORDER = { recommend: 0, consider: 1, hold: 2 } as const;

/** 추천 순위의 4차 기준. 마감이 급한 공고가 앞이다. */
const URGENCY_ORDER = { urgent: 0, soon: 1, normal: 2, no_deadline: 3, unknown: 4 } as const;

/** 공고 하나의 회사 tier 와 그 출처. 모델 평가일 때만 평가 본문이 붙는다. */
type ResolvedTier = {
  tier: number;
  source: CompanyTierSource;
  assessment: StoredCompanyTierAssessment | undefined;
};

type RecommendationEntry = {
  position: RecommendationPositionRow;
  analysis: RecommendationAnalysisRow | undefined;
} & ResolvedTier;

function dateOnlyAfterDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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

function analysisStatusOf(
  contentHash: string,
  analyses: PositionAnalysisRow[],
  contextVersion: string,
  contractVersion: number,
  now: string,
): AnalysisStatus {
  const today = now.slice(0, 10);
  const fresh = analyses.some(
    (analysis) =>
      analysis.contentHash === contentHash &&
      analysis.candidateContextVersion === contextVersion &&
      analysis.contractVersion === contractVersion &&
      analysis.validUntil >= today,
  );
  if (fresh) return "fresh";
  if (analyses.length === 0) return "new";
  if (!analyses.some((analysis) => analysis.contentHash === contentHash)) return "changed";
  return "stale";
}

/** 회사마다 하나씩 고른 tier 출처를 추천 응답의 집계로 바꾼다. */
function tierSourceSummary(sources: CompanyTierSource[], assessmentFailedCount: number) {
  return {
    manualCount: sources.filter((source) => source === "manual").length,
    modelCount: sources.filter((source) => source === "model").length,
    defaultCount: sources.filter((source) => source === "default").length,
    assessmentFailedCount,
  };
}

function groupAnalyses(rows: PositionAnalysisRow[]): Map<string, PositionAnalysisRow[]> {
  const grouped = new Map<string, PositionAnalysisRow[]>();
  for (const row of rows) {
    const values = grouped.get(row.positionId) ?? [];
    values.push(row);
    grouped.set(row.positionId, values);
  }
  return grouped;
}

/**
 * 포지션 도메인의 정책과 회사 선호와 수집 실행을 다룬다.
 *
 * 상태 전체를 메모리에 올리지 않고 필요한 행만 읽는다.
 * 쓰기는 하나의 transaction 안에서 자기 실행 행을 먼저 잠근 뒤에 진행한다.
 */
@Injectable()
export class PositionsService {
  constructor(private readonly repository: PositionsRepository) {}

  async configurePolicy(
    policy: AnalysisPolicy,
    now = new Date().toISOString(),
  ): Promise<AnalysisPolicy> {
    await this.repository.transaction(async (tx) => {
      await this.repository.lockPolicy(tx);
      await this.repository.upsertPolicy(policy, now, tx);
    });
    return policy;
  }

  async listCompanyPreferences(): Promise<CompanyPreference[]> {
    const preferences = await this.repository.listPreferences(this.repository.reader());
    return preferences.sort((left, right) => left.companyKey.localeCompare(right.companyKey));
  }

  async updateCompanyPreference(
    companyKeyParam: string,
    value: Omit<CompanyPreference, "updatedAt">,
    now = new Date().toISOString(),
  ): Promise<CompanyPreference> {
    if (value.companyKey !== companyKeyParam) {
      throw new ApiError(409, "VERSION_CONFLICT", "회사 식별자가 요청 경로와 다릅니다.");
    }
    const preference = companyPreferenceSchema.parse({ ...value, updatedAt: now });
    await this.repository.transaction((tx) => this.repository.upsertPreference(preference, tx));
    return preference;
  }

  /**
   * 아직 유효한 개인 공고 제외 규칙을 준다.
   *
   * 판정 기준 날짜는 Seoul 기준이다. `expiresAt` 이 오늘이면 아직 적용하고 다음 날부터 뺀다.
   */
  async listExclusions(now = new Date()): Promise<PositionExclusion[]> {
    return this.repository.listExclusions(todaySeoulIsoDate(now), this.repository.reader());
  }

  /**
   * 제외 규칙 전체를 받은 배열로 바꾼다.
   *
   * 규칙 하나를 고치는 경로를 두지 않는다. 사람이 한 번에 검토하는 단위가 목록 전체다.
   * 대체와 되읽기를 한 transaction 에서 해, 돌려준 목록이 방금 쓴 것과 어긋나지 않게 한다.
   */
  async replaceExclusions(
    request: ExclusionsRequest,
    now = new Date(),
  ): Promise<PositionExclusion[]> {
    const today = todaySeoulIsoDate(now);
    return this.repository.transaction(async (tx) => {
      await this.repository.lockExclusions(tx);
      await this.repository.replaceExclusions(request.exclusions, tx);
      return this.repository.listExclusions(today, tx);
    });
  }

  async saveCollection(
    request: CollectionRequest,
    now = new Date().toISOString(),
  ): Promise<PositionPreparationResponse> {
    const collectionRunId = request.pool.collectionRunId;
    const collectedAt = request.pool.collectedAt;
    return this.repository.transaction(async (tx) => {
      const policy = await this.requirePolicy(tx);
      await this.repository.lockCollectionRun(collectionRunId, collectedAt, tx);

      const existingRun = await this.repository.findCompanyTierRunByCollectionRun(
        collectionRunId,
        tx,
      );
      if (existingRun) {
        return this.preparationResponse(tx, policy, existingRun, now);
      }

      const upserted = await this.storeCandidates(request, tx);
      await this.repository.upsertDiagnostics(collectionRunId, request.pool.sourceDiagnostics, tx);
      await this.repository.insertCollectionItems(collectionRunId, upserted, tx);
      await this.repository.completeCollectionRun(
        collectionRunId,
        collectedAt,
        upserted.length,
        request.pool.filterSummary.personalExcludedCount,
        tx,
      );
      await this.refreshPendingSince(request, policy, upserted, now, tx);

      const run = await this.openCompanyTierRun(request, policy, now, tx);
      return this.preparationResponse(tx, policy, run, now);
    });
  }

  async saveCompanyTierResults(
    companyTierRunId: string,
    request: CompanyTierResultsRequest,
    now = new Date().toISOString(),
  ): Promise<CompanyTierResultsResponse> {
    return this.repository.transaction(async (tx) => {
      const policy = await this.requirePolicy(tx);
      const run = await this.repository.lockCompanyTierRun(companyTierRunId, tx);
      if (!run || run.collectionRunId !== request.collectionRunId) {
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "회사 tier 실행과 수집 실행이 일치하지 않습니다.",
        );
      }
      const items = await this.repository.listCompanyTierRunItems(companyTierRunId, tx);
      const submittedKeys = [
        ...request.results.map((result) => result.companyKey),
        ...request.failures.map((failure) => failure.companyKey),
      ];

      if (run.status === "completed") {
        // 끝난 실행에 같은 본문을 다시 보내면 멱등 응답을 돌려준다.
        // 다만 이 실행이 고르지 않은 회사가 섞여 있으면 받아들이지 않는다.
        // 멱등 키가 다르면 수신 기록을 지나쳐 여기까지 오기 때문이다.
        const known = new Set(items.map((item) => item.companyKey));
        if (submittedKeys.some((key) => !known.has(key))) {
          throw new ApiError(
            409,
            "VERSION_CONFLICT",
            "이 회사 tier 실행이 고르지 않은 회사가 결과에 있습니다.",
          );
        }
        return this.companyTierResultsResponse(run.companyTierRunId, run.status, items, false);
      }

      if (Date.parse(now) - Date.parse(run.createdAt) >= COMPANY_TIER_LEASE_MS) {
        throw new ApiError(
          409,
          "COMPANY_TIER_LEASE_EXPIRED",
          "회사 tier 평가 임차권이 끝나 결과를 반영할 수 없습니다.",
        );
      }

      const openKeys = items
        .filter((item) => item.resultStatus === "pending" || item.resultStatus === "failed")
        .map((item) => item.companyKey);
      if (
        new Set(submittedKeys).size !== submittedKeys.length ||
        submittedKeys.length !== openKeys.length ||
        openKeys.some((key) => !submittedKeys.includes(key))
      ) {
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "아직 끝나지 않은 모든 회사의 결과가 한 번씩 필요합니다.",
        );
      }

      const applied = await this.applyCompanyTierResults(run, policy, items, request, now, tx);
      const status = applied.some((item) => item.resultStatus === "failed")
        ? ("partial" as const)
        : ("completed" as const);
      const assessedNowCount = applied.filter((item) => item.resultStatus === "created").length;
      await this.repository.closeCompanyTierRun(
        run.companyTierRunId,
        status,
        assessedNowCount,
        now,
        tx,
      );
      return this.companyTierResultsResponse(run.companyTierRunId, status, applied, true);
    });
  }

  /**
   * 수집 실행 하나에 공고 분석 실행을 연다.
   *
   * 회사 tier 평가가 끝나야 공고의 tier 를 확정할 수 있으므로 그 전에는 만들지 않는다.
   * 이미 만든 실행이 있으면 그 대기열을 그대로 돌려준다.
   */
  async createPositionAnalysisRun(
    collectionRunId: string,
    now = new Date().toISOString(),
  ): Promise<AnalysisQueueResponse> {
    return this.repository.transaction(async (tx) => {
      const policy = await this.requirePolicy(tx);
      const collection = await this.repository.findCollectionRun(collectionRunId, tx);
      if (!collection) throw new ApiError(404, "NOT_FOUND", "수집 실행을 찾을 수 없습니다.");
      await this.repository.lockCollectionRun(collectionRunId, collection.collectedAt, tx);

      const existing = await this.repository.findAnalysisRunByCollection(collectionRunId, tx);
      if (existing) {
        const stored = await this.repository.findAnalysisRunWithItems(existing.analysisRunId, tx);
        return this.queueResponse(tx, stored!.run, stored!.items, now);
      }

      await this.repository.reclaimExpiredCompanyTierLeases(
        new Date(Date.parse(now) - COMPANY_TIER_LEASE_MS).toISOString(),
        now,
        tx,
      );
      const tierRun = await this.repository.findCompanyTierRunByCollectionRun(collectionRunId, tx);
      if (!tierRun) {
        throw new ApiError(409, "COMPANY_TIER_RUN_MISSING", "회사 tier 실행이 아직 없습니다.");
      }
      if (tierRun.status === "pending") {
        throw new ApiError(
          409,
          "COMPANY_TIER_RUN_PENDING",
          "회사 tier 평가가 끝나지 않아 공고 분석 실행을 만들 수 없습니다.",
        );
      }

      const selected = await this.repository.selectAnalysisQueue(
        {
          collectionRunId,
          collectedAt: collection.collectedAt,
          candidateContextVersion: policy.candidateContextVersion,
          analysisContractVersion: DEFAULT_ANALYSIS_CONTRACT_VERSION,
          companyTierContractVersion: tierRun.contractVersion,
          defaultCompanyTier: policy.defaultCompanyTier,
          today: now.slice(0, 10),
          prioritySlots: policy.prioritySlots,
          agingSlots: policy.agingSlots,
        },
        tx,
      );
      const run: AnalysisRunRow = {
        analysisRunId: stableUuid(`analysis:${collectionRunId}`),
        collectionRunId,
        candidateContextVersion: policy.candidateContextVersion,
        contractVersion: DEFAULT_ANALYSIS_CONTRACT_VERSION,
        status: selected.length === 0 ? "completed" : "pending",
        analyzedNowCount: 0,
        createdAt: now,
      };
      await this.repository.insertAnalysisRun(
        run,
        selected.length === 0 ? now : null,
        selected,
        tx,
      );
      const stored = await this.repository.findAnalysisRunWithItems(run.analysisRunId, tx);
      return this.queueResponse(tx, run, stored!.items, now);
    });
  }

  /**
   * 분석 결과와 실패를 실행에 반영한다.
   *
   * 아직 끝나지 않은 항목 전체가 한 번씩 와야 반영한다.
   * 실패가 남으면 실행은 `partial` 로 두고 client 가 남은 항목만 다시 보낸다.
   */
  async saveAnalysisResults(
    analysisRunId: string,
    request: AnalysisResultsRequest,
    now = new Date().toISOString(),
  ): Promise<AnalysisResultsResponse> {
    return this.repository.transaction(async (tx) => {
      const run = await this.repository.lockAnalysisRun(analysisRunId, tx);
      if (!run || run.collectionRunId !== request.collectionRunId) {
        throw new ApiError(409, "VERSION_CONFLICT", "분석 실행과 수집 실행이 일치하지 않습니다.");
      }
      const items = (await this.repository.findAnalysisRunWithItems(analysisRunId, tx))!.items;
      if (run.status === "completed") {
        return this.resultsResponse(run.analysisRunId, run.status, items, false);
      }

      const openIds = items
        .filter((item) => item.resultStatus === "pending" || item.resultStatus === "failed")
        .map((item) => item.positionId);
      const submittedIds = [
        ...request.results.map((result) => result.positionId),
        ...request.failures.map((failure) => failure.positionId),
      ];
      if (
        new Set(submittedIds).size !== submittedIds.length ||
        submittedIds.length !== openIds.length ||
        openIds.some((positionId) => !submittedIds.includes(positionId))
      ) {
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "아직 끝나지 않은 모든 공고의 결과가 한 번씩 필요합니다.",
        );
      }

      const applied = await this.applyAnalysisResults(run, items, request, now, tx);
      const status = applied.some((item) => item.resultStatus === "failed")
        ? ("partial" as const)
        : ("completed" as const);
      const analyzedNowCount = applied.filter((item) => item.resultStatus === "created").length;
      await this.repository.updateAnalysisRunStatus(
        run.analysisRunId,
        status,
        analyzedNowCount,
        now,
        tx,
      );
      return this.resultsResponse(run.analysisRunId, status, applied, true);
    });
  }


  /**
   * 분석 실행 하나에 추천을 만든다.
   *
   * 같은 분석 실행에 추천은 하나뿐이다. 이미 만든 것이 있으면 그것을 그대로 돌려준다.
   */
  async createRecommendation(
    analysisRunId: string,
    now = new Date().toISOString(),
  ): Promise<RecommendationResponse> {
    return this.repository.transaction(async (tx) => {
      const run = await this.repository.lockRecommendationRun(analysisRunId, tx);
      if (!run) throw new ApiError(404, "NOT_FOUND", "분석 실행을 찾을 수 없습니다.");
      const stored = await this.repository.findStoredRecommendation({ analysisRunId }, tx);
      if (stored) return this.storedRecommendationResponse(stored, tx);
      if (run.status === "pending") {
        throw new ApiError(409, "VERSION_CONFLICT", "분석 실행이 끝나지 않았습니다.");
      }
      const policy = await this.requirePolicy(tx);
      const inputs = await this.repository.findRecommendationInputs(
        analysisRunId,
        now.slice(0, 10),
        DEFAULT_COMPANY_TIER_CONTRACT_VERSION,
        tx,
      );
      return this.buildRecommendation(inputs!, policy, now, tx);
    });
  }

  /**
   * 실행 ID 하나로 수집 실행과 공고 분석 실행과 추천 실행을 조회한다.
   *
   * 셋은 응답 모양이 다르므로 하나로 합치지 않는다.
   * 추천 실행 ID 는 분석 실행 ID 에서 만들어지므로 아직 만들지 않은 추천도 가리킬 수 있다.
   * 그때는 그 자리에서 만든다.
   */
  async getRun(id: string): Promise<AnalysisQueueResponse | RecommendationResponse> {
    const found = await this.repository.findRunById(id, this.repository.reader());
    if (!found) throw new ApiError(404, "NOT_FOUND", "실행을 찾을 수 없습니다.");
    if (found.kind === "recommendation-missing") {
      return this.createRecommendation(found.analysisRunId);
    }
    return this.repository.transaction(async (tx) => {
      if (found.kind === "recommendation") {
        const stored = await this.repository.findStoredRecommendation(
          { recommendationRunId: found.recommendationRunId },
          tx,
        );
        return this.storedRecommendationResponse(stored!, tx);
      }
      // 실행 조회는 정책을 읽지 않는다. 집계에 필요한 두 버전이 실행 행에 있다.
      // 정책을 읽으면 정책 미설정 상태의 조회가 409 로 끝나 전환 전과 달라진다.
      const stored = await this.repository.findAnalysisRunWithItems(found.analysisRunId, tx);
      return this.queueResponse(tx, stored!.run, stored!.items, stored!.run.createdAt);
    });
  }

  // ------------------------------------------------------------------ 내부 흐름

  private async requirePolicy(tx: Prisma.TransactionClient): Promise<AnalysisPolicy> {
    const parsed = analysisPolicySchema.safeParse(await this.repository.findPolicy(tx));
    if (!parsed.success) {
      throw new ApiError(409, "POLICY_NOT_CONFIGURED", "포지션 분석 정책이 준비되지 않았습니다.");
    }
    return parsed.data;
  }

  /** 제외 회사를 뺀 공고를 저장하고, 이번 수집에서 보이지 않은 공고를 내린다. */
  private async storeCandidates(
    request: CollectionRequest,
    tx: Prisma.TransactionClient,
  ): Promise<UpsertedPosition[]> {
    const candidates = request.pool.candidates;
    const preferences = await this.repository.findPreferencesFor(
      [...new Set(candidates.map((posting) => companyKey(posting.company)))],
      tx,
    );
    const accepted = new Map<string, (typeof candidates)[number]>();
    for (const posting of candidates) {
      if (preferences.get(companyKey(posting.company))?.disposition === "exclude") continue;
      accepted.set(positionIdentity(posting), posting);
    }
    const postings = [...accepted.values()];
    await this.repository.ensureSources(
      [
        ...postings.map((posting) => posting.source),
        ...request.pool.sourceDiagnostics.map((diagnostic) => diagnostic.source),
      ],
      tx,
    );
    const upserted = await this.repository.upsertPositions(
      postings,
      request.pool.collectedAt,
      tx,
    );
    await this.repository.markMissingPositionsNotSeen(
      request.pool.sourceDiagnostics
        .filter((diagnostic) => diagnostic.status === "ok")
        .map((diagnostic) => diagnostic.source),
      upserted.map((entry) => entry.positionId),
      tx,
    );
    return upserted;
  }

  /** 유효한 분석이 있는 공고는 대기에서 빼고, 나머지는 처음 기다리기 시작한 시각을 유지한다. */
  private async refreshPendingSince(
    request: CollectionRequest,
    policy: AnalysisPolicy,
    upserted: UpsertedPosition[],
    now: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const analyses = groupAnalyses(
      await this.repository.listAnalysesForCollection(request.pool.collectionRunId, tx),
    );
    const fresh: string[] = [];
    const waiting: string[] = [];
    for (const entry of upserted) {
      const status = analysisStatusOf(
        entry.contentHash,
        analyses.get(entry.positionId) ?? [],
        policy.candidateContextVersion,
        request.analysisContractVersion,
        now,
      );
      (status === "fresh" ? fresh : waiting).push(entry.positionId);
    }
    await this.repository.setPendingSince(fresh, null, request.pool.collectedAt, tx);
    await this.repository.setPendingSince(
      waiting,
      request.pool.collectedAt,
      request.pool.collectedAt,
      tx,
    );
  }

  private async openCompanyTierRun(
    request: CollectionRequest,
    policy: AnalysisPolicy,
    now: string,
    tx: Prisma.TransactionClient,
  ): Promise<CompanyTierRunRow> {
    await this.repository.reclaimExpiredCompanyTierLeases(
      new Date(Date.parse(now) - COMPANY_TIER_LEASE_MS).toISOString(),
      now,
      tx,
    );
    const selected = await this.repository.selectCompanyTierQueue(
      request.pool.collectionRunId,
      policy.candidateContextVersion,
      request.companyTierContractVersion,
      now.slice(0, 10),
      policy.dailyCompanyTierLimit,
      tx,
    );
    const run: CompanyTierRunRow = {
      companyTierRunId: stableUuid(`company-tier:${request.pool.collectionRunId}`),
      collectionRunId: request.pool.collectionRunId,
      candidateContextVersion: policy.candidateContextVersion,
      contractVersion: request.companyTierContractVersion,
      status: selected.length === 0 ? "completed" : "pending",
      assessedNowCount: 0,
      createdAt: now,
    };
    await this.repository.insertCompanyTierRun(
      run,
      selected.length === 0 ? now : null,
      selected,
      tx,
    );
    return run;
  }

  /**
   * 결과와 실패를 실행 항목에 반영한다.
   *
   * 이미 유효한 평가가 있으면 새 평가를 만들지 않고 그것을 다시 쓴다.
   * 그래야 같은 회사를 같은 날 두 번 평가해도 모델 호출 결과가 새 행으로 쌓이지 않는다.
   */
  private async applyCompanyTierResults(
    run: CompanyTierRunRow,
    policy: AnalysisPolicy,
    items: CompanyTierRunItemRow[],
    request: CompanyTierResultsRequest,
    now: string,
    tx: Prisma.TransactionClient,
  ): Promise<CompanyTierRunItemRow[]> {
    const byKey = new Map(items.map((item) => [item.companyKey, item]));
    const reusable = await this.repository.findValidAssessments(
      request.results.map((result) => result.companyKey),
      run.candidateContextVersion,
      run.contractVersion,
      now.slice(0, 10),
      tx,
    );
    const created: StoredCompanyTierAssessment[] = [];
    const updates: CompanyTierRunItemUpdate[] = [];
    const applied = items.map((item) => ({ ...item }));
    const appliedByKey = new Map(applied.map((item) => [item.companyKey, item]));

    for (const result of request.results) {
      const item = byKey.get(result.companyKey)!;
      const existing = reusable.get(result.companyKey);
      const assessment: StoredCompanyTierAssessment = existing ?? {
        companyTierAssessmentId: crypto.randomUUID(),
        companyKey: result.companyKey,
        companyName: item.companyName,
        candidateContextVersion: run.candidateContextVersion,
        contractVersion: run.contractVersion,
        createdByCompanyTierRunId: run.companyTierRunId,
        recommendedTier: result.recommendedTier,
        confidence: result.confidence,
        reason: result.reason,
        signals: Object.fromEntries(result.signals.map((signal) => [signal.axis, signal.level])),
        evidence: structuredClone(result.evidence),
        assumptions: [...result.assumptions],
        assessedAt: now,
        validUntil: [
          dateOnlyAfterDays(now, policy.companyTierStaleAfterDays),
          ...result.evidence
            .map((entry) => entry.validUntil)
            .filter((entry): entry is string => Boolean(entry)),
          ...(result.validUntil ? [result.validUntil] : []),
        ].sort()[0]!,
      };
      if (!existing) created.push(assessment);
      const resultStatus = existing ? ("reused" as const) : ("created" as const);
      updates.push({
        companyTierRunId: run.companyTierRunId,
        companyKey: result.companyKey,
        resultStatus,
        companyTierAssessmentId: assessment.companyTierAssessmentId,
        failureCode: null,
        completedAt: now,
      });
      const target = appliedByKey.get(result.companyKey)!;
      target.resultStatus = resultStatus;
      target.companyTierAssessmentId = assessment.companyTierAssessmentId;
      target.failureCode = null;
      target.attemptCount += 1;
    }

    for (const failure of request.failures) {
      updates.push({
        companyTierRunId: run.companyTierRunId,
        companyKey: failure.companyKey,
        resultStatus: "failed",
        companyTierAssessmentId: null,
        failureCode: failure.failureCode,
        completedAt: now,
      });
      const target = appliedByKey.get(failure.companyKey)!;
      target.resultStatus = "failed";
      target.companyTierAssessmentId = null;
      target.failureCode = failure.failureCode;
      target.attemptCount += 1;
    }

    await this.repository.insertCompanyTierAssessments(created, tx);
    await this.repository.updateCompanyTierRunItems(updates, tx);
    return applied;
  }

  /**
   * 결과와 실패를 실행 항목에 반영한다.
   *
   * 같은 공고 version 에 같은 두 버전 조합의 분석이 이미 있으면 새로 만들지 않고 그것을 잇는다.
   * 새로 만든 분석에는 이 실행을 생성 출처로 남긴다.
   * 항목의 `result_status` 와 분석의 `created_by_analysis_run_id` 가 같은 사실을 두 자리에 담으므로
   * 둘을 한 transaction 안에서 함께 쓴다.
   */
  private async applyAnalysisResults(
    run: AnalysisRunRow,
    items: AnalysisRunItemRow[],
    request: AnalysisResultsRequest,
    now: string,
    tx: Prisma.TransactionClient,
  ): Promise<AnalysisRunItemRow[]> {
    const byId = new Map(items.map((item) => [item.positionId, item]));
    const reusable = await this.repository.findAnalysesForVersions(
      request.results.map((result) => byId.get(result.positionId)!.positionVersionId),
      run.candidateContextVersion,
      run.contractVersion,
      tx,
    );
    const created: NewAnalysisRow[] = [];
    const updates: AnalysisRunItemUpdate[] = [];
    const analyzedPositionIds: string[] = [];
    const applied = items.map((item) => ({ ...item }));
    const appliedById = new Map(applied.map((item) => [item.positionId, item]));

    // 정책은 새 분석의 보관 기한을 정할 때만 필요하다.
    // 실패만 온 요청에서도 읽으면 정책 미설정 상태의 반영이 409 로 끝나 전환 전과 달라진다.
    // 정책은 새 분석의 보관 기한을 정할 때만 필요하다.
    // 실패만 온 요청에서도 읽으면 정책 미설정 상태의 반영이 409 로 끝나 전환 전과 달라진다.
    const staleAfterDays =
      request.results.length === 0 ? 0 : (await this.requirePolicy(tx)).staleAfterDays;
    for (const result of request.results) {
      const item = byId.get(result.positionId)!;
      const existingId = reusable.get(item.positionVersionId);
      const analysisId = existingId ?? crypto.randomUUID();
      if (!existingId) {
        created.push({
          ...result,
          analysisId,
          positionVersionId: item.positionVersionId,
          candidateContextVersion: run.candidateContextVersion,
          contractVersion: run.contractVersion,
          createdByAnalysisRunId: run.analysisRunId,
          analyzedAt: now,
          validUntil: dateOnlyAfterDays(now, staleAfterDays),
          companyTierAtAnalysis: item.companyTier,
        });
      }
      const resultStatus = existingId ? ("reused" as const) : ("created" as const);
      updates.push({
        analysisRunId: run.analysisRunId,
        positionId: result.positionId,
        resultStatus,
        analysisId,
        failureCode: null,
        completedAt: now,
      });
      analyzedPositionIds.push(result.positionId);
      const target = appliedById.get(result.positionId)!;
      target.resultStatus = resultStatus;
      target.analysisId = analysisId;
      target.failureCode = null;
      target.attemptCount += 1;
    }

    for (const failure of request.failures) {
      updates.push({
        analysisRunId: run.analysisRunId,
        positionId: failure.positionId,
        resultStatus: "failed",
        analysisId: null,
        failureCode: failure.failureCode,
        completedAt: now,
      });
      const target = appliedById.get(failure.positionId)!;
      target.resultStatus = "failed";
      target.analysisId = null;
      target.failureCode = failure.failureCode;
      target.attemptCount += 1;
    }

    await this.repository.insertAnalyses(created, tx);
    await this.repository.updateAnalysisRunItems(updates, tx);
    // 분석이 붙은 공고는 더 기다리지 않는다. 대기 시작 시각을 비워 다음 우선순위에서 뺀다.
    await this.repository.setPendingSince(analyzedPositionIds, null, now, tx);
    return applied;
  }

  private async queueResponse(
    tx: Prisma.TransactionClient,
    run: AnalysisRunRow,
    items: AnalysisRunItemRow[],
    generatedAt: string,
  ): Promise<AnalysisQueueResponse> {
    const positions = await this.repository.listCollectionPositions(run.collectionRunId, tx);
    return analysisQueueResponseSchema.parse({
      schemaVersion: 2,
      collectionRunId: run.collectionRunId,
      analysisRunId: run.analysisRunId,
      generatedAt,
      candidates: items.map((item) => ({
        positionId: item.positionId,
        candidateId: item.candidateId,
        contentHash: item.contentHash,
        analysisStatus: item.analysisStatus,
        companyTier: item.companyTier,
        resultStatus: item.resultStatus,
        posting: item.posting,
      })),
      summary: await this.analysisSummary(
        tx,
        run.collectionRunId,
        positions,
        run.candidateContextVersion,
        run.contractVersion,
        generatedAt,
      ),
    });
  }

  private resultsResponse(
    analysisRunId: string,
    status: "pending" | "partial" | "completed",
    items: AnalysisRunItemRow[],
    applied: boolean,
  ): AnalysisResultsResponse {
    const count = (value: AnalysisRunItemRow["resultStatus"]) =>
      items.filter((item) => item.resultStatus === value).length;
    return analysisResultsResponseSchema.parse({
      analysisRunId,
      status,
      createdCount: count("created"),
      reusedCount: count("reused"),
      failedCount: count("failed"),
      remainingCount: count("pending") + count("failed"),
      applied,
    });
  }


  // ------------------------------------------------------------------ 추천 조립

  /** 사람 override, 유효한 모델 평가, 정책 기본값 순으로 회사 tier 를 정한다. */
  private resolveTier(
    inputs: RecommendationInputs,
    policy: AnalysisPolicy,
    key: string,
  ): ResolvedTier {
    const preference = inputs.preferences.get(key);
    if (preference) return { tier: preference.tier, source: "manual", assessment: undefined };
    const assessment = inputs.validAssessments.get(key);
    if (assessment) {
      return { tier: assessment.recommendedTier, source: "model", assessment };
    }
    return { tier: policy.defaultCompanyTier, source: "default", assessment: undefined };
  }

  /**
   * 추천 응답을 조립하고 그 순위를 저장한다.
   *
   * 유효한 분석이 붙은 공고만 순위에 들어가고 나머지는 분석 대기로 남는다.
   */
  private async buildRecommendation(
    inputs: RecommendationInputs,
    policy: AnalysisPolicy,
    now: string,
    tx: Prisma.TransactionClient,
  ): Promise<RecommendationResponse> {
    const run = inputs.run;
    const entries: RecommendationEntry[] = inputs.positions.map((position) => ({
      position,
      analysis: inputs.freshAnalyses.get(position.positionId),
      ...this.resolveTier(inputs, policy, position.companyKey),
    }));
    const ranked = entries
      .filter(
        (entry): entry is RecommendationEntry & { analysis: RecommendationAnalysisRow } =>
          entry.analysis !== undefined,
      )
      .sort(
        (left, right) =>
          DECISION_ORDER[left.analysis.decision] - DECISION_ORDER[right.analysis.decision] ||
          right.analysis.fitScore - left.analysis.fitScore ||
          left.tier - right.tier ||
          URGENCY_ORDER[left.position.posting.closeUrgency] -
            URGENCY_ORDER[right.position.posting.closeUrgency] ||
          left.position.positionId.localeCompare(right.position.positionId),
      );
    const analyses = groupAnalyses(inputs.analyses);
    const pending = entries
      .filter((entry) => entry.analysis === undefined)
      .sort((left, right) => left.position.positionId.localeCompare(right.position.positionId))
      .map((entry) => ({
        candidateId: entry.position.posting.id,
        company: entry.position.posting.company,
        title: entry.position.posting.title,
        postingUrl: entry.position.posting.url,
        companyTier: entry.tier,
        ...companyTierProvenanceFields(entry.source, entry.assessment),
        analysisStatus: analysisStatusOf(
          entry.position.contentHash,
          analyses.get(entry.position.positionId) ?? [],
          run.candidateContextVersion,
          run.contractVersion,
          now,
        ),
      }));
    const ranking = ranked.map((entry) => ({
      candidateId: entry.position.posting.id,
      company: entry.position.posting.company,
      title: entry.position.posting.title,
      postingUrl: entry.position.posting.url,
      companyTier: entry.tier,
      ...companyTierProvenanceFields(entry.source, entry.assessment),
      decision: entry.analysis.decision,
      fitScore: entry.analysis.fitScore,
      reason: entry.analysis.reason,
      details: entry.analysis.details,
      nextActions: entry.analysis.nextActions,
    }));
    const analyzedNowCount = ranked.filter(
      (entry) => entry.analysis.createdByAnalysisRunId === run.analysisRunId,
    ).length;
    const reusedCount = ranked.length - analyzedNowCount;
    const sourceByCompany = new Map<string, CompanyTierSource>();
    for (const entry of entries) sourceByCompany.set(entry.position.companyKey, entry.source);
    const parsed = recommendationResponseSchema.parse({
      schemaVersion: 1,
      recommendationRunId: stableUuid(`recommendation:${run.analysisRunId}`),
      analysisRunId: run.analysisRunId,
      reportDate: now.slice(0, 10),
      generatedAt: now,
      sourceSnapshot: { collectionRunId: run.collectionRunId },
      ranking,
      recommendations: ranking.filter((entry) => entry.decision !== "hold"),
      pendingCandidates: pending,
      analysisSummary: {
        activeCount: entries.length,
        analyzedNowCount,
        reusedCount,
        pendingCount: pending.length,
        personalExcludedCount: inputs.personalExcludedCount,
      },
      companyTierSummary: tierSourceSummary(
        [...sourceByCompany.values()],
        inputs.assessmentFailedCount,
      ),
      collectionHealth: {
        candidateCount: entries.length,
        configuredSourceCount: inputs.diagnostics.length,
        warningSources: publicDiagnostics(inputs.diagnostics),
      },
    });
    await this.repository.insertRecommendationRun(
      {
        recommendationRunId: parsed.recommendationRunId,
        analysisRunId: run.analysisRunId,
        collectionRunId: run.collectionRunId,
        generatedAt: now,
        analyzedNowCount,
        reusedCount,
        pendingCount: pending.length,
        personalExcludedCount: inputs.personalExcludedCount,
        pendingCandidates: parsed.pendingCandidates,
      },
      ranked.map(
        (entry, index): RecommendationItemRow => ({
          positionId: entry.position.positionId,
          analysisId: entry.analysis.analysisId,
          rankNumber: index + 1,
          decision: entry.analysis.decision,
          companyTier: entry.tier,
          companyTierSource: entry.source,
          companyTierAssessmentId:
            entry.source === "model" ? (entry.assessment?.companyTierAssessmentId ?? null) : null,
        }),
      ),
      tx,
    );
    return parsed;
  }

  /**
   * 저장된 추천을 응답 형태로 다시 만든다.
   *
   * 순위와 집계는 저장한 값을 쓰고, 회사 tier 출처와 수집 진단은 지금 값을 다시 읽는다.
   */
  private async storedRecommendationResponse(
    stored: StoredRecommendation,
    tx: Prisma.TransactionClient,
  ): Promise<RecommendationResponse> {
    const assessments = await this.repository.findAssessmentsByIds(
      stored.items.flatMap((item) =>
        item.companyTierAssessmentId ? [item.companyTierAssessmentId] : [],
      ),
      tx,
    );
    const ranking = stored.items.map((item) => ({
      candidateId: item.candidateId,
      company: item.company,
      title: item.title,
      postingUrl: item.postingUrl,
      companyTier: item.companyTier,
      ...companyTierProvenanceFields(
        item.companyTierSource,
        item.companyTierAssessmentId
          ? assessments.get(item.companyTierAssessmentId)
          : undefined,
      ),
      decision: item.decision,
      fitScore: item.fitScore,
      reason: item.reason,
      details: item.details,
      nextActions: item.nextActions,
    }));
    const pendingCandidates = stored.pendingCandidates as Array<{
      company: string;
      companyTierSource?: CompanyTierSource;
    }>;
    // 만드는 경로가 `positions.company_key` 로 모으므로 여기서도 같은 정규화를 쓴다.
    // 표시 이름으로 모으면 대소문자와 공백만 다른 두 표기가 따로 세어져
    // 같은 추천 실행인데 만들 때와 다시 읽을 때의 집계가 달라진다.
    const sourceByCompany = new Map<string, CompanyTierSource>();
    for (const entry of [...ranking, ...pendingCandidates]) {
      sourceByCompany.set(companyKey(entry.company), entry.companyTierSource ?? "default");
    }
    const diagnostics = await this.repository.listCollectionDiagnostics(
      stored.collectionRunId,
      tx,
    );
    const tierRun = await this.repository.findCompanyTierRunByCollectionRun(
      stored.collectionRunId,
      tx,
    );
    return recommendationResponseSchema.parse({
      schemaVersion: 1,
      recommendationRunId: stored.recommendationRunId,
      analysisRunId: stored.analysisRunId,
      reportDate: stored.generatedAt.slice(0, 10),
      generatedAt: stored.generatedAt,
      sourceSnapshot: { collectionRunId: stored.collectionRunId },
      ranking,
      recommendations: ranking.filter((entry) => entry.decision !== "hold"),
      pendingCandidates,
      analysisSummary: {
        activeCount: stored.activeCount,
        analyzedNowCount: stored.analyzedNowCount,
        reusedCount: stored.reusedCount,
        pendingCount: stored.pendingCount,
        personalExcludedCount: stored.personalExcludedCount,
      },
      companyTierSummary: tierSourceSummary(
        [...sourceByCompany.values()],
        tierRun
          ? await this.repository.countFailedCompanyTierItems(tierRun.companyTierRunId, tx)
          : 0,
      ),
      collectionHealth: {
        candidateCount: stored.activeCount,
        configuredSourceCount: diagnostics.length,
        warningSources: publicDiagnostics(diagnostics),
      },
    });
  }

  // ------------------------------------------------------------------ 응답 조립

  /**
   * 수집 응답을 조립한다.
   *
   * 분석 계약 버전은 언제나 `DEFAULT_ANALYSIS_CONTRACT_VERSION` 이다.
   * `position_collection_runs` 에 요청이 보낸 값을 담는 열이 없어 되읽을 수 없고,
   * 첫 호출과 재호출이 다른 값을 쓰면 같은 본문이 다른 응답을 낸다. ADR-122 가 그렇게 정했다.
   */
  private async preparationResponse(
    tx: Prisma.TransactionClient,
    policy: AnalysisPolicy,
    run: CompanyTierRunRow,
    generatedAt: string,
  ): Promise<PositionPreparationResponse> {
    const positions = await this.repository.listCollectionPositions(run.collectionRunId, tx);
    return positionPreparationResponseSchema.parse({
      schemaVersion: 2,
      collectionRunId: run.collectionRunId,
      generatedAt,
      companyTierQueue: await this.companyTierQueueResponse(tx, run, positions, generatedAt),
      summary: await this.analysisSummary(
        tx,
        run.collectionRunId,
        positions,
        policy.candidateContextVersion,
        DEFAULT_ANALYSIS_CONTRACT_VERSION,
        generatedAt,
      ),
    });
  }

  /**
   * 대기열 집계를 만든다.
   *
   * 후보 문맥 버전을 인자로 받는다. 실행이 이미 있으면 그 실행 행의 값을 써야 한다.
   * 지금 정책의 값을 쓰면 정책을 바꾼 뒤 같은 실행을 조회할 때 모든 후보가
   * 유효하지 않은 것으로 집계된다.
   */
  private async analysisSummary(
    tx: Prisma.TransactionClient,
    collectionRunId: string,
    positions: CollectionPositionRow[],
    candidateContextVersion: string,
    analysisContractVersion: number,
    generatedAt: string,
  ) {
    const collection = await this.repository.findCollectionRun(collectionRunId, tx);
    const diagnostics = await this.repository.listCollectionDiagnostics(collectionRunId, tx);
    const analyses = groupAnalyses(
      await this.repository.listAnalysesForCollection(collectionRunId, tx),
    );
    const statuses = positions.map((position) =>
      analysisStatusOf(
        position.contentHash,
        analyses.get(position.positionId) ?? [],
        candidateContextVersion,
        analysisContractVersion,
        generatedAt,
      ),
    );
    const analysisRun = await this.repository.findAnalysisRunByCollection(collectionRunId, tx);
    const items = analysisRun?.resultStatuses ?? [];
    return {
      activeCount: positions.length,
      reusedCount: statuses.filter((status) => status === "fresh").length,
      queuedCount: items.length,
      pendingCount: statuses.filter((status) => status !== "fresh").length,
      personalExcludedCount: collection?.personalExcludedCount ?? 0,
      newCount: statuses.filter((status) => status === "new").length,
      changedCount: statuses.filter((status) => status === "changed").length,
      staleCount: statuses.filter((status) => status === "stale").length,
      completedCount: items.filter((status) => status === "created" || status === "reused").length,
      failedCount: items.filter((status) => status === "failed").length,
      warningSourceCount: publicDiagnostics(diagnostics).length,
    };
  }

  private async companyTierQueueResponse(
    tx: Prisma.TransactionClient,
    run: CompanyTierRunRow,
    positions: CollectionPositionRow[],
    generatedAt: string,
  ): Promise<CompanyTierQueueResponse> {
    const items = await this.repository.listCompanyTierRunItems(run.companyTierRunId, tx);
    const companyKeys = [...new Set(positions.map((position) => position.companyKey))];
    const preferences = await this.repository.findPreferencesFor(companyKeys, tx);
    const valid = await this.repository.findValidAssessments(
      companyKeys,
      run.candidateContextVersion,
      run.contractVersion,
      generatedAt.slice(0, 10),
      tx,
    );
    const latest = await this.repository.findLatestAssessments(
      items.map((item) => item.companyKey),
      run.candidateContextVersion,
      run.contractVersion,
      tx,
    );
    const urlsByCompany = new Map<string, string[]>();
    for (const position of positions) {
      const urls = urlsByCompany.get(position.companyKey) ?? [];
      if (urls.length < 3) urls.push(position.postingUrl);
      urlsByCompany.set(position.companyKey, urls);
    }
    const manualCount = companyKeys.filter((key) => preferences.has(key)).length;
    const modelCount = companyKeys.filter(
      (key) => !preferences.has(key) && valid.has(key),
    ).length;
    return companyTierQueueResponseSchema.parse({
      schemaVersion: 1,
      collectionRunId: run.collectionRunId,
      companyTierRunId: run.companyTierRunId,
      generatedAt,
      status: run.status,
      companies: items.map((item) => ({
        companyKey: item.companyKey,
        companyName: item.companyName,
        assessmentStatus: item.assessmentStatus,
        activePositionCount: item.activePositionCount,
        representativePostingUrls: urlsByCompany.get(item.companyKey) ?? [],
        priorTier: item.priorTier,
        priorReason: item.priorTier === null ? null : (latest.get(item.companyKey)?.reason ?? null),
        priorValidUntil:
          item.priorTier === null ? null : (latest.get(item.companyKey)?.validUntil ?? null),
      })),
      summary: {
        activeCompanyCount: companyKeys.length,
        manualCount,
        modelCount,
        defaultCount: companyKeys.length - manualCount - modelCount,
        queuedCount: items.length,
        newCount: items.filter((item) => item.assessmentStatus === "new").length,
        staleCount: items.filter((item) => item.assessmentStatus === "stale").length,
        completedCount: items.filter(
          (item) => item.resultStatus === "created" || item.resultStatus === "reused",
        ).length,
        failedCount: items.filter((item) => item.resultStatus === "failed").length,
        pendingCount: items.filter((item) => item.resultStatus === "pending").length,
      },
    });
  }

  private companyTierResultsResponse(
    companyTierRunId: string,
    status: "pending" | "partial" | "completed",
    items: CompanyTierRunItemRow[],
    applied: boolean,
  ): CompanyTierResultsResponse {
    const count = (value: CompanyTierRunItemRow["resultStatus"]) =>
      items.filter((item) => item.resultStatus === value).length;
    return companyTierResultsResponseSchema.parse({
      companyTierRunId,
      status,
      createdCount: count("created"),
      reusedCount: count("reused"),
      failedCount: count("failed"),
      remainingCount: count("pending") + count("failed"),
      applied,
    });
  }
}
