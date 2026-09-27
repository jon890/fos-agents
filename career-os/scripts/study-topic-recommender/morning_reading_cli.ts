#!/usr/bin/env bun
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { firstOptionValue } from "../lib/cli.ts";
import { DEFAULT_MAX_CANDIDATES_PER_SOURCE, type MorningReadingReport } from "./reading_contracts.js";
import { loadReadingCandidatePool } from "./reading_candidate_pool.js";
import { normalizeReadingSources } from "./reading_sources.js";
import { selectReadings } from "./reading_stage.js";
import { renderExistingReport, writeReportArtifacts } from "./render/report.js";
import { resolveStudyRunRoot, StudyRunPathError, validateStudyCleanupDirectory } from "./runtime-paths.js";
import { StudyLibraryApiError, createStudyLibraryClient } from "./study-library/client.js";
import { buildReportCountsFromLibrary, prepareStudyLibraryCandidates, studyLibraryMetaPath, type StudyLibraryCandidateMeta } from "./study-library/candidates.js";
import { collectAndIngestStudyLibrary, type LibraryCollectMode } from "./study-library/ingestion.js";
import { commitRecommendationRun, recordPublication, reportIdForMorningReading } from "./study-library/recommendations.js";

const FEED_TIMEOUT_MS = 8_000;
const actionFlags = ["--collect-only", "--prepare-candidates", "--reading-selection", "--commit-recommendation", "--record-publication", "--cleanup"];
const hasFlag = (name: string) => process.argv.includes(name);
const argument = (name: string) => { const value = firstOptionValue(process.argv, name); if (!value?.trim()) throw new StudyRunPathError(`${name} 값이 필요하다.`); return value; };

const booleanOptions = new Set(["--collect-only", "--prepare-candidates", "--commit-recommendation", "--reset-cursor", "--record-publication", "--render-only", "--cleanup"]);
const valueOptions = new Set([
  "--reading-selection", "--run-dir", "--source-key", "--mode", "--max-items",
  "--category", "--published-from", "--published-to", "--limit", "--cursor", "--candidate-pool", "--report",
  "--report-id", "--channel", "--external-id", "--published-at", "--url",
]);

const HELP = `사용법: morning_reading_cli.ts <하위 동작> [옵션]

하위 동작:
  --collect-only                 등록된 소스를 수집한다
  --prepare-candidates           추천 후보를 조회한다
  --reading-selection <파일>     선택 결과로 리포트를 만든다
  --commit-recommendation        추천 결과를 저장한다
  --record-publication           외부 게시 결과를 기록한다
  --render-only                  기존 결과로 HTML을 만든다
  --cleanup                      전달이 끝난 임시 실행 디렉터리를 정리한다

값 옵션:
${[...valueOptions].map((option) => `  ${option} <값>`).join("\n")}

기타 옵션:
  --reset-cursor                 수집 cursor를 초기화한다
  --help, -h                     이 도움말을 보여준다

실행 경로는 --run-dir 또는 CAREER_OS_ROOT로 지정한다.`;

function action(): string {
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--library") throw new StudyRunPathError("--library는 이제 기본이다, 빼고 다시 실행한다.");
    if (booleanOptions.has(value)) continue;
    if (valueOptions.has(value)) {
      const optionValue = args[index + 1];
      if (!optionValue?.trim() || optionValue.startsWith("--")) throw new StudyRunPathError(`${value} 값이 필요하다.`);
      index += 1;
      continue;
    }
    if (value.startsWith("--")) throw new StudyRunPathError(`지원하지 않는 옵션: ${value}`);
    throw new StudyRunPathError(`지원하지 않는 인자: ${value}`);
  }

  const enabled = args.filter((value) => actionFlags.includes(value) || value === "--render-only");
  if (enabled.length !== 1) throw new StudyRunPathError(`하위 동작 플래그 하나가 필요하다: ${[...actionFlags, "--render-only"].join(", ")}`);
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
  if (hasFlag("--help") || hasFlag("-h")) {
    console.log(HELP);
    return;
  }
  const selectedAction = action();
  if (selectedAction === "--render-only") {
    const root = resolveStudyRunRoot(process.env, firstOptionValue(process.argv, "--run-dir"));
    console.log(JSON.stringify({ mode: "render-only", ...renderExistingReport({ stateDir: join(root, "state"), outputDir: root }) }));
    return;
  }
  const root = resolveStudyRunRoot(process.env, firstOptionValue(process.argv, "--run-dir"));
  switch (selectedAction) {
    case "--cleanup": {
      for (const directory of [process.env.CAREER_OS_ROOT, firstOptionValue(process.argv, "--run-dir")]) {
        if (directory) validateStudyCleanupDirectory(directory);
      }
      rmSync(root, { recursive: true });
      console.log(`정리 완료: ${basename(root)}`);
      return;
    }
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
