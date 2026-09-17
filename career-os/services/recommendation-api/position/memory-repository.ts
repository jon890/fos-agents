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

export type StoredAnalysisRun = {
  analysisRunId: string;
  collectionRunId: string;
  candidateContextVersion: string;
  analysisContractVersion: number;
  createdAt: string;
  completedAt: string | null;
  selectedPositionIds: string[];
  statusByPosition: Map<string, "new" | "changed" | "stale">;
  selectionReasonByPosition: Map<string, "priority" | "aging" | "overflow">;
  companyTierByPosition: Map<string, number>;
  analyzedNowCount: number;
};

export type StoredCollection = {
  collectionRunId: string;
  collectedAt: string;
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
  recommendationResponses: Map<string, unknown>;
  recommendationAnalysisIds: Map<string, Map<string, string>>;
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
    recommendationResponses: new Map(),
    recommendationAnalysisIds: new Map(),
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
