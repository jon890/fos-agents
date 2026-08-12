import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { HistoryEntry } from "../transform/types.js";

function parseHistoryLine(line: string): HistoryEntry | undefined {
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
      keys: stringArray("keys"),
      techBlogKeys: stringArray("techBlogKeys"),
      aiKeys: stringArray("aiKeys"),
      geekKeys: stringArray("geekKeys"),
      articleUrls: stringArray("articleUrls"),
    };
  } catch {
    return undefined;
  }
}

export function loadRecentHistory(path: string, maxEntries: number): HistoryEntry[] {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseHistoryLine)
      .filter((entry): entry is HistoryEntry => entry !== undefined)
      .slice(-maxEntries);
  } catch {
    return [];
  }
}

export function loadLatestKeys(path: string): Set<string> {
  const [latest] = loadRecentHistory(path, 1);
  return new Set(latest?.keys ?? []);
}

export function appendHistory(
  path: string,
  payload: Omit<HistoryEntry, "generatedAt">
): void {
  const entry: HistoryEntry = {
    generatedAt: new Date().toISOString(),
    ...payload,
  };
  appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
}
