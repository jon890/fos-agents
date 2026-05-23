import type { StudyTopicEntry, TopicItem, LiveSeed, HistoryEntry } from "./types.js";

export function artifactDomainLabel(outputPath: string): string {
  if (outputPath.startsWith("database/mysql/")) return "mysql";
  if (outputPath.startsWith("database/redis/")) return "redis";
  if (outputPath.startsWith("java/spring/")) return "spring";
  if (outputPath.startsWith("java/")) return "java";
  if (outputPath.startsWith("architecture/")) return "architecture";
  if (outputPath.startsWith("search/")) return "search";
  if (outputPath.startsWith("kafka/") || outputPath.startsWith("rabbitmq/"))
    return "message-queue";
  if (outputPath.startsWith("interview/")) return "interview";
  return "other";
}

export function getUncoveredCurated(
  studyTopics: Record<string, StudyTopicEntry>,
  studyPaths: Set<string>
): TopicItem[] {
  return Object.entries(studyTopics)
    .filter(([, entry]) => !studyPaths.has(entry.outputPath ?? ""))
    .map(([key, entry]) => ({
      key,
      title: key,
      domain: entry.domain ?? "unknown",
      outputPath: entry.outputPath,
      source: "curated",
      tag: "new" as const,
    }));
}

export function getRemainingLive(
  liveSeeds: LiveSeed[],
  livePaths: Set<string>
): LiveSeed[] {
  return liveSeeds.filter((s) => !livePaths.has(s.outputPath ?? ""));
}

export function getRemainingLiveCandidates(
  liveSeedCandidates: LiveSeed[],
  livePaths: Set<string>
): LiveSeed[] {
  return liveSeedCandidates.filter((s) => !livePaths.has(s.outputPath ?? ""));
}

export function getCandidateRecommendations(
  studyCandidates: TopicItem[],
  fosStudyPaths: Set<string>
): TopicItem[] {
  return studyCandidates.filter((item) => {
    const promotedPath = item.promotionTarget?.outputPath;
    return !(promotedPath && fosStudyPaths.has(promotedPath));
  });
}

export function collectRecentKeys(
  entries: HistoryEntry[],
  field: keyof Pick<HistoryEntry, "techBlogKeys" | "aiKeys" | "geekKeys">
): Set<string> {
  const keys = new Set<string>();
  for (const entry of entries) {
    const vals = entry[field] as string[] | undefined;
    for (const key of vals ?? []) {
      keys.add(key);
    }
  }
  return keys;
}
