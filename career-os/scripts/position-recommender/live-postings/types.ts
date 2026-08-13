// 어댑터 실행 계약. 외부 데이터 모델은 contracts.ts의 Zod 스키마에서 추론한다.

import type { DiscoveryMode, Posting, SourceDiagnostic, SourceId } from "./contracts.ts";

export type { DiscoveryMode, Posting, SourceDiagnostic, SourceId } from "./contracts.ts";

export type SourceAlias = "toss" | "coupang" | "kakaobank" | "kurly" | "samsung" | "sk" | "cj" | "krafton" | "line" | "daangn" | "woowahan";
export type SourceSelection = SourceId | SourceAlias | "all";

export interface AdapterOptions {
  serverOnly: boolean;
  wantedLimit: number;
}

export interface AdapterCollectionResult {
  postings: Posting[];
  diagnostics: Omit<SourceDiagnostic, "importedCount">;
  errors?: string[];
}

export interface SourceAdapter {
  id: SourceId;
  name: string;
  /** Collect raw postings for this source. Source-specific active checks live here. */
  collect(opts: AdapterOptions): Promise<Posting[] | AdapterCollectionResult>;
  /** Diagnostics note appended to source_errors whenever this adapter runs. */
  note?: string;
}

export type PostingRejectionCode =
  | "not_direct_posting"
  | "unverified_status"
  | "expired_deadline";

export interface PostingEligibilityDecision {
  eligible: boolean;
  rejectionCode?: PostingRejectionCode;
}

/** 모든 소스가 공통으로 통과해야 하는 공고 생명주기 계약 */
export interface PostingEligibilityPolicy {
  evaluate(posting: Posting, evaluatedAt?: Date): PostingEligibilityDecision;
}

export interface CollectionDiagnostics {
  collectionRunId: string;
  collectedAt: string;
  requestedSource: string;
  configuredSources: SourceId[];
  serverOnly: boolean;
  wantedLimit: number;
  includeTossArticles: boolean;
  sourceDiagnostics: SourceDiagnostic[];
  errors: string[];
}

export interface CliArgs {
  jsonOut: string;
  source: SourceSelection;
  serverOnly: boolean;
  wantedLimit: number;
  includeTossArticles: boolean;
}
