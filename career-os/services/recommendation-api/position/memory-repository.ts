import type {
  PostingCandidate,
  SourceDiagnostic,
} from "../../../scripts/position-recommender/live-postings/contracts.ts";
import type { AnalysisPolicy, AnalysisUpdate, CompanyPreference } from "./schema.ts";

export type StoredAnalysis = AnalysisUpdate & {
  analysisId: string;
  contentHash: string;
  candidateContextVersion: string;
  analysisContractVersion: number;
  createdByAnalysisRunId: string | null;
  analyzedAt: string;
  validUntil: string;
  companyTierAtAnalysis: number;
};

export type StoredPosition = {
  positionId: string;
  candidateId: string;
  source: PostingCandidate["source"];
  identity: string;
  contentHash: string;
  posting: PostingCandidate;
  versions: Array<{
    positionVersionId: string;
    contentHash: string;
    posting: PostingCandidate;
    observedAt: string;
  }>;
  firstSeenAt: string;
  lastSeenAt: string;
  pendingSince: string | null;
  lifecycle: "active" | "closed" | "not_seen";
  analyses: StoredAnalysis[];
};

export type CompanyTierSource = "manual" | "model" | "default";

export type CompanyTierFailureCode =
  | "research_unavailable"
  | "model_unavailable"
  | "contract_rejected"
  | "internal_error"
  | "lease_expired";

export type StoredCompanyTierAssessment = {
  companyTierAssessmentId: string;
  companyKey: string;
  companyName: string;
  candidateContextVersion: string;
  contractVersion: number;
  createdByCompanyTierRunId: string | null;
  recommendedTier: number;
  confidence: "low" | "medium" | "high";
  reason: string;
  signals: Record<string, unknown>;
  evidence: unknown[];
  assumptions: string[];
  assessedAt: string;
  validUntil: string;
};

export type StoredCompanyTierRunItem = {
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
  completedAt: string | null;
};

export type StoredCompanyTierRun = {
  companyTierRunId: string;
  collectionRunId: string;
  candidateContextVersion: string;
  contractVersion: number;
  status: "pending" | "partial" | "completed";
  assessedNowCount: number;
  createdAt: string;
  completedAt: string | null;
  items: Map<string, StoredCompanyTierRunItem>;
};

export type StoredTierProvenance = {
  source: CompanyTierSource;
  assessmentId: string | null;
};

export type StoredAnalysisRunItem = {
  positionId: string;
  positionVersionId: string;
  selectionOrder: number;
  analysisStatus: "new" | "changed" | "stale";
  selectionReason: "priority" | "aging" | "overflow";
  companyTier: number;
  companyTierSource: CompanyTierSource;
  companyTierAssessmentId: string | null;
  resultStatus: "pending" | "created" | "reused" | "failed";
  analysisId: string | null;
  failureCode: string | null;
  attemptCount: number;
  completedAt: string | null;
};

export type StoredAnalysisRun = {
  analysisRunId: string;
  collectionRunId: string;
  candidateContextVersion: string;
  analysisContractVersion: number;
  createdAt: string;
  completedAt: string | null;
  status: "pending" | "partial" | "completed";
  items: Map<string, StoredAnalysisRunItem>;
  analyzedNowCount: number;
};

export type StoredCollection = {
  collectionRunId: string;
  collectedAt: string;
  analysisContractVersion: number;
  candidateIds: string[];
  diagnostics: SourceDiagnostic[];
  personalExcludedCount: number;
};

type RepositoryState = {
  policy?: AnalysisPolicy;
  preferences: Map<string, CompanyPreference>;
  positions: Map<string, StoredPosition>;
  collections: Map<string, StoredCollection>;
  analysisRuns: Map<string, StoredAnalysisRun>;
  companyTierRuns: Map<string, StoredCompanyTierRun>;
  companyTierAssessments: Map<string, StoredCompanyTierAssessment>;
  recommendationResponses: Map<string, unknown>;
  recommendationAnalysisIds: Map<string, Map<string, string>>;
  recommendationTierSources: Map<string, Map<string, StoredTierProvenance>>;
};

function cloneState(state: RepositoryState): RepositoryState {
  return structuredClone(state);
}

export class MemoryPositionRepository {
  protected state: RepositoryState = {
    preferences: new Map(),
    positions: new Map(),
    collections: new Map(),
    analysisRuns: new Map(),
    companyTierRuns: new Map(),
    companyTierAssessments: new Map(),
    recommendationResponses: new Map(),
    recommendationAnalysisIds: new Map(),
    recommendationTierSources: new Map(),
  };

  async ensureReady(): Promise<void> {}

  async transaction<T>(callback: (state: RepositoryState) => Promise<T> | T): Promise<T> {
    const draft = cloneState(this.state);
    const result = await callback(draft);
    this.state = draft;
    return result;
  }

  snapshot(): RepositoryState {
    return cloneState(this.state);
  }

  async setPolicy(policy: AnalysisPolicy): Promise<void> {
    await this.transaction((state) => {
      state.policy = structuredClone(policy);
    });
  }

  async putPreference(preference: CompanyPreference): Promise<void> {
    await this.transaction((state) => {
      state.preferences.set(preference.companyKey, structuredClone(preference));
    });
  }
}

export type PositionRepositoryState = RepositoryState;
