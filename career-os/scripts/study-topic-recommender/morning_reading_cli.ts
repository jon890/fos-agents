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
import {
  appendReportToHistory,
  historyContentKeys,
  loadMorningStudyHistory,
  loadReportForHistory,
  recentStudyTopicKeys,
  resolveMorningStudyHistoryPath,
} from "./persistence/history.js";
import { renderExistingReport, writeReportArtifacts } from "./render/report.js";
import { resolveStudyRunRoot, StudyRunPathError } from "./runtime-paths.js";
import { StudyLibraryApiError, createStudyLibraryClient } from "./study-library/client.js";
import { collectAndIngestStudyLibrary, type LibraryCollectMode } from "./study-library/ingestion.js";
import { syncStudyLibrarySources } from "./study-library/source-sync.js";

const FEED_CACHE_TTL_HOURS = 6;
const FEED_TIMEOUT_MS = 8_000;

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parseMode(): LibraryCollectMode {
  const mode = argumentValue("--mode") ?? "recent";
  if (mode !== "recent" && mode !== "archive") {
    throw new StudyRunPathError("--mode는 recent 또는 archive여야 한다.");
  }
  return mode;
}

function parseMaxItems(): number {
  const raw = argumentValue("--max-items");
  if (!raw) return DEFAULT_MAX_CANDIDATES_PER_SOURCE;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new StudyRunPathError("--max-items는 0 이상의 정수여야 한다.");
  }
  return value;
}

function assertLibraryUsage(mode: LibraryCollectMode): void {
  if (!hasFlag("--collect-only")) {
    throw new StudyRunPathError("--library는 현재 --collect-only와 함께 사용해야 한다.");
  }
  for (const flag of ["--history-file", "--commit-history", "--render-only"]) {
    if (hasFlag(flag)) {
      throw new StudyRunPathError(`--library --collect-only는 ${flag}와 함께 사용할 수 없다.`);
    }
  }
  if (hasFlag("--reset-cursor")) {
    if (mode !== "archive" || !argumentValue("--source-key")) {
      throw new StudyRunPathError("--reset-cursor는 --library --collect-only --mode archive --source-key <key> 조합에서만 사용할 수 있다.");
    }
  }
}

async function runLibraryCollectOnly(readingSources: ReturnType<typeof normalizeReadingSources>): Promise<void> {
  const mode = parseMode();
  assertLibraryUsage(mode);
  const client = createStudyLibraryClient();
  await syncStudyLibrarySources(client);
  const result = await collectAndIngestStudyLibrary({
    client,
    sources: readingSources.sources,
    mode,
    sourceKey: argumentValue("--source-key"),
    maxItems: parseMaxItems(),
    resetCursor: hasFlag("--reset-cursor"),
    timeoutMs: FEED_TIMEOUT_MS,
    youtubeApiKey: process.env.YOUTUBE_DATA_API_KEY,
  });
  console.log(JSON.stringify(result));
}

async function run(root: string, historyPath: string): Promise<void> {
  const stateDir = join(root, "state");
  const cacheDir = join(root, "cache", "feed-cache");
  const reportPath = join(stateDir, "morning-reading.json");
  const candidatePoolPath = join(stateDir, "reading-candidates.json");
  mkdirSync(stateDir, { recursive: true });

  const readingSources = normalizeReadingSources(externalReadingSources);
  const history = loadMorningStudyHistory(historyPath);
  const previousContentKeys = historyContentKeys(history);
  const candidatePool = await prepareReadingCandidatePool({
    readingSources,
    outputPath: candidatePoolPath,
    cacheDir,
    previousContentKeys,
    recentStudyTopicKeys: recentStudyTopicKeys(history),
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
  const { topics } = selectReadings({
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
    topics,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const artifacts = writeReportArtifacts({
    report,
    outputDir: root,
  });
  const recommendations = topics.flatMap((topic) => topic.items);

  console.log(JSON.stringify({
    report: reportPath,
    candidatePool: candidatePoolPath,
    ...artifacts,
    topicCount: topics.length,
    techBlogCount: recommendations.filter((item) => item.category === "techBlog").length,
    geekCount: recommendations.filter((item) => item.category === "geek").length,
    aiCount: recommendations.filter((item) => item.category === "ai").length,
    videoCount: recommendations.filter((item) => item.category === "video").length,
    sourcesAttempted: readingSources.sources.length,
    sourcesWithCandidates,
    candidateCount: candidatePool.candidates.length,
    history: historyPath,
  }));
}

export async function main(): Promise<void> {
  const root = resolveStudyRunRoot(process.env, argumentValue("--run-dir"));
  const readingSources = normalizeReadingSources(externalReadingSources);
  if (hasFlag("--library")) {
    await runLibraryCollectOnly(readingSources);
    return;
  }
  const stateDir = join(root, "state");
  if (hasFlag("--render-only")) {
    console.log(JSON.stringify({
      mode: "render-only",
      ...renderExistingReport({
        stateDir,
        outputDir: root,
      }),
    }));
    return;
  }
  const historyPath = resolveMorningStudyHistoryPath(argumentValue("--history-file"));
  if (hasFlag("--commit-history")) {
    const reportPath = join(stateDir, "morning-reading.json");
    const history = appendReportToHistory(historyPath, loadReportForHistory(reportPath));
    console.log(JSON.stringify({
      mode: "commit-history",
      history: historyPath,
      reportCount: history.reports.length,
      entryCount: history.entries.length,
    }));
    return;
  }
  await run(root, historyPath);
}

export function reportMorningReadingError(error: unknown): never {
  if (error instanceof StudyRunPathError) {
    console.error(error.message);
    process.exit(error.exitCode);
  }
  if (error instanceof StudyLibraryApiError) {
    console.error(JSON.stringify({
      error: {
        code: error.code ?? `HTTP_${error.status}`,
        requestId: error.requestId ?? null,
      },
    }));
    process.exit(1);
  }
  console.error("study-topic-recommender error:", error);
  process.exit(1);
}

if (import.meta.main) {
  main().catch(reportMorningReadingError);
}
