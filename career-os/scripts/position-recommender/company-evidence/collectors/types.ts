import type {
  CompanyEvidence,
  CompanyEvidenceSourceType,
  CompanyPreference,
} from "../../../lib/career-store/positions/schema.ts";

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
  dartApiKey?: string;
  persistDartCorpCode?: (companyKey: string, corpCode: string) => Promise<void>;
  /** 한 실행의 회사들이 함께 쓰는 값이다. 수집기가 큰 응답을 회사마다 다시 받지 않게 여기에 둔다. */
  runCache?: Map<string, unknown>;
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
