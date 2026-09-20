import { ApiError } from "../http/errors.ts";
import { companyKey, positionContentHash, positionIdentity, stableUuid } from "./hash.ts";
import type {
  CompanyTierSource,
  MemoryPositionRepository,
  PositionRepositoryState,
  StoredAnalysis,
  StoredAnalysisRun,
  StoredAnalysisRunItem,
  StoredCollection,
  StoredCompanyTierAssessment,
  StoredCompanyTierRun,
  StoredCompanyTierRunItem,
  StoredPosition,
} from "./memory-repository.ts";
import {
  selectAnalysisQueue,
  selectCompanyTierQueue,
  type PendingCompany,
  type PendingPosition,
} from "./queue.ts";
import {
  analysisPolicySchema,
  analysisQueueResponseSchema,
  analysisResultsRequestSchema,
  analysisResultsResponseSchema,
  collectionRequestSchema,
  companyPreferenceSchema,
  companyPreferenceUpdateSchema,
  companyTierQueueResponseSchema,
  companyTierResultsRequestSchema,
  companyTierResultsResponseSchema,
  positionPreparationResponseSchema,
  type AnalysisPolicy,
  type AnalysisQueueResponse,
  type AnalysisResultsResponse,
  type CompanyPreference,
  type CompanyTierQueueResponse,
  type CompanyTierResultsResponse,
  type PositionPreparationResponse,
  type RecommendationResponse,
  recommendationResponseSchema,
} from "./schema.ts";
import {
  companyTierProvenanceFields,
  type CompanyTierProvenanceFields,
} from "./tier-provenance.ts";

const decisionOrder = { recommend: 0, consider: 1, hold: 2 } as const;
const urgencyOrder = { urgent: 0, soon: 1, normal: 2, no_deadline: 3, unknown: 4 } as const;
const companyTierLeaseMs = 2 * 60 * 60 * 1000;

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

function assessmentsFor(
  state: PositionRepositoryState,
  key: string,
  contextVersion: string,
  contractVersion: number,
): StoredCompanyTierAssessment[] {
  return [...state.companyTierAssessments.values()]
    .filter(
      (assessment) =>
        assessment.companyKey === key &&
        assessment.candidateContextVersion === contextVersion &&
        assessment.contractVersion === contractVersion,
    )
    .sort((left, right) => right.assessedAt.localeCompare(left.assessedAt));
}

function validAssessment(
  state: PositionRepositoryState,
  key: string,
  contextVersion: string,
  contractVersion: number,
  now: string,
): StoredCompanyTierAssessment | undefined {
  const today = now.slice(0, 10);
  return assessmentsFor(state, key, contextVersion, contractVersion).find(
    (assessment) => assessment.validUntil >= today,
  );
}

type ResolvedTier = { tier: number; source: CompanyTierSource; assessmentId: string | null };

function tierFor(
  state: PositionRepositoryState,
  position: StoredPosition,
  contextVersion: string,
  contractVersion: number,
  now: string,
): ResolvedTier {
  const key = companyKey(position.posting.company);
  const preference = state.preferences.get(key);
  if (preference) return { tier: preference.tier, source: "manual", assessmentId: null };
  const assessment = validAssessment(state, key, contextVersion, contractVersion, now);
  if (assessment) {
    return {
      tier: assessment.recommendedTier,
      source: "model",
      assessmentId: assessment.companyTierAssessmentId,
    };
  }
  return { tier: state.policy!.defaultCompanyTier, source: "default", assessmentId: null };
}

function tierProvenance(
  state: PositionRepositoryState,
  resolved: ResolvedTier,
): CompanyTierProvenanceFields {
  return companyTierProvenanceFields(
    resolved.source,
    resolved.assessmentId
      ? state.companyTierAssessments.get(resolved.assessmentId)
      : undefined,
  );
}

function companyTierRunFor(
  state: PositionRepositoryState,
  collectionRunId: string,
): StoredCompanyTierRun | undefined {
  return [...state.companyTierRuns.values()].find((run) => run.collectionRunId === collectionRunId);
}

function sortedTierItems(run: StoredCompanyTierRun): StoredCompanyTierRunItem[] {
  return [...run.items.values()].sort((left, right) => left.selectionOrder - right.selectionOrder);
}

function companyTierRecommendationSummary(
  state: PositionRepositoryState,
  positions: StoredPosition[],
  resolveTier: (position: StoredPosition) => ResolvedTier,
  collectionRunId: string,
) {
  const sourceByCompany = new Map<string, CompanyTierSource>();
  for (const position of positions) {
    sourceByCompany.set(companyKey(position.posting.company), resolveTier(position).source);
  }
  const sources = [...sourceByCompany.values()];
  const tierRun = companyTierRunFor(state, collectionRunId);
  return {
    manualCount: sources.filter((source) => source === "manual").length,
    modelCount: sources.filter((source) => source === "model").length,
    defaultCount: sources.filter((source) => source === "default").length,
    assessmentFailedCount: tierRun
      ? sortedTierItems(tierRun).filter((item) => item.resultStatus === "failed").length
      : 0,
  };
}

function reclaimExpiredCompanyTierLeases(state: PositionRepositoryState, now: string): void {
  for (const run of state.companyTierRuns.values()) {
    if (run.status !== "pending") continue;
    if (Date.parse(now) - Date.parse(run.createdAt) < companyTierLeaseMs) continue;
    for (const item of run.items.values()) {
      if (item.resultStatus !== "pending") continue;
      item.resultStatus = "failed";
      item.failureCode = "lease_expired";
      item.completedAt = now;
      item.attemptCount += 1;
    }
    run.status = sortedTierItems(run).some((item) => item.resultStatus === "failed")
      ? "partial"
      : "completed";
    run.completedAt = now;
  }
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
  ): Promise<PositionPreparationResponse> {
    await this.repository.ensureReady();
    const request = collectionRequestSchema.parse(value);
    return this.repository.transaction((state) => {
      const policy = requirePolicy(state);
      const existingRun = companyTierRunFor(state, request.pool.collectionRunId);
      if (existingRun) return this.preparationResponse(state, existingRun, now);

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
        analysisContractVersion: request.analysisContractVersion,
        candidateIds: activeCandidateIds,
        diagnostics: structuredClone(request.pool.sourceDiagnostics),
        personalExcludedCount: request.pool.filterSummary.personalExcludedCount,
      });

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
      }

      reclaimExpiredCompanyTierLeases(state, now);
      const selected = this.selectCompanies(
        state,
        policy,
        request.pool.collectionRunId,
        request.companyTierContractVersion,
        now,
      );
      const companyTierRun: StoredCompanyTierRun = {
        companyTierRunId: stableUuid(`company-tier:${request.pool.collectionRunId}`),
        collectionRunId: request.pool.collectionRunId,
        candidateContextVersion: policy.candidateContextVersion,
        contractVersion: request.companyTierContractVersion,
        status: selected.length === 0 ? "completed" : "pending",
        assessedNowCount: 0,
        createdAt: now,
        completedAt: selected.length === 0 ? now : null,
        items: new Map(
          selected.map((company, index) => [
            company.companyKey,
            {
              companyKey: company.companyKey,
              companyName: company.companyName,
              selectionOrder: index + 1,
              assessmentStatus: company.assessmentStatus,
              selectionReason:
                company.assessmentStatus === "new" ? ("discovery" as const) : ("refresh" as const),
              priorTier: company.assessmentStatus === "new" ? null : company.priorTier,
              activePositionCount: company.activePositionCount,
              resultStatus: "pending" as const,
              companyTierAssessmentId: null,
              failureCode: null,
              attemptCount: 0,
              completedAt: null,
            },
          ]),
        ),
      };
      state.companyTierRuns.set(companyTierRun.companyTierRunId, companyTierRun);
      return this.preparationResponse(state, companyTierRun, now);
    });
  }

  private selectCompanies(
    state: PositionRepositoryState,
    policy: AnalysisPolicy,
    collectionRunId: string,
    contractVersion: number,
    now: string,
  ): PendingCompany[] {
    const collection = state.collections.get(collectionRunId)!;
    const leased = new Set(
      [...state.companyTierRuns.values()]
        .filter((run) => run.collectionRunId !== collectionRunId)
        .flatMap((run) =>
          sortedTierItems(run)
            .filter((item) => item.resultStatus === "pending")
            .map((item) => item.companyKey),
        ),
    );
    const grouped = new Map<string, PendingCompany>();
    for (const identity of collection.candidateIds) {
      const position = state.positions.get(identity);
      if (!position) continue;
      const key = companyKey(position.posting.company);
      const entry = grouped.get(key) ?? {
        companyKey: key,
        companyName: position.posting.company,
        assessmentStatus: "new" as const,
        activePositionCount: 0,
        firstSeenAt: position.firstSeenAt,
        representativePostingUrls: [],
        priorTier: null,
        priorReason: null,
        priorValidUntil: null,
      };
      entry.activePositionCount += 1;
      if (position.firstSeenAt < entry.firstSeenAt) entry.firstSeenAt = position.firstSeenAt;
      if (entry.representativePostingUrls.length < 3) {
        entry.representativePostingUrls.push(position.posting.url);
      }
      grouped.set(key, entry);
    }
    const candidates: PendingCompany[] = [];
    for (const company of grouped.values()) {
      if (state.preferences.has(company.companyKey)) continue;
      if (leased.has(company.companyKey)) continue;
      if (
        validAssessment(
          state,
          company.companyKey,
          policy.candidateContextVersion,
          contractVersion,
          now,
        )
      ) {
        continue;
      }
      const previous = assessmentsFor(
        state,
        company.companyKey,
        policy.candidateContextVersion,
        contractVersion,
      )[0];
      candidates.push(
        previous
          ? {
              ...company,
              assessmentStatus: "stale",
              priorTier: previous.recommendedTier,
              priorReason: previous.reason,
              priorValidUntil: previous.validUntil,
            }
          : company,
      );
    }
    return selectCompanyTierQueue(candidates, policy);
  }

  private preparationResponse(
    state: PositionRepositoryState,
    run: StoredCompanyTierRun,
    generatedAt: string,
  ): PositionPreparationResponse {
    const collection = state.collections.get(run.collectionRunId)!;
    return positionPreparationResponseSchema.parse({
      schemaVersion: 2,
      collectionRunId: run.collectionRunId,
      generatedAt,
      companyTierQueue: this.companyTierQueueResponse(state, run, generatedAt),
      summary: this.analysisSummary(state, collection, generatedAt),
    });
  }

  private analysisSummary(
    state: PositionRepositoryState,
    collection: StoredCollection,
    generatedAt: string,
  ) {
    const policy = requirePolicy(state);
    const active = collection.candidateIds
      .map((identity) => state.positions.get(identity)!)
      .filter(Boolean);
    const statuses = active.map((position) =>
      analysisStatus(
        position,
        policy.candidateContextVersion,
        collection.analysisContractVersion,
        generatedAt,
      ),
    );
    const run = [...state.analysisRuns.values()].find(
      (entry) => entry.collectionRunId === collection.collectionRunId,
    );
    const items = run ? sortedItems(run) : [];
    return {
      activeCount: active.length,
      reusedCount: statuses.filter((status) => status === "fresh").length,
      queuedCount: items.length,
      pendingCount: statuses.filter((status) => status !== "fresh").length,
      personalExcludedCount: collection.personalExcludedCount,
      newCount: statuses.filter((status) => status === "new").length,
      changedCount: statuses.filter((status) => status === "changed").length,
      staleCount: statuses.filter((status) => status === "stale").length,
      completedCount: items.filter(
        (item) => item.resultStatus === "created" || item.resultStatus === "reused",
      ).length,
      failedCount: items.filter((item) => item.resultStatus === "failed").length,
      warningSourceCount: publicDiagnostics(collection.diagnostics).length,
    };
  }

  private companyTierQueueResponse(
    state: PositionRepositoryState,
    run: StoredCompanyTierRun,
    generatedAt: string,
  ): CompanyTierQueueResponse {
    const collection = state.collections.get(run.collectionRunId)!;
    const items = sortedTierItems(run);
    const companyKeys = new Set(
      collection.candidateIds
        .map((identity) => state.positions.get(identity))
        .filter((position): position is StoredPosition => Boolean(position))
        .map((position) => companyKey(position.posting.company)),
    );
    const manualCount = [...companyKeys].filter((key) => state.preferences.has(key)).length;
    const modelCount = [...companyKeys].filter(
      (key) =>
        !state.preferences.has(key) &&
        validAssessment(state, key, run.candidateContextVersion, run.contractVersion, generatedAt),
    ).length;
    const urlsByCompany = new Map<string, string[]>();
    for (const identity of collection.candidateIds) {
      const position = state.positions.get(identity);
      if (!position) continue;
      const key = companyKey(position.posting.company);
      const urls = urlsByCompany.get(key) ?? [];
      if (urls.length < 3) urls.push(position.posting.url);
      urlsByCompany.set(key, urls);
    }
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
        priorReason:
          item.priorTier === null
            ? null
            : (assessmentsFor(
                state,
                item.companyKey,
                run.candidateContextVersion,
                run.contractVersion,
              )[0]?.reason ?? null),
        priorValidUntil:
          item.priorTier === null
            ? null
            : (assessmentsFor(
                state,
                item.companyKey,
                run.candidateContextVersion,
                run.contractVersion,
              )[0]?.validUntil ?? null),
      })),
      summary: {
        activeCompanyCount: companyKeys.size,
        manualCount,
        modelCount,
        defaultCount: companyKeys.size - manualCount - modelCount,
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
          companyTier: item.companyTier,
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
            companyTierAtAnalysis: item.companyTier,
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

  async saveCompanyTierResults(
    companyTierRunId: string,
    value: unknown,
    now = new Date().toISOString(),
  ): Promise<CompanyTierResultsResponse> {
    await this.repository.ensureReady();
    const request = companyTierResultsRequestSchema.parse(value);
    return this.repository.transaction((state) => {
      const policy = requirePolicy(state);
      const run = state.companyTierRuns.get(companyTierRunId);
      if (!run || run.collectionRunId !== request.collectionRunId) {
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "회사 tier 실행과 수집 실행이 일치하지 않습니다.",
        );
      }
      if (run.status === "completed") return this.companyTierResultsResponse(run, false);
      if (Date.parse(now) - Date.parse(run.createdAt) >= companyTierLeaseMs) {
        throw new ApiError(
          409,
          "COMPANY_TIER_LEASE_EXPIRED",
          "회사 tier 평가 임차권이 끝나 결과를 반영할 수 없습니다.",
        );
      }
      const openKeys = sortedTierItems(run)
        .filter((item) => item.resultStatus === "pending" || item.resultStatus === "failed")
        .map((item) => item.companyKey);
      const submittedKeys = [
        ...request.results.map((result) => result.companyKey),
        ...request.failures.map((failure) => failure.companyKey),
      ];
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
      for (const result of request.results) {
        const item = run.items.get(result.companyKey)!;
        const existing = validAssessment(
          state,
          result.companyKey,
          run.candidateContextVersion,
          run.contractVersion,
          now,
        );
        const assessment =
          existing ??
          ({
            companyTierAssessmentId: crypto.randomUUID(),
            companyKey: result.companyKey,
            companyName: item.companyName,
            candidateContextVersion: run.candidateContextVersion,
            contractVersion: run.contractVersion,
            createdByCompanyTierRunId: run.companyTierRunId,
            recommendedTier: result.recommendedTier,
            confidence: result.confidence,
            reason: result.reason,
            signals: Object.fromEntries(
              result.signals.map((signal) => [signal.axis, signal.level]),
            ),
            evidence: structuredClone(result.evidence),
            assumptions: [...result.assumptions],
            assessedAt: now,
            validUntil: [
              dateOnlyAfterDays(now, policy.companyTierStaleAfterDays),
              ...result.evidence
                .map((entry) => entry.validUntil)
                .filter((entry): entry is string => Boolean(entry)),
              ...(result.validUntil ? [result.validUntil] : []),
            ].sort()[0],
          } satisfies StoredCompanyTierAssessment);
        if (!existing) {
          state.companyTierAssessments.set(assessment.companyTierAssessmentId, assessment);
        }
        item.resultStatus = existing ? "reused" : "created";
        item.companyTierAssessmentId = assessment.companyTierAssessmentId;
        item.failureCode = null;
        item.completedAt = now;
        item.attemptCount += 1;
      }
      for (const failure of request.failures) {
        const item = run.items.get(failure.companyKey)!;
        item.resultStatus = "failed";
        item.companyTierAssessmentId = null;
        item.failureCode = failure.failureCode;
        item.completedAt = now;
        item.attemptCount += 1;
      }
      run.assessedNowCount = sortedTierItems(run).filter(
        (item) => item.resultStatus === "created",
      ).length;
      run.status = sortedTierItems(run).some((item) => item.resultStatus === "failed")
        ? "partial"
        : "completed";
      run.completedAt = now;
      return this.companyTierResultsResponse(run, true);
    });
  }

  private companyTierResultsResponse(
    run: StoredCompanyTierRun,
    applied: boolean,
  ): CompanyTierResultsResponse {
    const items = sortedTierItems(run);
    const count = (status: StoredCompanyTierRunItem["resultStatus"]) =>
      items.filter((item) => item.resultStatus === status).length;
    return companyTierResultsResponseSchema.parse({
      companyTierRunId: run.companyTierRunId,
      status: run.status,
      createdCount: count("created"),
      reusedCount: count("reused"),
      failedCount: count("failed"),
      remainingCount: count("pending") + count("failed"),
      applied,
    });
  }

  async createPositionAnalysisRun(
    collectionRunId: string,
    now = new Date().toISOString(),
  ): Promise<AnalysisQueueResponse> {
    await this.repository.ensureReady();
    return this.repository.transaction((state) => {
      const policy = requirePolicy(state);
      const collection = state.collections.get(collectionRunId);
      if (!collection) throw new ApiError(404, "NOT_FOUND", "수집 실행을 찾을 수 없습니다.");
      const existing = [...state.analysisRuns.values()].find(
        (run) => run.collectionRunId === collectionRunId,
      );
      if (existing) {
        return this.queueResponse(state, existing, collection.personalExcludedCount, now);
      }
      reclaimExpiredCompanyTierLeases(state, now);
      const tierRun = companyTierRunFor(state, collectionRunId);
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
      const pending: PendingPosition[] = [];
      for (const identity of collection.candidateIds) {
        const position = state.positions.get(identity);
        if (!position) continue;
        const status = analysisStatus(
          position,
          policy.candidateContextVersion,
          collection.analysisContractVersion,
          now,
        );
        if (status === "fresh") continue;
        const resolved = tierFor(
          state,
          position,
          policy.candidateContextVersion,
          tierRun.contractVersion,
          now,
        );
        pending.push({
          positionId: position.positionId,
          candidateId: position.candidateId,
          contentHash: position.contentHash,
          status,
          companyTier: resolved.tier,
          companyTierSource: resolved.source,
          companyTierAssessmentId: resolved.assessmentId,
          pendingSince: position.pendingSince ?? collection.collectedAt,
          posting: structuredClone(position.posting),
        });
      }
      const selected = selectAnalysisQueue(pending, policy);
      const analysisRun: StoredAnalysisRun = {
        analysisRunId: stableUuid(`analysis:${collectionRunId}`),
        collectionRunId,
        candidateContextVersion: policy.candidateContextVersion,
        analysisContractVersion: collection.analysisContractVersion,
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
              companyTierAssessmentId: candidate.companyTierAssessmentId,
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
      return this.queueResponse(state, analysisRun, collection.personalExcludedCount, now);
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
      const tierContractVersion =
        companyTierRunFor(state, run.collectionRunId)?.contractVersion ?? 1;
      const resolveTier = (position: StoredPosition) =>
        tierFor(state, position, run.candidateContextVersion, tierContractVersion, now);
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
          ...resolveTier(position),
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
          companyTier: resolveTier(position).tier,
          ...tierProvenance(state, resolveTier(position)),
          analysisStatus: analysisStatus(
            position,
            run.candidateContextVersion,
            run.analysisContractVersion,
            now,
          ),
        }));
      const ranking = ranked.map(({ position, analysis, tier, source, assessmentId }) => ({
        candidateId: position.candidateId,
        company: position.posting.company,
        title: position.posting.title,
        postingUrl: position.posting.url,
        companyTier: tier,
        ...tierProvenance(state, { tier, source, assessmentId }),
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
        companyTierSummary: companyTierRecommendationSummary(
          state,
          active,
          resolveTier,
          run.collectionRunId,
        ),
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
          ranked.map(({ position, source, assessmentId }) => [
            position.candidateId,
            { source, assessmentId },
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
