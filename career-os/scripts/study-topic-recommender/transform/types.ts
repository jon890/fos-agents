import type { ReservoirItem } from "../feed_discovery.js";
import type { PossibleDuplicate } from "../duplicate_detection.js";

export type { ReservoirItem, PossibleDuplicate };

export interface StudyTopicEntry {
  outputPath?: string;
  domain?: string;
  title?: string;
  promptAppend?: string;
  [key: string]: unknown;
}

export interface TopicItem {
  key?: string;
  title?: string;
  domain?: string;
  outputPath?: string;
  source?: string;
  tag?: string;
  difficulty?: string;
  estMinutes?: number;
  whyNow?: string[];
  promotionTarget?: { outputPath?: string };
  [key: string]: unknown;
}

export interface BackendItem extends TopicItem {
  _score?: number;
}

export interface LiveSeed {
  slug: string;
  title: string;
  outputPath?: string;
  difficulty?: string;
  [key: string]: unknown;
}

export interface HistoryEntry {
  generatedAt?: string;
  keys?: string[];
  techBlogKeys?: string[];
  aiKeys?: string[];
  geekKeys?: string[];
  articleUrls?: string[];
  todayPickKeys?: Record<string, string | null>;
  [key: string]: unknown;
}

export interface DiscoveryLogEntry {
  key?: string;
  status: "ok" | "no-feed" | "no-match";
  feedUrl?: string;
  articleUrl?: string;
}

export interface Recommendation extends TopicItem, ReservoirItem {
  discoveredArticle?: {
    title: string;
    url: string;
    published: string;
  };
}

export interface SourcesConfig {
  techBlog?: { items: ReservoirItem[] };
  ai?: { items: ReservoirItem[] };
  geek?: { items: ReservoirItem[] };
}

export interface UpdateExistingItem {
  key: string;
  candidatePath: string;
  matchedPath: string;
  decision: string;
  reason: string;
}

export interface MorningMarkdownStats {
  uncoveredCurated: number;
  remainingLive: number;
  remainingLiveCandidates: number;
  techBlogItems: number;
  aiTopicItems: number;
  geekNewsItems: number;
  scannedMarkdownCount: number;
  possibleDuplicates: number;
}
