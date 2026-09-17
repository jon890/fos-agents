import { ApiError } from "../http/errors.ts";
import { companyKey, positionContentHash, positionIdentity, stableUuid } from "./hash.ts";
import type {
  MemoryPositionRepository,
  PositionRepositoryState,
  StoredAnalysis,
  StoredAnalysisRun,
  StoredPosition,
} from "./memory-repository.ts";
import { selectAnalysisQueue, type PendingPosition } from "./queue.ts";
import {
  analysisPolicySchema,
  analysisQueueResponseSchema,
  analysisResultsRequestSchema,
  collectionRequestSchema,
  companyPreferenceSchema,
  companyPreferenceUpdateSchema,
  type AnalysisQueueResponse,
  type CompanyPreference,
  type RecommendationResponse,
  recommendationResponseSchema,
} from "./schema.ts";

const decisionOrder = { recommend: 0, consider: 1, hold: 2 } as const;
const urgencyOrder = { urgent: 0, soon: 1, normal: 2, no_deadline: 3, unknown: 4 } as const;

function dateOnlyAfterDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function latestAnalysis(position: StoredPosition): StoredAnalysis | undefined {
  return position.analyses
    .slice()
    .sort((left, right) => right.analyzedAt.localeCompare(left.analyzedAt))[0];
}

function freshAnalysis(
  position: StoredPosition,
  contextVersion: string,
  contractVersion: number,
  now: string,
): StoredAnalysis | undefined {
  const today = now.slice(0, 10);
  return position.analyses
    .filter(
      (analysis) =>
        analysis.contentHash === position.contentHash &&
        analysis.candidateContextVersion === contextVersion &&
        analysis.analysisContractVersion === contractVersion &&
        analysis.validUntil >= today,
    )
    .sort((left, right) => right.analyzedAt.localeCompare(left.analyzedAt))[0];
}

function analysisStatus(
  position: StoredPosition,
  contextVersion: string,
  contractVersion: number,
  now: string,
): "fresh" | "new" | "changed" | "stale" {
  if (freshAnalysis(position, contextVersion, contractVersion, now)) return "fresh";
  if (position.analyses.length === 0) return "new";
  if (!position.analyses.some((analysis) => analysis.contentHash === position.contentHash)) {
    return "changed";
  }
  return "stale";
}

function tierFor(state: PositionRepositoryState, position: StoredPosition): number {
  return (
    state.preferences.get(companyKey(position.posting.company))?.tier ??
    state.policy!.defaultCompanyTier
  );
}

function isExcluded(state: PositionRepositoryState, company: string): boolean {
  return state.preferences.get(companyKey(company))?.disposition === "exclude";
}

function requirePolicy(state: PositionRepositoryState) {
  const parsed = analysisPolicySchema.safeParse(state.policy);
  if (!parsed.success) {
    throw new ApiError(409, "POLICY_NOT_CONFIGURED", "포지션 분석 정책이 준비되지 않았습니다.");
  }
  return parsed.data;
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

export class PositionService {
  constructor(private readonly repository: MemoryPositionRepository) {}

  async configurePolicy(value: unknown) {
    await this.repository.ensureReady();
    const policy = analysisPolicySchema.parse(value);
    await this.repository.setPolicy(policy);
    return policy;
  }

  async listCompanyPreferences(): Promise<CompanyPreference[]> {
    await this.repository.ensureReady();
    return [...this.repository.snapshot().preferences.values()].sort((left, right) =>
      left.companyKey.localeCompare(right.companyKey),
    );
  }

  async updateCompanyPreference(
    companyKeyParam: string,
    value: unknown,
  ): Promise<CompanyPreference> {
    await this.repository.ensureReady();
    const parsed = companyPreferenceUpdateSchema.parse(value);
    if (parsed.companyKey !== companyKeyParam) {
      throw new ApiError(409, "VERSION_CONFLICT", "회사 식별자가 요청 경로와 다릅니다.");
    }
    const preference = companyPreferenceSchema.parse({
      ...parsed,
      updatedAt: new Date().toISOString(),
    });
    await this.repository.putPreference(preference);
    return preference;
  }

  async saveCollection(
    value: unknown,
    now = new Date().toISOString(),
  ): Promise<AnalysisQueueResponse> {
    await this.repository.ensureReady();
    const request = collectionRequestSchema.parse(value);
    return this.repository.transaction((state) => {
      const policy = requirePolicy(state);
      const existingRun = [...state.analysisRuns.values()].find(
        (run) => run.collectionRunId === request.pool.collectionRunId,
      );
      if (existingRun)
        return this.queueResponse(
          state,
          existingRun,
          request.pool.filterSummary.personalExcludedCount,
          now,
        );

      const activeCandidateIds: string[] = [];
      const seenBySource = new Map<string, Set<string>>();
      for (const posting of request.pool.candidates) {
        if (isExcluded(state, posting.company)) continue;
        const identity = positionIdentity(posting);
        const contentHash = positionContentHash(posting);
        const existing = state.positions.get(identity);
        const position: StoredPosition = existing ?? {
          positionId: crypto.randomUUID(),
          candidateId: posting.id,
          source: posting.source,
          identity,
          contentHash,
          posting,
          versions: [
            {
              positionVersionId: crypto.randomUUID(),
              contentHash,
              posting: structuredClone(posting),
              observedAt: request.pool.collectedAt,
            },
          ],
          firstSeenAt: request.pool.collectedAt,
          lastSeenAt: request.pool.collectedAt,
          pendingSince: request.pool.collectedAt,
          lifecycle: "active",
          analyses: [],
        };
        position.candidateId = posting.id;
        if (!position.versions.some((version) => version.contentHash === contentHash)) {
          position.versions.push({
            positionVersionId: crypto.randomUUID(),
            contentHash,
            posting: structuredClone(posting),
            observedAt: request.pool.collectedAt,
          });
        }
        position.contentHash = contentHash;
        position.posting = structuredClone(posting);
        position.lastSeenAt = request.pool.collectedAt;
        position.lifecycle = "active";
        state.positions.set(identity, position);
        activeCandidateIds.push(identity);
        const sourceSeen = seenBySource.get(posting.source) ?? new Set<string>();
        sourceSeen.add(identity);
        seenBySource.set(posting.source, sourceSeen);
      }

      const diagnosticBySource = new Map(
        request.pool.sourceDiagnostics.map((item) => [item.source, item]),
      );
      for (const [identity, position] of state.positions) {
        if (position.lifecycle !== "active" || activeCandidateIds.includes(identity)) continue;
        if (diagnosticBySource.get(position.source)?.status === "ok")
          position.lifecycle = "not_seen";
      }

      state.collections.set(request.pool.collectionRunId, {
        collectionRunId: request.pool.collectionRunId,
        collectedAt: request.pool.collectedAt,
        candidateIds: activeCandidateIds,
        diagnostics: structuredClone(request.pool.sourceDiagnostics),
        personalExcludedCount: request.pool.filterSummary.personalExcludedCount,
      });

      const pending: PendingPosition[] = [];
      for (const identity of activeCandidateIds) {
        const position = state.positions.get(identity)!;
        const status = analysisStatus(
          position,
          policy.candidateContextVersion,
          request.analysisContractVersion,
          now,
        );
        if (status === "fresh") {
          position.pendingSince = null;
          continue;
        }
        position.pendingSince ??= request.pool.collectedAt;
        pending.push({
          positionId: position.positionId,
          candidateId: position.candidateId,
          contentHash: position.contentHash,
          status,
          companyTier: tierFor(state, position),
          pendingSince: position.pendingSince,
          posting: structuredClone(position.posting),
        });
      }
      const selected = selectAnalysisQueue(pending, policy);
      const analysisRun: StoredAnalysisRun = {
        analysisRunId: stableUuid(`analysis:${request.pool.collectionRunId}`),
        collectionRunId: request.pool.collectionRunId,
        candidateContextVersion: policy.candidateContextVersion,
        analysisContractVersion: request.analysisContractVersion,
        createdAt: now,
        completedAt: selected.length === 0 ? now : null,
        selectedPositionIds: selected.map((candidate) => candidate.positionId),
        statusByPosition: new Map(
          selected.map((candidate) => [candidate.positionId, candidate.status]),
        ),
        selectionReasonByPosition: new Map(
          selected.map((candidate) => [candidate.positionId, candidate.selectionReason]),
        ),
        companyTierByPosition: new Map(
          selected.map((candidate) => [candidate.positionId, candidate.companyTier]),
        ),
        analyzedNowCount: 0,
      };
      state.analysisRuns.set(analysisRun.analysisRunId, analysisRun);
      return this.queueResponse(
        state,
        analysisRun,
        request.pool.filterSummary.personalExcludedCount,
        now,
      );
    });
  }

  private queueResponse(
    state: PositionRepositoryState,
    run: StoredAnalysisRun,
    personalExcludedCount: number,
    generatedAt: string,
  ): AnalysisQueueResponse {
    const collection = state.collections.get(run.collectionRunId)!;
    const positions = [...state.positions.values()];
    const selected = run.selectedPositionIds.map((positionId) =>
      positions.find((entry) => entry.positionId === positionId)!,
    );
    const active = collection.candidateIds
      .map((identity) => state.positions.get(identity)!)
      .filter(Boolean);
    const statuses = active.map((position) =>
      analysisStatus(
        position,
        run.candidateContextVersion,
        run.analysisContractVersion,
        generatedAt,
      ),
    );
    return analysisQueueResponseSchema.parse({
      schemaVersion: 1,
      collectionRunId: run.collectionRunId,
      analysisRunId: run.analysisRunId,
      generatedAt,
      candidates: selected.map((position) => ({
        positionId: position.positionId,
        candidateId: position.candidateId,
        contentHash: position.contentHash,
        analysisStatus: run.statusByPosition.get(position.positionId),
        companyTier: tierFor(state, position),
        posting: position.posting,
      })),
      summary: {
        activeCount: active.length,
        reusedCount: statuses.filter((status) => status === "fresh").length,
        queuedCount: selected.length,
        pendingCount: statuses.filter((status) => status !== "fresh").length,
        personalExcludedCount,
        newCount: statuses.filter((status) => status === "new").length,
        changedCount: statuses.filter((status) => status === "changed").length,
        staleCount: statuses.filter((status) => status === "stale").length,
        warningSourceCount: publicDiagnostics(collection.diagnostics).length,
      },
    });
  }

  async saveAnalysisResults(analysisRunId: string, value: unknown, now = new Date().toISOString()) {
    await this.repository.ensureReady();
    const request = analysisResultsRequestSchema.parse(value);
    return this.repository.transaction((state) => {
      const run = state.analysisRuns.get(analysisRunId);
      if (!run || run.collectionRunId !== request.collectionRunId) {
        throw new ApiError(409, "VERSION_CONFLICT", "분석 실행과 수집 실행이 일치하지 않습니다.");
      }
      if (run.completedAt)
        return { analysisRunId, analyzedNowCount: run.analyzedNowCount, reused: true };
      const resultIds = request.results.map((result) => result.positionId);
      if (
        new Set(resultIds).size !== resultIds.length ||
        resultIds.length !== run.selectedPositionIds.length ||
        run.selectedPositionIds.some((positionId) => !resultIds.includes(positionId))
      ) {
        throw new ApiError(409, "VERSION_CONFLICT", "선택된 모든 공고 분석이 한 번씩 필요합니다.");
      }
      for (const result of request.results) {
        const position = [...state.positions.values()].find(
          (entry) => entry.positionId === result.positionId,
        )!;
        const duplicate = position.analyses.find(
          (analysis) =>
            analysis.contentHash === position.contentHash &&
            analysis.candidateContextVersion === run.candidateContextVersion &&
            analysis.analysisContractVersion === run.analysisContractVersion,
        );
        if (duplicate) continue;
        position.analyses.push({
          ...structuredClone(result),
          analysisId: crypto.randomUUID(),
          contentHash: position.contentHash,
          candidateContextVersion: run.candidateContextVersion,
          analysisContractVersion: run.analysisContractVersion,
          analyzedAt: now,
          validUntil: dateOnlyAfterDays(now, requirePolicy(state).staleAfterDays),
          companyTierAtAnalysis: tierFor(state, position),
        });
        position.pendingSince = null;
        run.analyzedNowCount += 1;
      }
      run.completedAt = now;
      return { analysisRunId, analyzedNowCount: run.analyzedNowCount, reused: false };
    });
  }

  async createRecommendation(
    analysisRunId: string,
    now = new Date().toISOString(),
  ): Promise<RecommendationResponse> {
    await this.repository.ensureReady();
    return this.repository.transaction((state) => {
      const cached = state.recommendationResponses.get(analysisRunId);
      if (cached) return recommendationResponseSchema.parse(structuredClone(cached));
      const run = state.analysisRuns.get(analysisRunId);
      if (!run) throw new ApiError(404, "NOT_FOUND", "분석 실행을 찾을 수 없습니다.");
      if (!run.completedAt)
        throw new ApiError(409, "VERSION_CONFLICT", "분석 실행이 끝나지 않았습니다.");
      const collection = state.collections.get(run.collectionRunId)!;
      const active = collection.candidateIds
        .map((identity) => state.positions.get(identity)!)
        .filter(Boolean);
      const ranked = active
        .map((position) => ({
          position,
          analysis: freshAnalysis(
            position,
            run.candidateContextVersion,
            run.analysisContractVersion,
            now,
          ),
          tier: tierFor(state, position),
        }))
        .filter((entry): entry is typeof entry & { analysis: StoredAnalysis } =>
          Boolean(entry.analysis),
        )
        .sort(
          (left, right) =>
            decisionOrder[left.analysis.decision] - decisionOrder[right.analysis.decision] ||
            right.analysis.fitScore - left.analysis.fitScore ||
            left.tier - right.tier ||
            urgencyOrder[left.position.posting.closeUrgency] -
              urgencyOrder[right.position.posting.closeUrgency] ||
            left.position.positionId.localeCompare(right.position.positionId),
        );
      const pending = active
        .filter(
          (position) =>
            !freshAnalysis(position, run.candidateContextVersion, run.analysisContractVersion, now),
        )
        .sort((left, right) => left.positionId.localeCompare(right.positionId))
        .map((position) => ({
          candidateId: position.candidateId,
          company: position.posting.company,
          title: position.posting.title,
          postingUrl: position.posting.url,
          companyTier: tierFor(state, position),
          analysisStatus: analysisStatus(
            position,
            run.candidateContextVersion,
            run.analysisContractVersion,
            now,
          ),
        }));
      const ranking = ranked.map(({ position, analysis, tier }) => ({
        candidateId: position.candidateId,
        company: position.posting.company,
        title: position.posting.title,
        postingUrl: position.posting.url,
        companyTier: tier,
        decision: analysis.decision,
        fitScore: analysis.fitScore,
        reason: analysis.reason,
        details: analysis.details,
        nextActions: analysis.nextActions,
      }));
      const response = {
        schemaVersion: 1,
        recommendationRunId: stableUuid(`recommendation:${analysisRunId}`),
        analysisRunId,
        reportDate: now.slice(0, 10),
        generatedAt: now,
        sourceSnapshot: { collectionRunId: run.collectionRunId },
        ranking,
        recommendations: ranking.filter((entry) => entry.decision !== "hold"),
        pendingCandidates: pending,
        analysisSummary: {
          activeCount: active.length,
          analyzedNowCount: run.analyzedNowCount,
          reusedCount: ranked.length - run.analyzedNowCount,
          pendingCount: pending.length,
          personalExcludedCount: collection.personalExcludedCount,
        },
        collectionHealth: {
          candidateCount: active.length,
          configuredSourceCount: collection.diagnostics.length,
          warningSources: publicDiagnostics(collection.diagnostics),
        },
      };
      const parsed = recommendationResponseSchema.parse(response);
      state.recommendationResponses.set(analysisRunId, structuredClone(parsed));
      state.recommendationAnalysisIds.set(
        analysisRunId,
        new Map(
          ranked.map(({ position, analysis }) => [position.candidateId, analysis.analysisId]),
        ),
      );
      return parsed;
    });
  }

  async getRun(id: string) {
    await this.repository.ensureReady();
    const state = this.repository.snapshot();
    const analysisRun =
      state.analysisRuns.get(id) ??
      [...state.analysisRuns.values()].find((entry) => entry.collectionRunId === id);
    if (analysisRun) {
      const collection = state.collections.get(analysisRun.collectionRunId)!;
      return this.queueResponse(
        state,
        analysisRun,
        collection.personalExcludedCount,
        analysisRun.createdAt,
      );
    }
    const recommendation = [...state.recommendationResponses.values()]
      .map((entry) => recommendationResponseSchema.safeParse(entry))
      .find((entry) => entry.success && entry.data.recommendationRunId === id);
    if (recommendation?.success) return recommendation.data;
    const recommendationRun = [...state.analysisRuns.values()].find(
      (entry) => stableUuid(`recommendation:${entry.analysisRunId}`) === id,
    );
    if (recommendationRun) return this.createRecommendation(recommendationRun.analysisRunId);
    throw new ApiError(404, "NOT_FOUND", "실행을 찾을 수 없습니다.");
  }
}
