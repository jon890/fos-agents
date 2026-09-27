import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { analysisQueueResponseSchema } from "../../services/career-backend/src/positions/schema.ts";
import {
  companyTierQueueFileSchema,
  companyTierUpdatesInputSchema,
} from "./company-tier-analysis/schema.ts";
import { analysisUpdatesInputSchema } from "./commit_position_analysis.ts";

export const RUN_DIR_FILE_NAMES = {
  postingCandidates: "posting-candidates.json",
  companyTierQueue: "company-tier-queue.json",
  companyEvidence: "company-evidence.json",
  analysisQueue: "analysis-queue.json",
  companyTierUpdates: "company-tier-updates.json",
  analysisUpdates: "analysis-updates.json",
  recommendation: "recommendation.json",
  report: "index.html",
} as const;

export function resolveRunDirectory(runDirectory: string): string {
  return resolve(runDirectory);
}

export function runDirectoryPaths(runDirectory: string) {
  const directory = resolveRunDirectory(runDirectory);
  return {
    directory,
    postingCandidates: resolve(directory, RUN_DIR_FILE_NAMES.postingCandidates),
    companyTierQueue: resolve(directory, RUN_DIR_FILE_NAMES.companyTierQueue),
    companyEvidence: resolve(directory, RUN_DIR_FILE_NAMES.companyEvidence),
    analysisQueue: resolve(directory, RUN_DIR_FILE_NAMES.analysisQueue),
    companyTierUpdates: resolve(directory, RUN_DIR_FILE_NAMES.companyTierUpdates),
    analysisUpdates: resolve(directory, RUN_DIR_FILE_NAMES.analysisUpdates),
    recommendation: resolve(directory, RUN_DIR_FILE_NAMES.recommendation),
    report: resolve(directory, RUN_DIR_FILE_NAMES.report),
  };
}

export type RunDirectoryPaths = ReturnType<typeof runDirectoryPaths>;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** 회사 판정 큐의 실행 ID를 보존한 빈 결과 틀을 만들고 대상 회사 수를 돌려준다. */
export function writeCompanyTierUpdatesTemplate(paths: RunDirectoryPaths): number {
  const queue = companyTierQueueFileSchema.parse(readJson(paths.companyTierQueue));
  const template = companyTierUpdatesInputSchema.parse({
    schemaVersion: 1,
    collectionRunId: queue.collectionRunId,
    companyTierRunId: queue.companyTierRunId,
    results: [],
    failures: [],
  });
  writeJson(paths.companyTierUpdates, template);
  return queue.companies.length;
}

/** 공고 분석 큐의 실행 ID를 보존한 빈 결과 틀을 만들고 처리할 공고 수를 돌려준다. */
export function writeAnalysisUpdatesTemplate(paths: RunDirectoryPaths): number {
  const queue = analysisQueueResponseSchema.parse(readJson(paths.analysisQueue));
  const template = analysisUpdatesInputSchema.parse({
    schemaVersion: 2,
    collectionRunId: queue.collectionRunId,
    analysisRunId: queue.analysisRunId,
    results: [],
    failures: [],
  });
  writeJson(paths.analysisUpdates, template);
  return queue.candidates.filter(
    (candidate) => candidate.resultStatus === "pending" || candidate.resultStatus === "failed",
  ).length;
}
