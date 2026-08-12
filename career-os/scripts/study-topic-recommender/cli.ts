#!/usr/bin/env bun
/**
 * morning topic recommendation pipeline — CLI entry point.
 * ADR-035: god-script 분해 컨벤션 적용.
 *
 * ADR-009: reservoir-based, file-backed.
 * ADR-010: score-based backend selection with mix targets.
 * 하루 읽기 설정에 따라 카테고리별 추천 수를 조정한다.
 * ADR-013: secondary 카테고리에 RSS/Atom discovery로 실제 최신 글 1편을 부착.
 * ADR-033: sources/fos-study를 generated study artifact 단일 진실원으로 사용.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { discoverForItem, type ReservoirItem } from "./feed_discovery.js";
import { scanFosStudyInventory, type FosStudyInventoryItem } from "./fos_study_inventory.js";
import { deterministicDedupe, type DuplicateCandidateInput, type PossibleDuplicate } from "./duplicate_detection.js";
import {
  SECONDARY_COOLDOWN_ENTRIES,
  BACKEND_KEY_COOLDOWN_ENTRIES,
  countMap,
} from "./transform/scoring.js";
import { pickBackendRecommendations, pickSecondary, buildUpdateExisting } from "./transform/recommend.js";
import {
  artifactDomainLabel,
  getUncoveredCurated,
  getRemainingLive,
  getRemainingLiveCandidates,
  getCandidateRecommendations,
  collectRecentKeys,
} from "./transform/filter.js";
import { buildMorningMarkdown } from "./render/markdown.js";
import { buildMorningHtml, morningHtmlFilename } from "./render/html.js";
import type {
  StudyTopicEntry,
  TopicItem,
  BackendItem,
  LiveSeed,
  HistoryEntry,
  DiscoveryLogEntry,
  Recommendation,
  UpdateExistingItem,
} from "./transform/types.js";
import { loadReadingSources } from "./reading_sources.js";

// ── paths ─────────────────────────────────────────────────────────────────────

// career-os root = 이 스크립트(career-os/scripts/<skill>/)에서 2단계 위.
// CAREER_OS_ROOT env가 있으면 우선 — 어떤 체크아웃 위치에서도 동작 (하드코딩 제거).
const TASK_ROOT = process.env.CAREER_OS_ROOT
  ? resolve(process.env.CAREER_OS_ROOT)
  : resolve(import.meta.dir, "..", "..");
const CONFIG = join(TASK_ROOT, "config");
const STATE = join(TASK_ROOT, "state");
const REPORTS = join(TASK_ROOT, "reports");
const DOWNLOADS = join(REPORTS, "downloads");
const CACHE = join(TASK_ROOT, "cache");
const FOS_STUDY_ROOT = join(TASK_ROOT, "sources", "fos-study");
const HISTORY_PATH = join(STATE, "topic-inventory-history.jsonl");
const FEED_CACHE_DIR = join(CACHE, "feed-cache");
const FEED_CACHE_TTL_HOURS = 6;
const FEED_TIMEOUT_MS = 8_000;
const RECENT_ARTICLE_URL_LOOKBACK = 7;

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

function stripMetaTopics(raw: Record<string, StudyTopicEntry>): Record<string, StudyTopicEntry> {
  return Object.fromEntries(
    Object.entries(raw).filter(([key]) => key !== "_meta" && !key.startsWith("_"))
  ) as Record<string, StudyTopicEntry>;
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fallbackKeyFromPath(path: string): string {
  return `fos-study-${path.replace(/\.md$/i, "").replace(/[^a-z0-9가-힣]+/gi, "-").replace(/^-+|-+$/g, "")}`;
}

function buildFosStudyFallbackCandidates(items: FosStudyInventoryItem[]): TopicItem[] {
  return items
    .filter((item) => item.path.endsWith(".md"))
    .filter((item) => !item.path.startsWith("interview/"))
    .filter((item) => item.slug.toLowerCase() !== "readme")
    .map((item) => ({
      key: fallbackKeyFromPath(item.path),
      title: item.titleCandidate ?? titleFromSlug(item.slug),
      domain: item.domainCandidate ?? "fos-study",
      outputPath: item.path,
      source: "fos-study-derived",
      tag: "deepen",
      difficulty: "중",
      estMinutes: 35,
      whyNow: [
        "sources/fos-study에 이미 있는 학습 문서라서 보강이나 복습 출발점으로 쓸 수 있다",
        "config 후보가 부족해도 실제 파일 inventory 기반으로 deterministic fallback을 유지한다",
      ],
    }));
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

function appendHistory(payload: Omit<HistoryEntry, "generatedAt">): void {
  const entry: HistoryEntry = {
    generatedAt: new Date().toISOString(),
    ...payload,
  };
  appendFileSync(HISTORY_PATH, JSON.stringify(entry, null, 0) + "\n", "utf-8");
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

// ── pipeline ──────────────────────────────────────────────────────────────────

async function runPipeline(): Promise<void> {
  mkdirSync(REPORTS, { recursive: true });
  mkdirSync(DOWNLOADS, { recursive: true });

  // load config as optional override/seed/fallback, never as the canonical inventory
  const studyTopicsRaw = safeLoad<Record<string, StudyTopicEntry>>(
    join(CONFIG, "study-pack-topics.json"),
    {}
  );
  const studyTopics = stripMetaTopics(studyTopicsRaw);
  const studyCandidates = safeLoad<{ topics?: TopicItem[] }>(
    join(STATE, "study-pack-candidates.json"),
    { topics: [] }
  ).topics ?? [];
  const liveSeeds: LiveSeed[] = safeLoad<{ seeds?: LiveSeed[] }>(
    join(CONFIG, "live-coding-seed-pool.json"),
    { seeds: [] }
  ).seeds ?? [];
  const liveSeedCandidates: LiveSeed[] = safeLoad<{ seeds?: LiveSeed[] }>(
    join(CONFIG, "live-coding-seed-candidates.json"),
    { seeds: [] }
  ).seeds ?? [];
  const readingSources = loadReadingSources(join(CONFIG, "external-reading-sources.json"));
  const studyPreferences = safeLoad<{
    morning_report?: { backend_slots?: number; target_minutes?: number };
  }>(join(CONFIG, "study-preferences.json"), {});
  const backendSlots = Math.max(
    0,
    Math.min(5, Math.floor(studyPreferences.morning_report?.backend_slots ?? 1))
  );
  const targetMinutes = Math.max(
    15,
    Math.floor(studyPreferences.morning_report?.target_minutes ?? 120)
  );
  const techBlogItems: ReservoirItem[] = readingSources.itemsByCategory.techBlog;
  const aiTopicItems: ReservoirItem[] = readingSources.itemsByCategory.ai;
  const geekNewsItems: ReservoirItem[] = readingSources.itemsByCategory.geek;

  // 외부 읽을거리를 먼저 수집한다. 로컬 후보 풀 계산은 외부 수집이 끝난 뒤 수행한다.
  const recentHistory = loadRecentHistory(SECONDARY_COOLDOWN_ENTRIES);
  const recentTechBlogKeys = collectRecentKeys(recentHistory, "techBlogKeys");
  const recentAiKeys = collectRecentKeys(recentHistory, "aiKeys");
  const recentGeekKeys = collectRecentKeys(recentHistory, "geekKeys");
  const articleUrlHistory = loadRecentHistory(RECENT_ARTICLE_URL_LOOKBACK);
  const recentArticleUrls = new Set<string>(
    articleUrlHistory.flatMap((entry) => entry.articleUrls ?? []).filter(Boolean) as string[]
  );
  const aiRecommendations = pickSecondary(
    aiTopicItems,
    recentAiKeys,
    readingSources.categories.ai.slots
  );
  const geekRecommendations = pickSecondary(
    geekNewsItems,
    recentGeekKeys,
    readingSources.categories.geek.slots
  );
  const discoveryExclude = new Set(recentArticleUrls);
  let techBlogRecommendations: Recommendation[];
  let techBlogDiscoveryLog: DiscoveryLogEntry[];
  if (readingSources.categories.techBlog.requireDiscoveredArticle) {
    [techBlogRecommendations, techBlogDiscoveryLog] = await pickTechBlogArticles(
      techBlogItems,
      recentTechBlogKeys,
      readingSources.categories.techBlog.slots,
      discoveryExclude
    );
  } else {
    techBlogRecommendations = pickSecondary(
      techBlogItems,
      recentTechBlogKeys,
      readingSources.categories.techBlog.slots
    );
    techBlogDiscoveryLog = await attachDiscoveredArticles(
      techBlogRecommendations,
      discoveryExclude
    );
  }

  let discoveryLog: DiscoveryLogEntry[] = [...techBlogDiscoveryLog];
  for (const group of [geekRecommendations, aiRecommendations]) {
    const groupLog = await attachDiscoveredArticles(group, discoveryExclude);
    discoveryLog = discoveryLog.concat(groupLog);
  }

  // fos-study scan (ADR-033 / ADR-069): actual files are the source of truth.
  const fosInventory = scanFosStudyInventory({ root: FOS_STUDY_ROOT });
  const fosStudyPaths = new Set(fosInventory.markdownPathsRelative);

  // deterministic dedupe (ADR-033)
  const dedupeInputs: DuplicateCandidateInput[] = [
    ...Object.entries(studyTopics)
      .filter(([, entry]) => entry.outputPath)
      .map(([key, entry]) => ({ key, candidatePath: entry.outputPath! })),
    ...studyCandidates
      .filter((item) => item.outputPath)
      .map((item) => ({ key: item.key ?? "", candidatePath: item.outputPath! })),
    ...studyCandidates
      .filter((item) => item.promotionTarget?.outputPath)
      .map((item) => ({ key: item.key ?? "", candidatePath: item.promotionTarget!.outputPath! })),
  ];
  const dedupeResult = deterministicDedupe(dedupeInputs, fosInventory.markdownPathsRelative);
  const deterministicUpdateExisting: PossibleDuplicate[] = [
    ...dedupeResult.exactPathMatches.map((p) => ({
      ...p,
      reason: "exact path already exists in fos-study",
    })),
    ...dedupeResult.normalizedPathMatches.map((p) => ({
      ...p,
      reason: "normalized path already exists in fos-study",
    })),
    ...dedupeResult.possibleDuplicates,
  ];
  const deterministicDuplicateKeys = new Set(deterministicUpdateExisting.map((item) => item.key));

  // derived sets
  const uncoveredCurated = getUncoveredCurated(studyTopics, fosStudyPaths);
  const remainingLive = getRemainingLive(liveSeeds, fosStudyPaths);
  const remainingLiveCandidates = getRemainingLiveCandidates(liveSeedCandidates, fosStudyPaths);
  const candidateRecommendations = getCandidateRecommendations(studyCandidates, fosStudyPaths)
    .filter((item) => !deterministicDuplicateKeys.has(item.key ?? ""));
  const fosStudyFallbackCandidates = buildFosStudyFallbackCandidates(fosInventory.items);
  const backendCandidatePool =
    candidateRecommendations.length > 0 ? candidateRecommendations : fosStudyFallbackCandidates;

  // recentDomainCounts — fos-study mtime fallback (ADR-033)
  const withMtime = fosInventory.markdownPathsRelative.map((p) => {
    let mtime = 0;
    try { mtime = statSync(join(FOS_STUDY_ROOT, p)).mtime.getTime(); } catch {}
    return { path: p, mtime };
  });
  withMtime.sort((a, b) => b.mtime - a.mtime);
  const recentDomainCounts = countMap(
    withMtime.slice(0, 10).map(({ path }) => artifactDomainLabel(path))
  );

  // 백엔드 후보 이력
  const backendKeyHistory = loadRecentHistory(BACKEND_KEY_COOLDOWN_ENTRIES);
  const recentBackendKeyCounts = countMap(backendKeyHistory.flatMap((e) => e.keys ?? []));
  const yesterdayKeys = loadYesterdayKeys();

  // 외부 읽을거리 다음에 백엔드 공부 후보를 계산한다.
  const backendRecommendations = pickBackendRecommendations(
    yesterdayKeys,
    backendCandidatePool,
    remainingLive,
    remainingLiveCandidates,
    recentDomainCounts,
    recentBackendKeyCounts,
    backendSlots
  );

  // write topic-inventory.json (ADR-033 새 스냅샷 스키마)
  const generatedAt = new Date().toISOString();
  const inventory = {
    generatedAt,
    sourceOfTruth: {
      kind: "fos-study",
      root: "sources/fos-study",
      scannedMarkdownCount: fosInventory.scannedMarkdownCount,
      excludedDirs: fosInventory.excludedDirs,
    },
    configRole: {
      studyPackTopics: "override/fallback 후보",
      studyPackCandidates: "seed/fallback 후보",
      liveCodingSeeds: "사람이 고른 seed 후보",
      sources: "외부 reading reservoir",
    },
    reportPlan: {
      unit: "day",
      targetMinutes,
      backendSlots,
      categorySlots: Object.fromEntries(
        Object.entries(readingSources.categories).map(([key, value]) => [key, value.slots])
      ),
    },
    counts: {
      configStudyTopicOverrides: Object.keys(studyTopics).length,
      configStudyTopicFallbackCandidates: studyCandidates.length,
      derivedFosStudyFallbackCandidates: fosStudyFallbackCandidates.length,
      existingFosStudyMarkdownFiles: fosInventory.scannedMarkdownCount,
      remainingCuratedStudyTopics: uncoveredCurated.length,
      remainingCandidateStudyTopics: candidateRecommendations.length,
      remainingLiveCodingSeeds: remainingLive.length,
      remainingLiveCodingCandidateSeeds: remainingLiveCandidates.length,
      duplicateCandidates: dedupeResult.possibleDuplicates.length,
      techBlogReservoir: techBlogItems.length,
      aiReservoir: aiTopicItems.length,
      geekReservoir: geekNewsItems.length,
    },
    remaining: {
      curatedStudyTopicKeys: uncoveredCurated.map((t) => t.key),
      candidateStudyTopicKeys: candidateRecommendations.map((t) => t.key),
      liveCodingSlugs: remainingLive.map((s) => s.slug),
    },
    pools: {
      remainingLiveCodingSeeds: remainingLive,
      remainingLiveCodingCandidateSeeds: remainingLiveCandidates,
      configStudyTopicFallbackCandidates: candidateRecommendations,
      derivedFosStudyFallbackCandidates: fosStudyFallbackCandidates.slice(0, 20),
    },
    excluded: dedupeResult,
    claudeDuplicateReview: {
      status: "skipped",
      reviewedAt: null,
      items: [],
    },
    recommendations: backendRecommendations,
    techBlogRecommendations,
    aiRecommendations,
    geekRecommendations,
    updateExistingRecommendations: buildUpdateExisting(
      { status: "skipped", items: [] },
      deterministicUpdateExisting
    ),
    discovery: {
      cacheDir: FEED_CACHE_DIR,
      cacheTtlHours: FEED_CACHE_TTL_HOURS,
      log: discoveryLog,
    },
  };

  writeFileSync(
    join(STATE, "topic-inventory.json"),
    JSON.stringify(inventory, null, 2) + "\n",
    "utf-8"
  );

  // write morning-topic-recommendation.md
  const updateExisting = buildUpdateExisting(
    { status: "skipped", items: [] },
    deterministicUpdateExisting
  );

  const mdContent = buildMorningMarkdown(
    backendRecommendations,
    techBlogRecommendations,
    aiRecommendations,
    geekRecommendations,
    updateExisting,
    "skipped",
    {
      uncoveredCurated: uncoveredCurated.length,
      remainingLive: remainingLive.length,
      remainingLiveCandidates: remainingLiveCandidates.length,
      techBlogItems: techBlogItems.length,
      aiTopicItems: aiTopicItems.length,
      geekNewsItems: geekNewsItems.length,
      scannedMarkdownCount: fosInventory.scannedMarkdownCount,
      possibleDuplicates: dedupeResult.possibleDuplicates.length,
    }
  );

  writeFileSync(join(REPORTS, "morning-topic-recommendation.md"), mdContent, "utf-8");
  const htmlPath = join(DOWNLOADS, morningHtmlFilename(generatedAt));
  writeFileSync(
    htmlPath,
    buildMorningHtml({
      generatedAt,
      recommendations: backendRecommendations,
      techBlogRecommendations,
      aiRecommendations,
      geekRecommendations,
      targetMinutes,
      reviewStatus: "skipped",
      updateExistingCount: updateExisting.length,
    }),
    "utf-8"
  );

  // append history
  const discoveredArticleUrls: string[] = [];
  for (const group of [techBlogRecommendations, aiRecommendations, geekRecommendations]) {
    for (const item of group) {
      const url = item.discoveredArticle?.url;
      if (url) discoveredArticleUrls.push(url);
    }
  }

  appendHistory({
    keys: backendRecommendations.filter((r) => r.key).map((r) => r.key!),
    techBlogKeys: techBlogRecommendations.filter((r) => r.key).map((r) => r.key!),
    aiKeys: aiRecommendations.filter((r) => r.key).map((r) => r.key!),
    geekKeys: geekRecommendations.filter((r) => r.key).map((r) => r.key!),
    articleUrls: discoveredArticleUrls,
  });

  // stdout JSON (Python 원본과 동일 형식)
  const discoveryOk = discoveryLog.filter((e) => e.status === "ok").length;
  const discoveryAttempted = discoveryLog.filter((e) =>
    ["ok", "no-match"].includes(e.status)
  ).length;

  console.log(
    JSON.stringify(
      {
        inventory: join(STATE, "topic-inventory.json"),
        recommendation: join(REPORTS, "morning-topic-recommendation.md"),
        html: htmlPath,
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

// ── render-only mode (ADR-033) ────────────────────────────────────────────────

async function renderOnly(): Promise<void> {
  mkdirSync(REPORTS, { recursive: true });
  mkdirSync(DOWNLOADS, { recursive: true });
  const inventoryPath = join(STATE, "topic-inventory.json");
  if (!existsSync(inventoryPath)) {
    console.error("render-only error: topic-inventory.json 없음 — 먼저 일반 refresh를 실행하세요.");
    process.exit(1);
  }

  const inventory = readJson<{
    generatedAt?: string;
    recommendations?: BackendItem[];
    techBlogRecommendations?: Recommendation[];
    aiRecommendations?: Recommendation[];
    geekRecommendations?: Recommendation[];
    claudeDuplicateReview?: { status: string; items?: UpdateExistingItem[] };
    excluded?: { possibleDuplicates?: PossibleDuplicate[] };
    counts?: {
      remainingCuratedStudyTopics?: number;
      remainingLiveCodingSeeds?: number;
      remainingLiveCodingCandidateSeeds?: number;
      techBlogReservoir?: number;
      aiReservoir?: number;
      geekReservoir?: number;
      duplicateCandidates?: number;
    };
    sourceOfTruth?: { scannedMarkdownCount?: number };
    reportPlan?: { targetMinutes?: number };
  }>(inventoryPath);

  const review = inventory.claudeDuplicateReview ?? { status: "skipped", items: [] };
  const possibleDuplicates = inventory.excluded?.possibleDuplicates ?? [];
  const updateExisting = buildUpdateExisting(review, possibleDuplicates);

  const mdContent = buildMorningMarkdown(
    inventory.recommendations ?? [],
    inventory.techBlogRecommendations ?? [],
    inventory.aiRecommendations ?? [],
    inventory.geekRecommendations ?? [],
    updateExisting,
    review.status,
    {
      uncoveredCurated: inventory.counts?.remainingCuratedStudyTopics ?? 0,
      remainingLive: inventory.counts?.remainingLiveCodingSeeds ?? 0,
      remainingLiveCandidates: inventory.counts?.remainingLiveCodingCandidateSeeds ?? 0,
      techBlogItems: inventory.counts?.techBlogReservoir ?? 0,
      aiTopicItems: inventory.counts?.aiReservoir ?? 0,
      geekNewsItems: inventory.counts?.geekReservoir ?? 0,
      scannedMarkdownCount: inventory.sourceOfTruth?.scannedMarkdownCount ?? 0,
      possibleDuplicates: inventory.counts?.duplicateCandidates ?? 0,
    }
  );

  writeFileSync(join(REPORTS, "morning-topic-recommendation.md"), mdContent, "utf-8");
  const htmlPath = join(DOWNLOADS, morningHtmlFilename(inventory.generatedAt));
  writeFileSync(
    htmlPath,
    buildMorningHtml({
      generatedAt: inventory.generatedAt,
      recommendations: inventory.recommendations ?? [],
      techBlogRecommendations: inventory.techBlogRecommendations ?? [],
      aiRecommendations: inventory.aiRecommendations ?? [],
      geekRecommendations: inventory.geekRecommendations ?? [],
      targetMinutes: inventory.reportPlan?.targetMinutes,
      reviewStatus: review.status,
      updateExistingCount: updateExisting.length,
    }),
    "utf-8"
  );
  console.log(JSON.stringify({
    mode: "render-only",
    inventory: inventoryPath,
    markdown: join(REPORTS, "morning-topic-recommendation.md"),
    html: htmlPath,
    reviewStatus: review.status,
    updateExistingCount: updateExisting.length,
  }, null, 0));
}

// ── entry point ───────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  const RENDER_ONLY = process.argv.includes("--render-only");
  if (RENDER_ONLY) {
    await renderOnly();
  } else {
    await runPipeline();
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("study-topic-recommender error:", err);
    process.exit(1);
  });
}
