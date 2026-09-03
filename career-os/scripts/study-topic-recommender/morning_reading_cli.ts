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

const FEED_CACHE_TTL_HOURS = 6;
const FEED_TIMEOUT_MS = 8_000;

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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
  const historyPath = resolveMorningStudyHistoryPath(argumentValue("--history-file"));
  if (process.argv.includes("--commit-history")) {
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
  console.error("study-topic-recommender error:", error);
  process.exit(1);
}

if (import.meta.main) {
  main().catch(reportMorningReadingError);
}
