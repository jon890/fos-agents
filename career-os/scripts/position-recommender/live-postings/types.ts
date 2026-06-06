// Posting model and shared contracts for live-postings collection.

export type SourceId = "wanted" | "toss-careers";
export type SourceAlias = "toss";
export type SourceSelection = SourceId | SourceAlias | "all";

export type DiscoveryMode = "broad" | "target-url" | "official-listing" | "official-detail";

export type SourceDiagnosticStatus = "ok" | "partial" | "failed";

export interface Posting {
  source: string;
  discoveryMode?: DiscoveryMode;
  company: string;
  title: string;
  url: string;
  linkType: "direct_posting" | "career_article" | "search_page";
  postingStatus: "active" | "open" | "unknown";
  activeEvidence: string;
  openedAt: string;
  closesAt: string;
  daysUntilClose: string;
  closeUrgency: "urgent" | "soon" | "normal" | "no_deadline" | "unknown";
  category: string;
  summary: string;
  tags: string[];
  skills: string[];
  dueTime: string;
  mainTasks: string;
  requirements: string;
  preferred: string;
}

export interface AdapterOptions {
  serverOnly: boolean;
  wantedLimit: number;
}

export interface SourceDiagnostic {
  source: string;
  status: SourceDiagnosticStatus;
  collectedCount: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  discoveryModes: DiscoveryMode[];
  message: string;
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

export interface CollectionDiagnostics {
  requestedSource: string;
  configuredSources: string[];
  serverOnly: boolean;
  wantedLimit: number;
  includeTossArticles: boolean;
  sourceDiagnostics: SourceDiagnostic[];
  errors: string[];
}

export interface CliArgs {
  out: string;
  source: SourceSelection;
  serverOnly: boolean;
  wantedLimit: number;
  includeTossArticles: boolean;
}
