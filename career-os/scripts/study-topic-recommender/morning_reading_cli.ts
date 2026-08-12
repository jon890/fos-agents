#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { externalReadingSources } from "../../config/external-reading-sources.js";
import {
  DEFAULT_MAX_CANDIDATES_PER_SOURCE,
  type MorningReadingReport,
} from "./reading_contracts.js";
import { normalizeReadingSources } from "./reading_sources.js";
import { prepareReadingCandidatePool, selectReadings } from "./reading_stage.js";
import { appendHistory, loadRecentHistory } from "./persistence/history.js";
import { renderExistingReport, writeReportArtifacts } from "./render/report.js";

const ROOT = process.env.CAREER_OS_ROOT
  ? resolve(process.env.CAREER_OS_ROOT)
  : resolve(import.meta.dir, "..", "..");
const STATE_DIR = join(ROOT, "state");
const REPORTS_DIR = join(ROOT, "reports");
const DOWNLOADS_DIR = join(REPORTS_DIR, "downloads");
const CACHE_DIR = join(ROOT, "cache", "feed-cache");
const REPORT_PATH = join(STATE_DIR, "morning-reading.json");
const HISTORY_PATH = join(STATE_DIR, "morning-reading-history.jsonl");
const CANDIDATE_POOL_PATH = join(STATE_DIR, "reading-candidates.json");

const FEED_CACHE_TTL_HOURS = 6;
const FEED_TIMEOUT_MS = 8_000;
const RECENT_ARTICLE_URL_LOOKBACK = 7;

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function run(): Promise<void> {
  mkdirSync(STATE_DIR, { recursive: true });
  mkdirSync(REPORTS_DIR, { recursive: true });
  mkdirSync(DOWNLOADS_DIR, { recursive: true });

  const readingSources = normalizeReadingSources(externalReadingSources);
  const recentArticleUrls = new Set(
    loadRecentHistory(HISTORY_PATH, RECENT_ARTICLE_URL_LOOKBACK)
      .flatMap((entry) => entry.articleUrls ?? [])
  );
  const candidatePool = await prepareReadingCandidatePool({
    readingSources,
    outputPath: CANDIDATE_POOL_PATH,
    cacheDir: CACHE_DIR,
    recentUrls: recentArticleUrls,
    candidatePoolPath: argumentValue("--candidate-pool"),
    cacheTtlHours: FEED_CACHE_TTL_HOURS,
    timeoutMs: FEED_TIMEOUT_MS,
    maxCandidatesPerSource: DEFAULT_MAX_CANDIDATES_PER_SOURCE,
  });

  if (process.argv.includes("--collect-only")) {
    console.log(JSON.stringify({
      mode: "collect-only",
      candidatePool: CANDIDATE_POOL_PATH,
      sourceCount: readingSources.sources.length,
      candidateCount: candidatePool.candidates.length,
      collectionLog: candidatePool.collectionLog,
    }));
    return;
  }

  const selectionPath = argumentValue("--reading-selection");
  if (!selectionPath) {
    throw new Error(
      "--reading-selection이 필요하다. 먼저 --collect-only로 외부 글을 수집한 뒤 모델 선택 파일을 제공해야 한다."
    );
  }
  const { recommendations } = selectReadings({
    pool: candidatePool,
    readingSources,
    selectionPath,
  });
  const sourcesWithCandidates = candidatePool.collectionLog
    .filter((entry) => entry.candidateCount > 0).length;
  const report: MorningReadingReport = {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: {
      config: "config/external-reading-sources.ts",
      collectedArticles: "state/reading-candidates.json",
    },
    counts: {
      activeSources: readingSources.sources.length,
      sourcesWithCandidates,
      collectedArticles: candidatePool.candidates.length,
      techBlogSources: readingSources.itemsByCategory.techBlog.length,
      geekSources: readingSources.itemsByCategory.geek.length,
    },
    collectionLog: candidatePool.collectionLog,
    recommendations,
  };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const artifacts = writeReportArtifacts({
    report,
    reportsDir: REPORTS_DIR,
    downloadsDir: DOWNLOADS_DIR,
  });
  appendHistory(HISTORY_PATH, {
    articleUrls: [
      ...recommendations.techBlog,
      ...recommendations.geek,
    ].map((item) => item.url),
  });

  console.log(JSON.stringify({
    report: REPORT_PATH,
    candidatePool: CANDIDATE_POOL_PATH,
    ...artifacts,
    techBlogCount: recommendations.techBlog.length,
    geekCount: recommendations.geek.length,
    sourcesAttempted: readingSources.sources.length,
    sourcesWithCandidates,
    candidateCount: candidatePool.candidates.length,
    history: HISTORY_PATH,
  }));
}

export async function main(): Promise<void> {
  if (process.argv.includes("--render-only")) {
    console.log(JSON.stringify({
      mode: "render-only",
      ...renderExistingReport({
        stateDir: STATE_DIR,
        reportsDir: REPORTS_DIR,
        downloadsDir: DOWNLOADS_DIR,
      }),
    }));
    return;
  }
  await run();
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("study-topic-recommender error:", error);
    process.exit(1);
  });
}
