#!/usr/bin/env bun
/**
 * morning topic recommendation pipeline.
 *
 * ADR-009: reservoir-based, file-backed.
 * ADR-010: score-based backend selection with mix targets.
 * ADR-012: 10-item daily curation (backend 3 / tech-blog 3 / AI 3 / geek 1) + today pick 3.
 * ADR-013: secondary 카테고리에 RSS/Atom discovery로 실제 최신 글 1편을 부착.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  discoverForItem,
  type FeedEntry,
  type ReservoirItem,
} from "./feed_discovery.js";

// ── paths ─────────────────────────────────────────────────────────────────────

const TASK_ROOT = join(homedir(), "ai-nodes", "career-os");
const CONFIG = join(TASK_ROOT, "config");
const RUNTIME = join(TASK_ROOT, "data", "runtime");
mkdirSync(RUNTIME, { recursive: true });

const HISTORY_PATH = join(RUNTIME, "topic-inventory-history.jsonl");
const FEED_CACHE_DIR = join(RUNTIME, "feed-cache");
const FEED_CACHE_TTL_HOURS = 6;
const FEED_TIMEOUT_MS = 8_000;
// 최근 N개 history entry의 article URL은 회피
const RECENT_ARTICLE_URL_LOOKBACK = 7;

// ── scoring constants (ADR-009/010/012) ──────────────────────────────────────

const BACKEND_TARGET_TOTAL = 3;
const BACKEND_MIX_TARGET: Record<string, number> = {
  new: 1,
  deepen: 1,
  "live-coding": 1,
};
const WEAK_AREAS = new Set([
  "ai-agent",
  "llm-serving",
  "rag",
  "python",
  "security",
  "observability",
]);
// Weak areas still matter, but they should not dominate the daily list.
const WEAK_AREA_BONUS = 1;
const RECENT_PENALTY_PER = 3;
const CARRYOVER_PENALTY = 2;
// Strongly suppress topics already shown in recent recommendation history.
const RECENT_KEY_PENALTY_PER = 8;
const BACKEND_KEY_COOLDOWN_ENTRIES = 7;
const TAG_PRIORITY: Record<string, number> = {
  new: 0,
  deepen: -1,
  review: -2,
  "live-coding": 0,
};

// ADR-012: 보조 카테고리 슬롯
const TECH_BLOG_SLOTS = 3;
const AI_SLOTS = 3;
const GEEK_SLOTS = 1;
// key suppression: cooldown|recent history entries — SECONDARY for secondary, BACKEND for backend keys
const SECONDARY_COOLDOWN_ENTRIES = 3;

// ── types ─────────────────────────────────────────────────────────────────────

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

export interface Artifact {
  outputPath?: string;
  kind?: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface TopicsConfig {
  "study-pack": Record<string, StudyTopicEntry>;
  "study-pack-candidates"?: { topics: TopicItem[] };
}

export interface SourcesConfig {
  techBlog?: { items: ReservoirItem[] };
  ai?: { items: ReservoirItem[] };
  geek?: { items: ReservoirItem[] };
}

export interface ArtifactsFile {
  artifacts: Artifact[];
}

// ── JSON helpers ──────────────────────────────────────────────────────────────

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function safeLoad<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return readJson<T>(path);
  } catch {
    return fallback;
  }
}

// ── history helpers ───────────────────────────────────────────────────────────

function loadRecentHistory(maxEntries: number): HistoryEntry[] {
  if (!existsSync(HISTORY_PATH)) return [];
  const entries: HistoryEntry[] = [];
  try {
    const lines = readFileSync(HISTORY_PATH, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        entries.push(JSON.parse(trimmed) as HistoryEntry);
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    return [];
  }
  return entries.slice(-maxEntries);
}

function loadYesterdayKeys(): Set<string> {
  const recent = loadRecentHistory(1);
  if (recent.length === 0) return new Set();
  return new Set(recent[recent.length - 1].keys ?? []);
}

function collectRecentKeys(
  entries: HistoryEntry[],
  field: keyof Pick<HistoryEntry, "techBlogKeys" | "aiKeys" | "geekKeys">
): Set<string> {
  const keys = new Set<string>();
  for (const entry of entries) {
    const vals = entry[field] as string[] | undefined;
    for (const key of vals ?? []) {
      keys.add(key);
    }
  }
  return keys;
}

function appendHistory(payload: Omit<HistoryEntry, "generatedAt">): void {
  const entry: HistoryEntry = {
    generatedAt: new Date().toISOString(),
    ...payload,
  };
  appendFileSync(HISTORY_PATH, JSON.stringify(entry, null, 0) + "\n", "utf-8");
}

// ── counter utility ───────────────────────────────────────────────────────────

function countMap(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const item of items) {
    m.set(item, (m.get(item) ?? 0) + 1);
  }
  return m;
}

// ── load config ───────────────────────────────────────────────────────────────

const topicsCfg = readJson<TopicsConfig>(join(CONFIG, "topics.json"));
const studyTopics = topicsCfg["study-pack"];
const studyCandidates = topicsCfg["study-pack-candidates"]?.topics ?? [];

const liveSeeds: LiveSeed[] = readJson<{ seeds: LiveSeed[] }>(
  join(CONFIG, "live-coding-seed-pool.json")
).seeds ?? [];

const liveSeedCandidates: LiveSeed[] = readJson<{ seeds: LiveSeed[] }>(
  join(CONFIG, "live-coding-seed-candidates.json")
).seeds ?? [];

const artifacts: Artifact[] = safeLoad<ArtifactsFile>(
  join(TASK_ROOT, "data", "generated-artifacts.json"),
  { artifacts: [] }
).artifacts ?? [];

const sources = safeLoad<SourcesConfig>(join(CONFIG, "sources.json"), {});
const techBlogItems: ReservoirItem[] = sources.techBlog?.items ?? [];
const aiTopicItems: ReservoirItem[] = sources.ai?.items ?? [];
const geekNewsItems: ReservoirItem[] = sources.geek?.items ?? [];

// ── derived sets ──────────────────────────────────────────────────────────────

const studyPaths = new Set(
  artifacts.filter((a) => a.kind === "study-pack").map((a) => a.outputPath)
);
const livePaths = new Set(
  artifacts.filter((a) => a.kind === "live-coding").map((a) => a.outputPath)
);

const uncoveredCurated: TopicItem[] = Object.entries(studyTopics)
  .filter(([, entry]) => !studyPaths.has(entry.outputPath))
  .map(([key, entry]) => ({
    key,
    title: key,
    domain: entry.domain ?? "unknown",
    outputPath: entry.outputPath,
    source: "curated",
    tag: "new" as const,
  }));

const remainingLive = liveSeeds.filter((s) => !livePaths.has(s.outputPath));
const remainingLiveCandidates = liveSeedCandidates.filter(
  (s) => !livePaths.has(s.outputPath)
);

// recent study artifact domain counts (last 10)
const recentStudyArtifacts = artifacts
  .filter((a) => a.kind === "study-pack")
  .map((a) => {
    let ts = new Date(a.updatedAt ?? a.createdAt ?? "");
    if (isNaN(ts.getTime())) ts = new Date(0);
    return { ts, artifact: a };
  })
  .sort((a, b) => b.ts.getTime() - a.ts.getTime());

function artifactDomainLabel(outputPath: string): string {
  if (outputPath.startsWith("database/mysql/")) return "mysql";
  if (outputPath.startsWith("database/redis/")) return "redis";
  if (outputPath.startsWith("java/spring/")) return "spring";
  if (outputPath.startsWith("java/")) return "java";
  if (outputPath.startsWith("architecture/")) return "architecture";
  if (outputPath.startsWith("search/")) return "search";
  if (outputPath.startsWith("kafka/") || outputPath.startsWith("rabbitmq/"))
    return "message-queue";
  if (outputPath.startsWith("interview/")) return "interview";
  return "other";
}

const recentDomains = recentStudyArtifacts
  .slice(0, 10)
  .map(({ artifact }) => artifactDomainLabel(artifact.outputPath ?? ""));

const recentDomainCounts = countMap(recentDomains);

// candidate recommendations (filter out already promoted)
const candidateRecommendations: TopicItem[] = studyCandidates.filter((item) => {
  const promotedPath = item.promotionTarget?.outputPath;
  return !(promotedPath && studyPaths.has(promotedPath));
});

// history
const recentHistory = loadRecentHistory(SECONDARY_COOLDOWN_ENTRIES);
const backendKeyHistory = loadRecentHistory(BACKEND_KEY_COOLDOWN_ENTRIES);
const recentBackendKeyCounts = countMap(
  backendKeyHistory.flatMap((e) => e.keys ?? [])
);
const yesterdayKeys = loadYesterdayKeys();
const recentTechBlogKeys = collectRecentKeys(recentHistory, "techBlogKeys");
const recentAiKeys = collectRecentKeys(recentHistory, "aiKeys");
const recentGeekKeys = collectRecentKeys(recentHistory, "geekKeys");

const articleUrlHistory = loadRecentHistory(RECENT_ARTICLE_URL_LOOKBACK);
const recentArticleUrls = new Set<string>(
  articleUrlHistory
    .flatMap((e) => e.articleUrls ?? [])
    .filter(Boolean) as string[]
);

// ── backend domain group ──────────────────────────────────────────────────────

/** Collapse adjacent domains for visible diversity in a 3-item daily set. */
function backendDomainGroup(domain: string | undefined): string {
  const d = domain ?? "";
  if (["database", "mysql", "postgresql"].includes(d)) return "database";
  if (["redis", "cache"].includes(d)) return "cache";
  if (["kafka", "rabbitmq", "sqs", "message-queue"].includes(d))
    return "message-queue";
  if (["spring", "java", "security"].includes(d)) return "java-spring";
  return d || "unknown";
}

// ── backend recommendations (ADR-010 점수 기반 + ADR-012 3-item mix target) ──

function pickBackendRecommendations(
  yesterdayKeysSet: Set<string>
): BackendItem[] {
  const pool: BackendItem[] = candidateRecommendations.map((item) => ({
    ...item,
  }));

  const liveItemSource =
    remainingLive.length > 0
      ? remainingLive.slice(0, 3)
      : remainingLiveCandidates.slice(0, 3);

  for (const seed of liveItemSource) {
    pool.push({
      key: `live-coding-${seed.slug}`,
      title: `라이브코딩 — ${seed.title}`,
      domain: "live-coding",
      tag: "live-coding",
      difficulty: seed.difficulty ?? "중",
      estMinutes: 40,
      whyNow: [
        "1차 면접 live-coding 축을 유지하기 좋다",
        "주제 풀이와 설명 연습을 같이 할 수 있다",
      ],
    });
  }

  // score each item
  for (const item of pool) {
    const key = item.key ?? "";
    const domain = item.domain ?? "";
    const tag = item.tag ?? "new";
    let score = -RECENT_PENALTY_PER * (recentDomainCounts.get(domain) ?? 0);
    score -= RECENT_KEY_PENALTY_PER * (recentBackendKeyCounts.get(key) ?? 0);
    if (WEAK_AREAS.has(domain)) score += WEAK_AREA_BONUS;
    score += TAG_PRIORITY[tag] ?? -3;
    if (yesterdayKeysSet.has(key)) score -= CARRYOVER_PENALTY;
    item._score = score;
  }

  pool.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

  const chosen: BackendItem[] = [];
  const usedTags = new Map<string, number>();
  const chosenKeys = new Set<string>();
  const usedDomains = new Set<string>();

  // First pass: satisfy the tag mix while avoiding repeated backend domain groups
  // and recently shown exact keys.
  for (const item of pool) {
    const key = item.key ?? "";
    const tag = item.tag ?? "new";
    const domain = backendDomainGroup(item.domain);
    if ((recentBackendKeyCounts.get(key) ?? 0) > 0) continue;
    if (usedDomains.has(domain)) continue;
    const tagCount = usedTags.get(tag) ?? 0;
    if (tagCount < (BACKEND_MIX_TARGET[tag] ?? 0)) {
      chosen.push(item);
      chosenKeys.add(key);
      usedDomains.add(domain);
      usedTags.set(tag, tagCount + 1);
      if (chosen.length >= BACKEND_TARGET_TOTAL) break;
    }
  }

  // Second pass: if one mix slot is impossible, still prefer a fresh domain and non-recent key.
  if (chosen.length < BACKEND_TARGET_TOTAL) {
    for (const item of pool) {
      const key = item.key ?? "";
      const domain = backendDomainGroup(item.domain);
      if (
        chosenKeys.has(key) ||
        usedDomains.has(domain) ||
        (recentBackendKeyCounts.get(key) ?? 0) > 0
      )
        continue;
      chosen.push(item);
      chosenKeys.add(key);
      usedDomains.add(domain);
      if (chosen.length >= BACKEND_TARGET_TOTAL) break;
    }
  }

  // Final fallback: only repeat domains when the reservoir is genuinely narrow.
  if (chosen.length < BACKEND_TARGET_TOTAL) {
    for (const item of pool) {
      const key = item.key ?? "";
      if (chosenKeys.has(key)) continue;
      chosen.push(item);
      chosenKeys.add(key);
      if (chosen.length >= BACKEND_TARGET_TOTAL) break;
    }
  }

  return chosen.slice(0, BACKEND_TARGET_TOTAL);
}

// ── secondary recommendations ─────────────────────────────────────────────────

/**
 * 비-backend 카테고리(tech-blog / AI / geek) 추천 선택.
 *
 * 1차: cooldown(최근 history N개) 안에 없는 항목을 reservoir 순서대로 선택.
 * 2차: 부족하면 recently_shown 포함해서라도 채움.
 * reservoir 순서는 사람이 큐레이션한 우선도이므로 추가 정렬을 하지 않는다.
 */
function pickSecondary(
  items: ReservoirItem[],
  recentlyShownKeys: Set<string>,
  limit: number
): Recommendation[] {
  if (items.length === 0) return [];
  const fresh = items.filter((item) => !recentlyShownKeys.has(item.key ?? ""));
  const chosen: Recommendation[] = fresh.slice(0, limit).map((i) => ({ ...i }));
  if (chosen.length >= limit) return chosen;
  const chosenKeys = new Set(chosen.map((item) => item.key));
  for (const item of items) {
    if (chosenKeys.has(item.key)) continue;
    chosen.push({ ...item });
    chosenKeys.add(item.key);
    if (chosen.length >= limit) break;
  }
  return chosen.slice(0, limit);
}

// ── discovery (ADR-013) ───────────────────────────────────────────────────────

/**
 * ADR-013: feedUrl이 있는 reservoir 항목에 최신 글을 부착.
 *
 * 실패 항목은 조용히 reservoir 원본 그대로 둔다. 새로 선택된 URL은
 * excludeUrls 셋에 누적해 같은 morning 안에서 중복 추천을 방지한다.
 */
async function attachDiscoveredArticles(
  items: Recommendation[],
  excludeUrls: Set<string>
): Promise<DiscoveryLogEntry[]> {
  const log: DiscoveryLogEntry[] = [];
  for (const item of items) {
    const feedUrl = item.feedUrl as string | undefined;
    if (!feedUrl) {
      log.push({ key: item.key, status: "no-feed" });
      continue;
    }
    const article = await discoverForItem(
      item as ReservoirItem,
      FEED_CACHE_DIR,
      excludeUrls,
      FEED_CACHE_TTL_HOURS,
      FEED_TIMEOUT_MS
    );
    if (!article) {
      log.push({ key: item.key, status: "no-match", feedUrl });
      continue;
    }
    item.discoveredArticle = {
      title: article.title || item.title || "",
      url: article.link || "",
      published: article.published || "",
    };
    if (item.discoveredArticle.url) {
      excludeUrls.add(item.discoveredArticle.url);
    }
    log.push({
      key: item.key,
      status: "ok",
      feedUrl,
      articleUrl: item.discoveredArticle.url,
    });
  }
  return log;
}

/**
 * Pick tech-blog recommendations that resolve to concrete article URLs.
 *
 * Company blog cards are only useful when they point to a real post. Unlike AI/geek
 * secondary cards, do not show vague source-level fallback cards for tech blogs.
 */
async function pickTechBlogArticles(
  items: ReservoirItem[],
  recentlyShownKeys: Set<string>,
  limit: number,
  excludeUrls: Set<string>
): Promise<[Recommendation[], DiscoveryLogEntry[]]> {
  const log: DiscoveryLogEntry[] = [];
  const chosen: Recommendation[] = [];
  const ordered = [
    ...items.filter((item) => !recentlyShownKeys.has(item.key ?? "")),
    ...items.filter((item) => recentlyShownKeys.has(item.key ?? "")),
  ];
  const seenKeys = new Set<string>();
  for (const rawItem of ordered) {
    const key = rawItem.key ?? "";
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const item: Recommendation = { ...rawItem };
    const itemLog = await attachDiscoveredArticles([item], excludeUrls);
    log.push(...itemLog);
    if (item.discoveredArticle?.url) {
      chosen.push(item);
    }
    if (chosen.length >= limit) break;
  }
  return [chosen, log];
}

// ── markdown rendering ────────────────────────────────────────────────────────

function renderBackendItem(idx: number, item: Recommendation): string[] {
  const tagLabel: Record<string, string> = {
    new: "신규",
    deepen: "심화",
    review: "복습",
    "live-coding": "live-coding",
  };
  const label = tagLabel[item.tag ?? "new"] ?? item.tag ?? "new";
  const lines = [
    `${idx}. **${label} 추천 — ${item.title}**`,
    `   - 분야: ${item.domain ?? "unknown"}`,
    `   - 난이도: ${item.difficulty ?? "중"}`,
    `   - 예상 학습 시간: ${item.estMinutes ?? 45}분`,
    "   - 왜 지금 추천하는지",
  ];
  for (const reason of item.whyNow ?? []) {
    lines.push(`     - ${reason}`);
  }
  return lines;
}

function renderSecondaryItem(
  idx: number,
  item: Recommendation,
  sourceField: string,
  sourceLabel = "출처"
): string[] {
  const source =
    (item[sourceField] as string | undefined) ||
    (item.source as string | undefined) ||
    (item.category as string | undefined) ||
    "";
  const article = item.discoveredArticle;

  if (article?.url) {
    // ADR-013: 실 글 제목/URL을 1순위로 노출하고, 원본 reservoir 카드는 fallback 컨텍스트로만 둔다.
    const title = article.title || item.title || item.key || "제목 없음";
    const lines = [`${idx}. **${title}**`];
    if (source) lines.push(`   - ${sourceLabel}: ${source}`);
    lines.push(`   - 링크: ${article.url}`);
    if (article.published) lines.push(`   - 게시: ${article.published}`);
    if (item.tags && Array.isArray(item.tags))
      lines.push(`   - 태그: ${(item.tags as string[]).join(", ")}`);
    if (item.estMinutes) lines.push(`   - 예상 시간: ${item.estMinutes}분`);
    if (item.whyNow && Array.isArray(item.whyNow)) {
      lines.push("   - 왜 지금 보면 좋은지");
      for (const reason of item.whyNow as string[]) {
        lines.push(`     - ${reason}`);
      }
    }
    return lines;
  }

  const lines = [`${idx}. **${item.title ?? item.key ?? "제목 없음"}**`];
  if (source) lines.push(`   - ${sourceLabel}: ${source}`);
  if (item.url) lines.push(`   - 링크: ${item.url}`);
  if (item.feedUrl)
    lines.push(
      "   - (피드 fetch 실패 또는 매칭 글 없음 — reservoir 카드로 표시)"
    );
  if (item.tags && Array.isArray(item.tags))
    lines.push(`   - 태그: ${(item.tags as string[]).join(", ")}`);
  if (item.estMinutes) lines.push(`   - 예상 시간: ${item.estMinutes}분`);
  if (item.whyNow && Array.isArray(item.whyNow)) {
    lines.push("   - 왜 지금 보면 좋은지");
    for (const reason of item.whyNow as string[]) {
      lines.push(`     - ${reason}`);
    }
  }
  return lines;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const backendRecommendations = pickBackendRecommendations(yesterdayKeys);
  const aiRecommendations = pickSecondary(aiTopicItems, recentAiKeys, AI_SLOTS);
  const geekRecommendations = pickSecondary(geekNewsItems, recentGeekKeys, GEEK_SLOTS);

  const discoveryExclude = new Set(recentArticleUrls);

  const [techBlogRecommendations, techBlogDiscoveryLog] =
    await pickTechBlogArticles(
      techBlogItems,
      recentTechBlogKeys,
      TECH_BLOG_SLOTS,
      discoveryExclude
    );

  let discoveryLog: DiscoveryLogEntry[] = [...techBlogDiscoveryLog];
  for (const group of [aiRecommendations, geekRecommendations]) {
    const groupLog = await attachDiscoveredArticles(group, discoveryExclude);
    discoveryLog = discoveryLog.concat(groupLog);
  }

  const todayPick = {
    backend: backendRecommendations[0] ?? null,
    techBlog: techBlogRecommendations[0] ?? null,
    ai: aiRecommendations[0] ?? null,
  };

  // ── write topic-inventory.json ────────────────────────────────────────────

  const inventory = {
    generatedAt: new Date().toISOString(),
    counts: {
      curatedStudyTopics: Object.keys(studyTopics).length,
      uncoveredCuratedStudyTopics: uncoveredCurated.length,
      studyTopicCandidates: candidateRecommendations.length,
      liveCodingPrimarySeeds: liveSeeds.length,
      liveCodingRemainingPrimarySeeds: remainingLive.length,
      liveCodingCandidateSeeds: liveSeedCandidates.length,
      liveCodingRemainingCandidateSeeds: remainingLiveCandidates.length,
      techBlogReservoir: techBlogItems.length,
      aiReservoir: aiTopicItems.length,
      geekReservoir: geekNewsItems.length,
    },
    recentDomainCounts: Object.fromEntries(recentDomainCounts),
    pools: {
      uncoveredCuratedStudyTopics: uncoveredCurated,
      candidateStudyTopics: candidateRecommendations,
      remainingLiveCodingSeeds: remainingLive,
      remainingLiveCodingCandidateSeeds: remainingLiveCandidates,
    },
    recommendations: backendRecommendations,
    techBlogRecommendations,
    aiRecommendations,
    geekRecommendations,
    todayPick,
    discovery: {
      cacheDir: FEED_CACHE_DIR,
      cacheTtlHours: FEED_CACHE_TTL_HOURS,
      log: discoveryLog,
    },
  };

  writeFileSync(
    join(RUNTIME, "topic-inventory.json"),
    JSON.stringify(inventory, null, 2) + "\n",
    "utf-8"
  );

  // ── write morning-topic-recommendation.md ─────────────────────────────────

  const lines: string[] = [
    "# 오늘의 학습/리딩 추천 (10픽 + 오늘의 3선)",
    "",
  ];

  lines.push("## 백엔드 스터디 주제 (3)", "");
  if (backendRecommendations.length > 0) {
    for (let i = 0; i < backendRecommendations.length; i++) {
      lines.push(...renderBackendItem(i + 1, backendRecommendations[i]), "");
    }
  } else {
    lines.push(
      "- (reservoir 비어 있음 — `run_now.sh replenish-topics` 필요)",
      ""
    );
  }

  lines.push("## 회사·엔지니어링 기술 블로그 (3)", "");
  if (techBlogRecommendations.length > 0) {
    for (let i = 0; i < techBlogRecommendations.length; i++) {
      lines.push(
        ...renderSecondaryItem(i + 1, techBlogRecommendations[i], "source"),
        ""
      );
    }
  } else {
    lines.push("- (`config/sources.json` techBlog 비어 있음)", "");
  }

  lines.push("## AI 관련 (3)", "");
  if (aiRecommendations.length > 0) {
    for (let i = 0; i < aiRecommendations.length; i++) {
      lines.push(
        ...renderSecondaryItem(
          i + 1,
          aiRecommendations[i],
          "category",
          "분야"
        ),
        ""
      );
    }
  } else {
    lines.push("- (`config/sources.json` ai 비어 있음)", "");
  }

  lines.push("## Geek/뉴스/산업 흐름 (1)", "");
  if (geekRecommendations.length > 0) {
    for (let i = 0; i < geekRecommendations.length; i++) {
      lines.push(
        ...renderSecondaryItem(i + 1, geekRecommendations[i], "source"),
        ""
      );
    }
  } else {
    lines.push("- (`config/sources.json` geek 비어 있음)", "");
  }

  lines.push("## 오늘의 3선 (각 카테고리에서 1개씩)", "");
  const pickLabels: [string, Recommendation | null][] = [
    ["백엔드", todayPick.backend],
    ["기술 블로그", todayPick.techBlog],
    ["AI", todayPick.ai],
  ];
  for (const [label, pick] of pickLabels) {
    if (!pick) {
      lines.push(`- ${label}: (없음)`);
      continue;
    }
    const article = pick.discoveredArticle;
    if (article?.url) {
      const title = article.title || pick.title || pick.key || "제목 없음";
      lines.push(`- **${label}**: ${title}`);
      lines.push(`  - ${article.url}`);
    } else {
      const title = pick.title || pick.key || "제목 없음";
      lines.push(`- **${label}**: ${title}`);
    }
  }

  lines.push(
    "",
    "## 재고 메모",
    `- 신규 curated study topic 남음: ${uncoveredCurated.length}개`,
    `- live-coding primary seed 남음: ${remainingLive.length}개`,
    `- live-coding candidate seed 남음: ${remainingLiveCandidates.length}개`,
    `- tech-blog reservoir: ${techBlogItems.length}개 / AI reservoir: ${aiTopicItems.length}개 / geek reservoir: ${geekNewsItems.length}개`,
    "",
    "백엔드 항목은 `run_now.sh study-pack <key>`로 즉시 만들 수 있다.",
    "나머지 카테고리는 외부 reading 추천이라 별도 생성 단계 없이 그대로 학습한다."
  );

  writeFileSync(
    join(RUNTIME, "morning-topic-recommendation.md"),
    lines.join("\n") + "\n",
    "utf-8"
  );

  // ── append history ────────────────────────────────────────────────────────

  const discoveredArticleUrls: string[] = [];
  for (const group of [
    techBlogRecommendations,
    aiRecommendations,
    geekRecommendations,
  ]) {
    for (const item of group) {
      const url = item.discoveredArticle?.url;
      if (url) discoveredArticleUrls.push(url);
    }
  }

  appendHistory({
    keys: backendRecommendations.filter((r) => r.key).map((r) => r.key!),
    techBlogKeys: techBlogRecommendations
      .filter((r) => r.key)
      .map((r) => r.key!),
    aiKeys: aiRecommendations.filter((r) => r.key).map((r) => r.key!),
    geekKeys: geekRecommendations.filter((r) => r.key).map((r) => r.key!),
    articleUrls: discoveredArticleUrls,
    todayPickKeys: {
      backend: todayPick.backend?.key ?? null,
      techBlog: todayPick.techBlog?.key ?? null,
      ai: todayPick.ai?.key ?? null,
    },
  });

  // ── stdout JSON (Python 원본과 동일 형식) ─────────────────────────────────

  const discoveryOk = discoveryLog.filter((e) => e.status === "ok").length;
  const discoveryAttempted = discoveryLog.filter((e) =>
    ["ok", "no-match"].includes(e.status)
  ).length;

  console.log(
    JSON.stringify(
      {
        inventory: join(RUNTIME, "topic-inventory.json"),
        recommendation: join(RUNTIME, "morning-topic-recommendation.md"),
        backendCount: backendRecommendations.length,
        techBlogCount: techBlogRecommendations.length,
        aiCount: aiRecommendations.length,
        geekCount: geekRecommendations.length,
        discovery: {
          attempted: discoveryAttempted,
          ok: discoveryOk,
          cacheDir: FEED_CACHE_DIR,
        },
        history: HISTORY_PATH,
      },
      null,
      0
    )
  );
}

main().catch((err) => {
  console.error("refresh_topic_inventory error:", err);
  process.exit(1);
});
