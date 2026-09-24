import { resolve } from "node:path";

export const RUN_DIR_FILE_NAMES = {
  postingCandidates: "posting-candidates.json",
  companyTierQueue: "company-tier-queue.json",
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
    analysisQueue: resolve(directory, RUN_DIR_FILE_NAMES.analysisQueue),
    companyTierUpdates: resolve(directory, RUN_DIR_FILE_NAMES.companyTierUpdates),
    analysisUpdates: resolve(directory, RUN_DIR_FILE_NAMES.analysisUpdates),
    recommendation: resolve(directory, RUN_DIR_FILE_NAMES.recommendation),
    report: resolve(directory, RUN_DIR_FILE_NAMES.report),
  };
}

export type RunDirectoryPaths = ReturnType<typeof runDirectoryPaths>;
