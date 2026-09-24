#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { firstOptionValue } from "../lib/cli.ts";
import { morningStudyHistorySchema, readingSourcesConfigSchema, type ReadingSource } from "./reading_contracts.js";
import { createStudyLibraryClient, type StudyLibraryClient } from "./study-library/client.js";

const DEFAULT_SOURCES_FILE = resolve(import.meta.dir, "../../config/external-reading-sources.ts");

type ImportClient = Pick<StudyLibraryClient,
  "getSources" | "putSource" | "getRecommendationRunStatus" | "getCandidates" | "getSourceCursor" | "createIngestion" | "createRecommendationRun"
>;

export type ImportStudyStateOptions = {
  client?: ImportClient;
  loadSources?: (path: string) => Promise<ReadingSource[]>;
};

async function loadSourcesFromFile(path: string): Promise<ReadingSource[]> {
  const module = await import(pathToFileURL(resolve(path)).href);
  return readingSourcesConfigSchema.parse(module.externalReadingSources).sources;
}

export async function importStudyState(args = process.argv.slice(2), options: ImportStudyStateOptions = {}) {
  const historyFile = firstOptionValue(args, "--history-file"); if (!historyFile) throw new Error("--history-file 값이 필요하다.");
  const sourcesFile = firstOptionValue(args, "--sources-file") ?? DEFAULT_SOURCES_FILE;
  const commit = args.includes("--commit"); const history = morningStudyHistorySchema.parse(JSON.parse(readFileSync(historyFile, "utf8")) as unknown);
  const client = options.client ?? createStudyLibraryClient(); const server = await client.getSources(); const configured = await (options.loadSources ?? loadSourcesFromFile)(sourcesFile);
  let sourceCount = 0; let materialCount = 0; let skippedCount = 0;
  for (const source of configured) if (!server.sources.some((item) => item.sourceKey === source.key)) { sourceCount += 1; if (commit) await client.putSource(source.key, { title: source.title, category: source.category, adapter: source.adapter ?? "page", url: source.url ?? null, feedUrl: source.feedUrl ?? null, enabled: source.enabled ?? true, note: "config 에서 이관", expectedVersion: 0 }); }
  for (const report of [...history.reports].sort((a, b) => a.reportId.localeCompare(b.reportId))) {
    const status = await client.getRecommendationRunStatus(report.reportId); if (status.exists) { skippedCount += 1; continue; }
    const entries = history.entries.filter((entry) => entry.reportId === report.reportId); const candidates = await client.getCandidates({ limit: 1 });
    const grouped = Map.groupBy(entries, (entry) => entry.sourceKey);
    for (const [sourceKey, items] of grouped) { materialCount += items!.length; if (commit) { const cursor = await client.getSourceCursor(sourceKey!, "recent"); await client.createIngestion({ sourceKey, mode: "recent", cursor: cursor.cursor, expectedCursorVersion: cursor.version, idempotencyKey: `import:${report.reportId}:${sourceKey}`, items: items!.map((entry) => ({ contentKey: entry.contentKey, canonicalUrl: entry.canonicalUrl, url: entry.canonicalUrl, title: entry.title, published: "", publishedAt: null, excerpt: null, kind: configured.find((source) => source.key === sourceKey)?.adapter === "youtube" ? "feed-video" : "feed-article", tags: [], collectedAt: entry.recommendedAt })) }); } }
    if (commit) await client.createRecommendationRun({ reportId: report.reportId, generatedAt: report.recommendedAt, candidateContextVersion: candidates.candidateContextVersion, rejections: [], topics: Object.values(Object.groupBy(entries, (entry) => entry.studyTopicKey)).map((items) => ({ topicKey: items![0].studyTopicKey, title: items![0].studyTopic, careerQuestion: null, items: items!.map((entry) => ({ contentKey: entry.contentKey, summary: null, reason: null, careerValue: entry.careerValue })) })) });
  }
  return { sources: sourceCount, reports: history.reports.length, materials: materialCount, skipped: skippedCount };
}
if (import.meta.main) importStudyState().then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
