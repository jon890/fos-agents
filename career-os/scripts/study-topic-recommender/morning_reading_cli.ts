#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { externalReadingSources } from "../../config/external-reading-sources.js";
import {
  DEFAULT_MAX_CANDIDATES_PER_SOURCE,
  type MorningReadingReport,
} from "./reading_contracts.js";
import { loadReadingCandidatePool } from "./reading_candidate_pool.js";
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
import {
  buildReportCountsFromLibrary,
  prepareStudyLibraryCandidates,
  studyLibraryMetaPath,
  type StudyLibraryCandidateMeta,
} from "./study-library/candidates.js";
import { collectAndIngestStudyLibrary, type LibraryCollectMode } from "./study-library/ingestion.js";
import {
  commitRecommendationRun,
  recordPublication,
} from "./study-library/recommendations.js";
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

function requiredArgument(name: string): string {
  const value = argumentValue(name);
  if (!value?.trim()) throw new StudyRunPathError(`${name} 값이 필요하다.`);
  return value;
}

function parseCandidateLimit(): number | undefined {
  const raw = argumentValue("--limit");
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new StudyRunPathError("--limit은 정수여야 한다.");
  return value;
}

function assertLibraryUsage(): void {
  for (const flag of ["--history-file", "--commit-history", "--render-only"]) {
    if (hasFlag(flag)) {
      throw new StudyRunPathError(`--library는 ${flag}와 함께 사용할 수 없다.`);
    }
  }
  const actionCount = [
    hasFlag("--collect-only"),
    hasFlag("--prepare-candidates"),
    Boolean(argumentValue("--reading-selection")),
    hasFlag("--commit-recommendation"),
    hasFlag("--record-publication"),
  ].filter(Boolean).length;
  if (actionCount !== 1) {
    throw new StudyRunPathError("--library는 collect, prepare-candidates, reading-selection, commit-recommendation, record-publication 중 하나만 실행해야 한다.");
  }
}

function assertLibraryCollectUsage(mode: LibraryCollectMode): void {
  if (hasFlag("--reset-cursor")) {
    if (mode !== "archive" || !argumentValue("--source-key")) {
      throw new StudyRunPathError("--reset-cursor는 --library --collect-only --mode archive --source-key <key> 조합에서만 사용할 수 있다.");
    }
  }
}

async function runLibraryCollectOnly(readingSources: ReturnType<typeof normalizeReadingSources>): Promise<void> {
  const mode = parseMode();
  assertLibraryCollectUsage(mode);
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

async function runLibraryPrepareCandidates(root: string): Promise<void> {
  const client = createStudyLibraryClient();
  const candidatePoolPath = join(root, "state", "reading-candidates.json");
  const result = await prepareStudyLibraryCandidates({
    client,
    outputPath: candidatePoolPath,
    filters: {
      sourceKey: argumentValue("--source-key"),
      category: argumentValue("--category") as StudyLibraryCandidateMeta["filters"]["category"],
      publishedFrom: argumentValue("--published-from"),
      publishedTo: argumentValue("--published-to"),
      limit: parseCandidateLimit(),
      cursor: argumentValue("--cursor"),
    },
  });
  console.log(JSON.stringify({
    mode: "prepare-candidates",
    library: true,
    candidatePool: result.candidatePoolPath,
    meta: result.metaPath,
    candidateCount: result.candidateCount,
    historyVersion: result.historyVersion,
    nextCursor: result.nextCursor,
  }));
}

function loadStudyLibraryMeta(candidatePoolPath: string): StudyLibraryCandidateMeta {
  return JSON.parse(readFileSync(studyLibraryMetaPath(candidatePoolPath), "utf8")) as StudyLibraryCandidateMeta;
}

async function runLibrarySelection(root: string): Promise<void> {
  const stateDir = join(root, "state");
  const reportPath = join(stateDir, "morning-reading.json");
  const candidatePoolPath = resolve(requiredArgument("--candidate-pool"));
  const candidatePool = loadReadingCandidatePool(candidatePoolPath);
  const meta = loadStudyLibraryMeta(candidatePoolPath);
  const { topics } = selectReadings({
    pool: candidatePool,
    selectionPath: requiredArgument("--reading-selection"),
  });
  const report: MorningReadingReport = {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: {
      config: "config/external-reading-sources.ts",
      collectedArticles: "state/reading-candidates.json",
    },
    counts: buildReportCountsFromLibrary({ candidatePool, meta }),
    collectionLog: candidatePool.collectionLog,
    topics,
  };
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const artifacts = writeReportArtifacts({
    report,
    outputDir: root,
  });
  console.log(JSON.stringify({
    mode: "reading-selection",
    library: true,
    report: reportPath,
    html: artifacts.htmlPath,
    topicCount: topics.length,
  }));
}

async function runLibraryCommitRecommendation(): Promise<void> {
  const client = createStudyLibraryClient();
  const result = await commitRecommendationRun({
    client,
    reportPath: requiredArgument("--report"),
  });
  console.log(JSON.stringify({
    mode: "commit-recommendation",
    library: true,
    reportId: result.reportId,
    historyVersion: result.historyVersion,
  }));
}

async function runLibraryRecordPublication(): Promise<void> {
  const client = createStudyLibraryClient();
  const result = await recordPublication({
    client,
    reportId: requiredArgument("--report-id"),
    channel: requiredArgument("--channel"),
    externalId: requiredArgument("--external-id"),
    publishedAt: requiredArgument("--published-at"),
    url: requiredArgument("--url"),
  });
  console.log(JSON.stringify({
    mode: "record-publication",
    library: true,
    publicationId: result.publicationId,
  }));
}

async function runLibrary(root: string, readingSources: ReturnType<typeof normalizeReadingSources>): Promise<void> {
  assertLibraryUsage();
  if (hasFlag("--collect-only")) {
    await runLibraryCollectOnly(readingSources);
    return;
  }
  if (hasFlag("--prepare-candidates")) {
    await runLibraryPrepareCandidates(root);
    return;
  }
  if (argumentValue("--reading-selection")) {
    await runLibrarySelection(root);
    return;
  }
  if (hasFlag("--commit-recommendation")) {
    await runLibraryCommitRecommendation();
    return;
  }
  if (hasFlag("--record-publication")) {
    await runLibraryRecordPublication();
    return;
  }
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
    await runLibrary(root, readingSources);
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
