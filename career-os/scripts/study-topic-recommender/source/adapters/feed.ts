import { fetchFeedCached } from "../feed.js";
import type { ReadingSourceAdapter } from "./types.js";

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const feedSourceAdapter: ReadingSourceAdapter = {
  id: "feed",
  supports: (source) => Boolean(source.feedUrl),
  async collect(source, context) {
    if (!source.feedUrl) return [];
    const entries = await fetchFeedCached(
      source.feedUrl,
      context.cacheDir,
      context.cacheTtlHours,
      context.timeoutMs
    );
    return entries
      .map((entry) => {
        const url = safeHttpsUrl(entry.link);
        if (!url || !entry.title) return null;
        return {
          title: entry.title,
          url,
          published: entry.published || "",
          excerpt: entry.description,
          kind: source.category === "video" ? "feed-video" as const : "feed-article" as const,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, context.maxCandidatesPerSource);
  },
};
