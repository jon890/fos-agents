#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { firstOptionValue } from "../lib/cli.ts";
import { DEFAULT_MAX_CANDIDATES_PER_SOURCE, type MorningReadingReport } from "./reading_contracts.js";
import { loadReadingCandidatePool } from "./reading_candidate_pool.js";
import { normalizeReadingSources } from "./reading_sources.js";
import { selectReadings } from "./reading_stage.js";
import { renderExistingReport, writeReportArtifacts } from "./render/report.js";
import { resolveStudyRunRoot, StudyRunPathError } from "./runtime-paths.js";
import { StudyLibraryApiError, createStudyLibraryClient } from "./study-library/client.js";
import { buildReportCountsFromLibrary, prepareStudyLibraryCandidates, studyLibraryMetaPath, type StudyLibraryCandidateMeta } from "./study-library/candidates.js";
import { collectAndIngestStudyLibrary, type LibraryCollectMode } from "./study-library/ingestion.js";
import { commitRecommendationRun, recordPublication, reportIdForMorningReading } from "./study-library/recommendations.js";

const FEED_TIMEOUT_MS = 8_000;
const actionFlags = ["--collect-only", "--prepare-candidates", "--reading-selection", "--commit-recommendation", "--record-publication"];
const removedFlags = [`--commit-${"history"}`, `--history-${"file"}`, `--import-${"preview"}`, `--pages-${"manifest"}`];
const hasFlag = (name: string) => process.argv.includes(name);
const argument = (name: string) => { const value = firstOptionValue(process.argv, name); if (!value?.trim()) throw new StudyRunPathError(`${name} 값이 필요하다.`); return value; };

function action(): string {
  if (hasFlag("--library")) throw new StudyRunPathError("--library는 이제 기본이다, 빼고 다시 실행한다.");
  const removed = removedFlags.find(hasFlag);
  if (removed) throw new StudyRunPathError(`${removed}는 더 이상 지원하지 않는다.`);
  const enabled = actionFlags.filter((flag) => flag === "--reading-selection" ? Boolean(firstOptionValue(process.argv, flag)) : hasFlag(flag));
  if (enabled.length !== 1) throw new StudyRunPathError(`하위 동작 플래그 하나가 필요하다: ${actionFlags.join(", ")}`);
  return enabled[0];
}
function mode(): LibraryCollectMode { const value = firstOptionValue(process.argv, "--mode") ?? "recent"; if (value !== "recent" && value !== "archive") throw new StudyRunPathError("--mode는 recent 또는 archive여야 한다."); return value; }
function maxItems(): number { const raw = firstOptionValue(process.argv, "--max-items"); if (!raw) return DEFAULT_MAX_CANDIDATES_PER_SOURCE; const value = Number(raw); if (!Number.isInteger(value) || value < 1) throw new StudyRunPathError("--max-items는 양의 정수여야 한다."); return value; }
function meta(poolPath: string): StudyLibraryCandidateMeta { return JSON.parse(readFileSync(studyLibraryMetaPath(poolPath), "utf8")) as StudyLibraryCandidateMeta; }

async function collect(): Promise<void> {
  const client = createStudyLibraryClient();
  const sources = (await client.getSources()).sources.filter((source) => source.enabled).map((source) => ({ key: source.sourceKey, title: source.title, category: source.category, url: source.url ?? undefined, feedUrl: source.feedUrl ?? undefined, enabled: source.enabled, adapter: source.adapter }));
  const sourceKey = firstOptionValue(process.argv, "--source-key");
  if (sourceKey && !sources.some((source) => source.key === sourceKey)) throw new StudyRunPathError(`활성 소스에서 sourceKey를 찾을 수 없다: ${sourceKey}`);
  const result = await collectAndIngestStudyLibrary({ client, sources: normalizeReadingSources({ _meta: { purpose: "backend", schemaVersion: 6 }, sources }).sources, mode: mode(), sourceKey, maxItems: maxItems(), resetCursor: hasFlag("--reset-cursor"), timeoutMs: FEED_TIMEOUT_MS, youtubeApiKey: process.env.YOUTUBE_DATA_API_KEY });
  console.log(JSON.stringify(result));
}
async function prepare(root: string): Promise<void> {
  const result = await prepareStudyLibraryCandidates({ client: createStudyLibraryClient(), outputPath: join(root, "state", "reading-candidates.json"), filters: { sourceKey: firstOptionValue(process.argv, "--source-key"), category: firstOptionValue(process.argv, "--category") as StudyLibraryCandidateMeta["filters"]["category"], publishedFrom: firstOptionValue(process.argv, "--published-from"), publishedTo: firstOptionValue(process.argv, "--published-to"), limit: firstOptionValue(process.argv, "--limit") ? Number(firstOptionValue(process.argv, "--limit")) : undefined, cursor: firstOptionValue(process.argv, "--cursor") } });
  console.log(JSON.stringify({ mode: "prepare-candidates", ...result }));
}
async function select(root: string): Promise<void> {
  const state = join(root, "state"); const candidatePoolPath = resolve(argument("--candidate-pool")); const pool = loadReadingCandidatePool(candidatePoolPath); const candidateMeta = meta(candidatePoolPath);
  const selected = selectReadings({ pool, selectionPath: argument("--reading-selection") });
  const report: MorningReadingReport = { generatedAt: new Date().toISOString(), sourceOfTruth: { sources: "backend:study_sources", collectedArticles: "state/reading-candidates.json" }, counts: buildReportCountsFromLibrary({ candidatePool: pool, meta: candidateMeta }), collectionLog: pool.collectionLog, topics: selected.topics };
  mkdirSync(state, { recursive: true }); const reportPath = join(state, "morning-reading.json"); writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(join(state, "recommendation-request.json"), `${JSON.stringify({ reportId: reportIdForMorningReading(report), generatedAt: report.generatedAt, candidateContextVersion: candidateMeta.candidateContextVersion, rejections: selected.selection.rejections ?? [] }, null, 2)}\n`, "utf8");
  const artifacts = writeReportArtifacts({ report, outputDir: root }); console.log(JSON.stringify({ mode: "reading-selection", report: reportPath, ...artifacts }));
}
async function run(): Promise<void> {
  if (hasFlag("--render-only")) {
    const root = resolveStudyRunRoot(process.env, firstOptionValue(process.argv, "--run-dir"));
    console.log(JSON.stringify({ mode: "render-only", ...renderExistingReport({ stateDir: join(root, "state"), outputDir: root }) }));
    return;
  }
  const selectedAction = action();
  const root = resolveStudyRunRoot(process.env, firstOptionValue(process.argv, "--run-dir"));
  switch (selectedAction) {
    case "--collect-only": await collect(); return;
    case "--prepare-candidates": await prepare(root); return;
    case "--reading-selection": await select(root); return;
    case "--commit-recommendation": console.log(JSON.stringify(await commitRecommendationRun({ client: createStudyLibraryClient(), reportPath: argument("--report") }))); return;
    case "--record-publication": console.log(JSON.stringify(await recordPublication({ client: createStudyLibraryClient(), reportId: argument("--report-id"), channel: argument("--channel"), externalId: argument("--external-id"), publishedAt: argument("--published-at"), url: argument("--url") }))); return;
  }
}
export async function main(): Promise<void> { await run(); }
export function reportMorningReadingError(error: unknown): never { if (error instanceof StudyRunPathError) { console.error(error.message); process.exit(error.exitCode); } if (error instanceof StudyLibraryApiError) { console.error(JSON.stringify({ error: { code: error.code ?? `HTTP_${error.status}`, requestId: error.requestId ?? null, ...(error.retryAfter === undefined ? {} : { retryAfter: error.retryAfter }) } })); process.exit(1); } console.error("study-topic-recommender error:", error); process.exit(1); }
if (import.meta.main) main().catch(reportMorningReadingError);
