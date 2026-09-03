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
  topicsFromSelection,
} from "./reading_selection.js";

export interface ReadingCollectionInput {
  readingSources: NormalizedReadingSources;
  outputPath: string;
  cacheDir: string;
  previousContentKeys: Set<string>;
  recentStudyTopicKeys: Set<string>;
  candidatePoolPath?: string;
  cacheTtlHours: number;
  timeoutMs: number;
  maxCandidatesPerSource: number;
}

export async function prepareReadingCandidatePool(
  input: ReadingCollectionInput
): Promise<ReadingCandidatePool> {
  const loadedPool = input.candidatePoolPath
    ? loadReadingCandidatePool(resolve(input.candidatePoolPath))
    : await collectReadingCandidatePool({
        readingSources: input.readingSources,
        cacheDir: input.cacheDir,
        previousContentKeys: input.previousContentKeys,
        recentStudyTopicKeys: input.recentStudyTopicKeys,
        maxCandidatesPerSource: input.maxCandidatesPerSource,
        cacheTtlHours: input.cacheTtlHours,
        timeoutMs: input.timeoutMs,
      });
  const pool = {
    ...loadedPool,
    recentStudyTopicKeys: [...input.recentStudyTopicKeys].sort(),
    candidates: loadedPool.candidates.map((candidate) => ({
      ...candidate,
      previouslyRecommended: input.previousContentKeys.has(candidate.contentKey),
    })),
  };

  writeFileSync(input.outputPath, `${JSON.stringify(pool, null, 2)}\n`, "utf8");
  return pool;
}

export function selectReadings(input: {
  pool: ReadingCandidatePool;
  selectionPath: string;
}): ReadingSelectionResult {
  const selection = loadValidatedReadingSelection(
    resolve(input.selectionPath),
    input.pool
  );

  return {
    topics: topicsFromSelection(selection, input.pool),
  };
}
