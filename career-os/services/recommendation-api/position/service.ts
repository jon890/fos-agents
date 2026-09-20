import { ApiError } from "../http/errors.ts";
import { companyKey, positionContentHash, positionIdentity, stableUuid } from "./hash.ts";
import type {
  CompanyTierSource,
  MemoryPositionRepository,
  PositionRepositoryState,
  StoredAnalysis,
  StoredAnalysisRun,
  StoredAnalysisRunItem,
  StoredPosition,
} from "./memory-repository.ts";
import { selectAnalysisQueue, type PendingPosition } from "./queue.ts";
import {
  analysisPolicySchema,
  analysisQueueResponseSchema,
  analysisResultsRequestSchema,
  analysisResultsResponseSchema,
  collectionRequestSchema,
  companyPreferenceSchema,
  companyPreferenceUpdateSchema,
  type AnalysisQueueResponse,
  type AnalysisResultsResponse,
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

function tierFor(
  state: PositionRepositoryState,
  position: StoredPosition,
): { tier: number; source: CompanyTierSource } {
  const preference = state.preferences.get(companyKey(position.posting.company));
  return preference
    ? { tier: preference.tier, source: "manual" }
    : { tier: state.policy!.defaultCompanyTier, source: "default" };
}

function isExcluded(state: PositionRepositoryState, company: string): boolean {
  return state.preferences.get(companyKey(company))?.disposition === "exclude";
}

function positionById(state: PositionRepositoryState, positionId: string): StoredPosition {
  return [...state.positions.values()].find((entry) => entry.positionId === positionId)!;
}

function currentVersionId(state: PositionRepositoryState, positionId: string): string {
  const position = positionById(state, positionId);
  return position.versions.find((entry) => entry.contentHash === position.contentHash)!
    .positionVersionId;
}

function sortedItems(run: StoredAnalysisRun): StoredAnalysisRunItem[] {
  return [...run.items.values()].sort((left, right) => left.selectionOrder - right.selectionOrder);
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
        const resolvedTier = tierFor(state, position);
        pending.push({
          positionId: position.positionId,
          candidateId: position.candidateId,
          contentHash: position.contentHash,
          status,
          companyTier: resolvedTier.tier,
          companyTierSource: resolvedTier.source,
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
        status: selected.length === 0 ? "completed" : "pending",
        items: new Map(
          selected.map((candidate, index) => [
            candidate.positionId,
            {
              positionId: candidate.positionId,
              positionVersionId: currentVersionId(state, candidate.positionId),
              selectionOrder: index + 1,
              analysisStatus: candidate.status,
              selectionReason: candidate.selectionReason,
              companyTier: candidate.companyTier,
              companyTierSource: candidate.companyTierSource,
              companyTierAssessmentId: null,
              resultStatus: "pending" as const,
              analysisId: null,
              failureCode: null,
              attemptCount: 0,
              completedAt: null,
            },
          ]),
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
    const items = sortedItems(run);
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
      schemaVersion: 2,
      collectionRunId: run.collectionRunId,
      analysisRunId: run.analysisRunId,
      generatedAt,
      candidates: items.map((item) => {
        const position = positionById(state, item.positionId);
        return {
          positionId: position.positionId,
          candidateId: position.candidateId,
          contentHash: position.contentHash,
          analysisStatus: item.analysisStatus,
          companyTier: tierFor(state, position).tier,
          resultStatus: item.resultStatus,
          posting: position.posting,
        };
      }),
      summary: {
        activeCount: active.length,
        reusedCount: statuses.filter((status) => status === "fresh").length,
        queuedCount: items.length,
        pendingCount: statuses.filter((status) => status !== "fresh").length,
        personalExcludedCount,
        newCount: statuses.filter((status) => status === "new").length,
        changedCount: statuses.filter((status) => status === "changed").length,
        staleCount: statuses.filter((status) => status === "stale").length,
        completedCount: items.filter(
          (item) => item.resultStatus === "created" || item.resultStatus === "reused",
        ).length,
        failedCount: items.filter((item) => item.resultStatus === "failed").length,
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
      if (run.status === "completed") return this.resultsResponse(run, false);
      const openIds = sortedItems(run)
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
      for (const result of request.results) {
        const item = run.items.get(result.positionId)!;
        const position = positionById(state, result.positionId);
        const duplicate = position.analyses.find(
          (analysis) =>
            analysis.contentHash === position.contentHash &&
            analysis.candidateContextVersion === run.candidateContextVersion &&
            analysis.analysisContractVersion === run.analysisContractVersion,
        );
        const analysis =
          duplicate ??
          ({
            ...structuredClone(result),
            analysisId: crypto.randomUUID(),
            contentHash: position.contentHash,
            candidateContextVersion: run.candidateContextVersion,
            analysisContractVersion: run.analysisContractVersion,
            createdByAnalysisRunId: run.analysisRunId,
            analyzedAt: now,
            validUntil: dateOnlyAfterDays(now, requirePolicy(state).staleAfterDays),
            companyTierAtAnalysis: tierFor(state, position).tier,
          } satisfies StoredAnalysis);
        if (!duplicate) position.analyses.push(analysis);
        position.pendingSince = null;
        item.resultStatus = duplicate ? "reused" : "created";
        item.analysisId = analysis.analysisId;
        item.failureCode = null;
        item.completedAt = now;
        item.attemptCount += 1;
      }
      for (const failure of request.failures) {
        const item = run.items.get(failure.positionId)!;
        item.resultStatus = "failed";
        item.analysisId = null;
        item.failureCode = failure.failureCode;
        item.completedAt = now;
        item.attemptCount += 1;
      }
      run.analyzedNowCount = sortedItems(run).filter(
        (item) => item.resultStatus === "created",
      ).length;
      run.status = sortedItems(run).some((item) => item.resultStatus === "failed")
        ? "partial"
        : "completed";
      run.completedAt = now;
      return this.resultsResponse(run, true);
    });
  }

  private resultsResponse(run: StoredAnalysisRun, applied: boolean): AnalysisResultsResponse {
    const items = sortedItems(run);
    const count = (status: StoredAnalysisRunItem["resultStatus"]) =>
      items.filter((item) => item.resultStatus === status).length;
    return analysisResultsResponseSchema.parse({
      analysisRunId: run.analysisRunId,
      status: run.status,
      createdCount: count("created"),
      reusedCount: count("reused"),
      failedCount: count("failed"),
      remainingCount: count("pending") + count("failed"),
      applied,
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
      if (run.status === "pending")
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
          ...tierFor(state, position),
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
          companyTier: tierFor(state, position).tier,
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
      const analyzedNowCount = ranked.filter(
        ({ analysis }) => analysis.createdByAnalysisRunId === run.analysisRunId,
      ).length;
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
          analyzedNowCount,
          reusedCount: ranked.length - analyzedNowCount,
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
      state.recommendationTierSources.set(
        analysisRunId,
        new Map(
          ranked.map(({ position, source }) => [
            position.candidateId,
            { source, assessmentId: null },
          ]),
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
