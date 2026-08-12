#!/usr/bin/env bun
/**
 * 아침 읽을거리 추천 파이프라인 조립부.
 * 공개 진입점 refresh_topic_inventory.ts가 이 모듈의 main을 호출한다.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { scanFosStudyInventory } from "./fos_study_inventory.js";
import { deterministicDedupe, type DuplicateCandidateInput, type PossibleDuplicate } from "./duplicate_detection.js";
import { BACKEND_KEY_COOLDOWN_ENTRIES, countMap } from "./transform/scoring.js";
import { pickBackendRecommendations, buildUpdateExisting } from "./transform/recommend.js";
import {
  artifactDomainLabel,
  getUncoveredCurated,
  getRemainingLive,
  getRemainingLiveCandidates,
  getCandidateRecommendations,
} from "./transform/filter.js";
import { buildMorningMarkdown } from "./render/markdown.js";
import { buildMorningHtml, morningHtmlFilename } from "./render/html.js";
import type {
  StudyTopicEntry,
  TopicItem,
  LiveSeed,
} from "./transform/types.js";
import { loadReadingSources } from "./reading_sources.js";
import { prepareReadingCandidatePool, selectReadings } from "./reading_stage.js";
import { appendHistory, loadLatestKeys, loadRecentHistory } from "./state/history.js";
import { buildFosStudyFallbackCandidates } from "./transform/fos_study_fallback.js";
import { renderExistingInventory } from "./render/inventory.js";

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
const READING_CANDIDATES_PATH = join(STATE, "reading-candidates.json");
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

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function stripMetaTopics(raw: Record<string, StudyTopicEntry>): Record<string, StudyTopicEntry> {
  return Object.fromEntries(
    Object.entries(raw).filter(([key]) => key !== "_meta" && !key.startsWith("_"))
  ) as Record<string, StudyTopicEntry>;
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

  // 모든 외부 소스에서 후보를 결정적으로 수집한다.
  const articleUrlHistory = loadRecentHistory(HISTORY_PATH, RECENT_ARTICLE_URL_LOOKBACK);
  const recentArticleUrls = new Set<string>(
    articleUrlHistory.flatMap((entry) => entry.articleUrls ?? []).filter(Boolean) as string[]
  );
  const readingCandidatePool = await prepareReadingCandidatePool({
    readingSources,
    outputPath: READING_CANDIDATES_PATH,
    cacheDir: FEED_CACHE_DIR,
    recentUrls: recentArticleUrls,
    candidatePoolPath: argumentValue("--candidate-pool"),
    cacheTtlHours: FEED_CACHE_TTL_HOURS,
    timeoutMs: FEED_TIMEOUT_MS,
  });
  if (process.argv.includes("--collect-only")) {
    console.log(JSON.stringify({
      mode: "collect-only",
      candidatePool: READING_CANDIDATES_PATH,
      sourceCount: readingSources.sources.length,
      candidateCount: readingCandidatePool.candidates.length,
      collectionLog: readingCandidatePool.collectionLog,
    }));
    return;
  }
  const readingStage = selectReadings({
    pool: readingCandidatePool,
    readingSources,
    selectionPath: argumentValue("--reading-selection"),
  });
  const selectedReadings = readingStage.recommendations;
  const techBlogRecommendations = selectedReadings.techBlog;
  const aiRecommendations = selectedReadings.ai;
  const geekRecommendations = selectedReadings.geek;
  const readingSelectionMode = readingStage.selectionMode;

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
  const backendKeyHistory = loadRecentHistory(HISTORY_PATH, BACKEND_KEY_COOLDOWN_ENTRIES);
  const recentBackendKeyCounts = countMap(backendKeyHistory.flatMap((e) => e.keys ?? []));
  const yesterdayKeys = loadLatestKeys(HISTORY_PATH);

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
      sources: "외부 읽을거리 수집 대상",
    },
    reportPlan: {
      unit: "day",
      targetMinutes,
      backendSlots,
      categorySlots: Object.fromEntries(
        Object.entries(readingSources.categories).map(([key, value]) => [key, value.slots])
      ),
      readingSelectionMode,
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
      techBlogSources: readingSources.itemsByCategory.techBlog.length,
      aiSources: readingSources.itemsByCategory.ai.length,
      geekSources: readingSources.itemsByCategory.geek.length,
      readingCandidates: readingCandidatePool.candidates.length,
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
      candidatePool: "state/reading-candidates.json",
      collectionLog: readingCandidatePool.collectionLog,
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
      techBlogItems: readingSources.itemsByCategory.techBlog.length,
      aiTopicItems: readingSources.itemsByCategory.ai.length,
      geekNewsItems: readingSources.itemsByCategory.geek.length,
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

  appendHistory(HISTORY_PATH, {
    keys: backendRecommendations.filter((r) => r.key).map((r) => r.key!),
    techBlogKeys: techBlogRecommendations.filter((r) => r.key).map((r) => r.key!),
    aiKeys: aiRecommendations.filter((r) => r.key).map((r) => r.key!),
    geekKeys: geekRecommendations.filter((r) => r.key).map((r) => r.key!),
    articleUrls: discoveredArticleUrls,
  });

  // stdout JSON (Python 원본과 동일 형식)
  const sourcesWithCandidates = readingCandidatePool.collectionLog
    .filter((entry) => entry.candidateCount > 0).length;

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
        readingSelectionMode,
        discovery: {
          sourcesAttempted: readingSources.sources.length,
          sourcesWithCandidates,
          candidateCount: readingCandidatePool.candidates.length,
          cacheDir: FEED_CACHE_DIR,
        },
        history: HISTORY_PATH,
      },
      null,
      0
    )
  );
}

// ── entry point ───────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  const RENDER_ONLY = process.argv.includes("--render-only");
  if (RENDER_ONLY) {
    console.log(JSON.stringify({
      mode: "render-only",
      ...renderExistingInventory({
        stateDir: STATE,
        reportsDir: REPORTS,
        downloadsDir: DOWNLOADS,
      }),
    }));
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
