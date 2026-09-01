#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { externalReadingSources } from "../../config/external-reading-sources.js";
import {
  DEFAULT_MAX_CANDIDATES_PER_SOURCE,
  type MorningReadingReport,
} from "./reading_contracts.js";
import { normalizeReadingSources } from "./reading_sources.js";
import { prepareReadingCandidatePool, selectReadings } from "./reading_stage.js";
import { appendHistory, loadRecentHistory } from "./persistence/history.js";
import { renderExistingReport, writeReportArtifacts } from "./render/report.js";
import { resolveStudyRunRoot, StudyRunPathError } from "./runtime-paths.js";

const FEED_CACHE_TTL_HOURS = 6;
const FEED_TIMEOUT_MS = 8_000;
const RECENT_ARTICLE_URL_LOOKBACK = 7;

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function run(root: string): Promise<void> {
  const stateDir = join(root, "state");
  const cacheDir = join(root, "cache", "feed-cache");
  const reportPath = join(stateDir, "morning-reading.json");
  const historyPath = join(stateDir, "morning-reading-history.jsonl");
  const candidatePoolPath = join(stateDir, "reading-candidates.json");
  mkdirSync(stateDir, { recursive: true });

  const readingSources = normalizeReadingSources(externalReadingSources);
  const recentArticleUrls = new Set(
    loadRecentHistory(historyPath, RECENT_ARTICLE_URL_LOOKBACK)
      .flatMap((entry) => entry.articleUrls ?? [])
  );
  const candidatePool = await prepareReadingCandidatePool({
    readingSources,
    outputPath: candidatePoolPath,
    cacheDir,
    recentUrls: recentArticleUrls,
    candidatePoolPath: argumentValue("--candidate-pool"),
    cacheTtlHours: FEED_CACHE_TTL_HOURS,
    timeoutMs: FEED_TIMEOUT_MS,
    maxCandidatesPerSource: DEFAULT_MAX_CANDIDATES_PER_SOURCE,
  });

  if (process.argv.includes("--collect-only")) {
    console.log(JSON.stringify({
      mode: "collect-only",
      candidatePool: candidatePoolPath,
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
      aiSources: readingSources.itemsByCategory.ai.length,
      videoSources: readingSources.itemsByCategory.video.length,
    },
    collectionLog: candidatePool.collectionLog,
    recommendations,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const artifacts = writeReportArtifacts({
    report,
    outputDir: root,
  });
  appendHistory(historyPath, {
    articleUrls: [
      ...recommendations.techBlog,
      ...recommendations.geek,
      ...recommendations.ai,
      ...recommendations.video,
    ].map((item) => item.url),
  });

  console.log(JSON.stringify({
    report: reportPath,
    candidatePool: candidatePoolPath,
    ...artifacts,
    techBlogCount: recommendations.techBlog.length,
    geekCount: recommendations.geek.length,
    aiCount: recommendations.ai.length,
    videoCount: recommendations.video.length,
    sourcesAttempted: readingSources.sources.length,
    sourcesWithCandidates,
    candidateCount: candidatePool.candidates.length,
    history: historyPath,
  }));
}

export async function main(): Promise<void> {
  const root = resolveStudyRunRoot();
  const stateDir = join(root, "state");
  if (process.argv.includes("--render-only")) {
    console.log(JSON.stringify({
      mode: "render-only",
      ...renderExistingReport({
        stateDir,
        outputDir: root,
      }),
    }));
    return;
  }
  await run(root);
}

export function reportMorningReadingError(error: unknown): never {
  if (error instanceof StudyRunPathError) {
    console.error(error.message);
    process.exit(error.exitCode);
  }
  console.error("study-topic-recommender error:", error);
  process.exit(1);
}

if (import.meta.main) {
  main().catch(reportMorningReadingError);
}
