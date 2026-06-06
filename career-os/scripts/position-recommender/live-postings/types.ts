// Posting model and shared contracts for live-postings collection.

export interface Posting {
  source: string;
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

export interface SourceAdapter {
  name: string;
  /** Collect raw postings for this source. Source-specific active checks live here. */
  collect(opts: AdapterOptions): Promise<Posting[]>;
  /** Diagnostics note appended to source_errors whenever this adapter runs. */
  note?: string;
}

export interface CollectionDiagnostics {
  requestedSource: string;
  serverOnly: boolean;
  wantedLimit: number;
  includeTossArticles: boolean;
  errors: string[];
}

export interface CliArgs {
  out: string;
  source: "all" | "wanted" | "toss";
  serverOnly: boolean;
  wantedLimit: number;
  includeTossArticles: boolean;
}
