import type { ReadingSource, ReadingSourceAdapterId } from "../../reading_contracts.js";
import type { ReadingCandidateKind } from "../../reading_contracts.js";

export type { ReadingSourceAdapterId } from "../../reading_contracts.js";

export interface CollectedReading {
  title: string;
  url: string;
  published: string;
  kind: ReadingCandidateKind;
}

export interface ReadingSourceAdapterContext {
  cacheDir: string;
  cacheTtlHours: number;
  timeoutMs: number;
  maxCandidatesPerSource: number;
}

export interface ReadingSourceAdapter {
  id: ReadingSourceAdapterId;
  supports(source: ReadingSource): boolean;
  collect(
    source: ReadingSource,
    context: ReadingSourceAdapterContext
  ): Promise<CollectedReading[]>;
}
