import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  NormalizedReadingSources,
  ReadingCandidatePool,
  ReadingSelectionResult,
} from "./reading_contracts.js";
import {
  collectReadingCandidatePool,
  loadReadingCandidatePool,
} from "./reading_candidate_pool.js";
import {
  loadValidatedReadingSelection,
  recommendationsFromSelection,
} from "./reading_selection.js";

export interface ReadingCollectionInput {
  readingSources: NormalizedReadingSources;
  outputPath: string;
  cacheDir: string;
  recentUrls: Set<string>;
  candidatePoolPath?: string;
  cacheTtlHours: number;
  timeoutMs: number;
  maxCandidatesPerSource: number;
}

export async function prepareReadingCandidatePool(
  input: ReadingCollectionInput
): Promise<ReadingCandidatePool> {
  const pool = input.candidatePoolPath
    ? loadReadingCandidatePool(resolve(input.candidatePoolPath))
    : await collectReadingCandidatePool({
        readingSources: input.readingSources,
        cacheDir: input.cacheDir,
        recentUrls: input.recentUrls,
        maxCandidatesPerSource: input.maxCandidatesPerSource,
        cacheTtlHours: input.cacheTtlHours,
        timeoutMs: input.timeoutMs,
      });

  writeFileSync(input.outputPath, `${JSON.stringify(pool, null, 2)}\n`, "utf8");
  return pool;
}

export function selectReadings(input: {
  pool: ReadingCandidatePool;
  readingSources: NormalizedReadingSources;
  selectionPath: string;
}): ReadingSelectionResult {
  const selection = loadValidatedReadingSelection(
    resolve(input.selectionPath),
    input.pool,
    input.readingSources
  );

  return {
    recommendations: recommendationsFromSelection(selection, input.pool),
  };
}
