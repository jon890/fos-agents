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

export const pageSourceAdapter: ReadingSourceAdapter = {
  id: "page",
  supports: (source) => Boolean(source.url),
  async collect(source) {
    const url = safeHttpsUrl(source.url);
    if (!url) return [];
    return [{
      title: String(source.source || source.title || source.key),
      url,
      published: "",
      kind: "source-page",
    }];
  },
};
