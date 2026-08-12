import { existsSync, readFileSync } from "node:fs";
import type { CandidateRefreshInputs } from "../candidate_refresh_schema.js";
import { loadRecentHistory } from "./history.js";

function activeCandidateCount(path: string): number {
  if (!existsSync(path)) return 0;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return 0;
    const topics = (raw as Record<string, unknown>).topics;
    if (!Array.isArray(topics)) return 0;
    return topics.filter((topic) => {
      if (typeof topic !== "object" || topic === null || Array.isArray(topic)) return false;
      const record = topic as Record<string, unknown>;
      return record.source === "llm-candidate-refresh" && record.status === "active";
    }).length;
  } catch {
    return 0;
  }
}

export function loadCandidateRefreshInputs(input: {
  historyPath: string;
  candidatesPath: string;
  fosStudyMarkdownCount: number;
}): CandidateRefreshInputs {
  const recent = loadRecentHistory(input.historyPath, 7);
  const domainCounts = new Map<string, number>();
  for (const entry of recent) {
    for (const key of entry.keys ?? []) {
      const domain = key.split("-")[0] || "unknown";
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    }
  }
  const dominantRecentDomains = [...domainCounts]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([domain]) => domain);

  return {
    fosStudyMarkdownCount: input.fosStudyMarkdownCount,
    recentHistoryEntries: recent.length,
    remainingNewCandidates: activeCandidateCount(input.candidatesPath),
    dominantRecentDomains,
  };
}
