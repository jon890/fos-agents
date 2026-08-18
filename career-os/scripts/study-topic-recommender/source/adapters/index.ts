import type { ReadingSource } from "../../reading_sources.js";
import { feedSourceAdapter } from "./feed.js";
import { pageSourceAdapter } from "./page.js";
import { youtubeSourceAdapter } from "./youtube.js";
import type { ReadingSourceAdapter, ReadingSourceAdapterId } from "./types.js";

const ADAPTERS: Record<ReadingSourceAdapterId, ReadingSourceAdapter> = {
  feed: feedSourceAdapter,
  page: pageSourceAdapter,
  youtube: youtubeSourceAdapter,
};

export function resolveReadingSourceAdapter(source: ReadingSource): ReadingSourceAdapter | null {
  if (source.adapter) return ADAPTERS[source.adapter] ?? null;
  return Object.values(ADAPTERS).find((adapter) => adapter.supports(source)) ?? null;
}

export type {
  CollectedReading,
  ReadingSourceAdapter,
  ReadingSourceAdapterContext,
  ReadingSourceAdapterId,
} from "./types.js";
