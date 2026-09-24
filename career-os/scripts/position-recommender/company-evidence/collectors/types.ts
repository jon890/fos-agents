import type {
  CompanyEvidence,
  CompanyEvidenceSourceType,
  CompanyPreference,
} from "../../../../services/recommendation-api/src/positions/schema.ts";

export type ActiveCompanyPosting = {
  title: string;
  url: string;
  firstSeenAt: string;
};

export type EvidenceFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type CollectorInput = {
  companyKey: string;
  companyName: string;
  preference?: CompanyPreference;
  existingEvidence: Array<CompanyEvidence & { id?: string }>;
  activePostings: ActiveCompanyPosting[];
  now: Date;
  fetcher: EvidenceFetcher;
};

export type CollectorResult = { evidence: CompanyEvidence[]; diagnostics: string[] };

export type CompanyEvidenceCollector = {
  name: string;
  sourceTypes: readonly CompanyEvidenceSourceType[];
  enabled(input: CollectorInput): boolean;
  collect(input: CollectorInput): Promise<CollectorResult>;
  refreshEveryRun?: boolean;
};

export function dateAfter(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export function compactSummary(value: string): string {
  return value.trim().slice(0, 500);
}
