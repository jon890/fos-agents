import type { Recommendation } from "./transform/types.js";

export const READING_CATEGORIES = ["techBlog", "ai", "geek"] as const;
export const READING_SOURCE_ADAPTER_IDS = ["feed", "page"] as const;
export const READING_CANDIDATE_KINDS = ["feed-article", "source-page"] as const;
export const READING_COLLECTION_STATUSES = [
  "collected",
  "source-page",
  "no-public-url",
  "feed-empty",
] as const;

export const DEFAULT_MAX_ARTICLES_PER_FEED = 8;
export const READING_SELECTION_TEXT_MAX_LENGTH = 300;

export type ReadingCategory = (typeof READING_CATEGORIES)[number];
export type ReadingSourceAdapterId = (typeof READING_SOURCE_ADAPTER_IDS)[number];
export type ReadingCandidateKind = (typeof READING_CANDIDATE_KINDS)[number];
export type ReadingCollectionStatus = (typeof READING_COLLECTION_STATUSES)[number];
export type ReadingSelectionMode = "llm" | "deterministic-fallback";

export function isReadingCategory(value: unknown): value is ReadingCategory {
  return typeof value === "string" && READING_CATEGORIES.includes(value as ReadingCategory);
}

export function isReadingSourceAdapterId(value: unknown): value is ReadingSourceAdapterId {
  return typeof value === "string" &&
    READING_SOURCE_ADAPTER_IDS.includes(value as ReadingSourceAdapterId);
}

export function isReadingCandidateKind(value: unknown): value is ReadingCandidateKind {
  return typeof value === "string" &&
    READING_CANDIDATE_KINDS.includes(value as ReadingCandidateKind);
}

export function isReadingCollectionStatus(value: unknown): value is ReadingCollectionStatus {
  return typeof value === "string" &&
    READING_COLLECTION_STATUSES.includes(value as ReadingCollectionStatus);
}

export interface ReadingCategoryPolicy {
  label: string;
  slots: number;
  requireDiscoveredArticle: boolean;
}

export interface ReadingSource {
  key: string;
  category: ReadingCategory;
  title: string;
  source?: string;
  url?: string;
  feedUrl?: string;
  estMinutes?: number;
  enabled?: boolean;
  adapter?: ReadingSourceAdapterId;
}

export interface ReadingSourcesConfigV2 {
  _meta: {
    purpose: string;
    schemaVersion: 2;
  };
  categories: Record<ReadingCategory, ReadingCategoryPolicy>;
  sources: ReadingSource[];
}

export interface NormalizedReadingSources {
  categories: Record<ReadingCategory, ReadingCategoryPolicy>;
  sources: ReadingSource[];
  itemsByCategory: Record<ReadingCategory, ReadingSource[]>;
}

export interface ReadingCandidate {
  id: string;
  sourceKey: string;
  sourceName: string;
  category: ReadingCategory;
  title: string;
  url: string;
  published: string;
  kind: ReadingCandidateKind;
  recentlyRecommended: boolean;
  estMinutes: number;
}

export interface ReadingCollectionLog {
  sourceKey: string;
  status: ReadingCollectionStatus;
  candidateCount: number;
}

export interface ReadingCandidatePool {
  generatedAt: string;
  policy: {
    selection: "llm";
    fixedKeywordsUsed: false;
    sourcePriorityUsed: false;
    maxArticlesPerFeed: number;
  };
  candidates: ReadingCandidate[];
  collectionLog: ReadingCollectionLog[];
}

export interface ReadingSelectionItem {
  candidateId: string;
  summary: string;
  reason: string;
}

export interface ReadingSelection {
  selections: Record<ReadingCategory, ReadingSelectionItem[]>;
}

export interface ReadingSelectionResult {
  recommendations: Record<ReadingCategory, Recommendation[]>;
  selectionMode: ReadingSelectionMode;
}
