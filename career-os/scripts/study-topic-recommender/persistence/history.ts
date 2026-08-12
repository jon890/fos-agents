import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { ReadingHistoryEntry } from "../reading_contracts.js";

function parseHistoryLine(line: string): ReadingHistoryEntry | undefined {
  try {
    const value = JSON.parse(line) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    const stringArray = (field: string): string[] | undefined => {
      const candidate = record[field];
      return Array.isArray(candidate) && candidate.every((item) => typeof item === "string")
        ? candidate
        : undefined;
    };
    return {
      generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : undefined,
      articleUrls: stringArray("articleUrls"),
    };
  } catch {
    return undefined;
  }
}

export function loadRecentHistory(path: string, maxEntries: number): ReadingHistoryEntry[] {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseHistoryLine)
      .filter((entry): entry is ReadingHistoryEntry => entry !== undefined)
      .slice(-maxEntries);
  } catch {
    return [];
  }
}

export function appendHistory(
  path: string,
  payload: Omit<ReadingHistoryEntry, "generatedAt">
): void {
  const entry: ReadingHistoryEntry = {
    generatedAt: new Date().toISOString(),
    ...payload,
  };
  appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
}
