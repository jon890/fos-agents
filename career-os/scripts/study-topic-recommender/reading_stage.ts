import { resolve } from "node:path";
import type {
  ReadingCandidatePool,
  ReadingSelectionResult,
} from "./reading_contracts.js";
import {
  loadValidatedReadingSelection,
  topicsFromSelection,
} from "./reading_selection.js";

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
    selection,
  };
}
