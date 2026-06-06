// Active-snapshot boundary: only direct individual postings with verified active/open status
// are kept. This is the single barrier that prevents career_article / search_page links
// and unknown-status postings from leaking into the snapshot regardless of source.

import type { Posting } from "./types.ts";

const ACTIVE_POSTING_STATUSES: ReadonlySet<Posting["postingStatus"]> = new Set(["active", "open"]);

export function dedupe(posts: Posting[]): Posting[] {
  const seen = new Set<string>();
  return posts.filter((p) => {
    const urlKey = `${p.source}|url|${p.url}`;
    const hashKey = p.identityHash ? `${p.source}|hash|${p.identityHash}` : "";
    if (seen.has(urlKey) || (hashKey && seen.has(hashKey))) return false;
    seen.add(urlKey);
    if (hashKey) seen.add(hashKey);
    return true;
  });
}

export function keepActiveDirectPostings(posts: Posting[]): Posting[] {
  return posts.filter(
    (p) => p.linkType === "direct_posting" && ACTIVE_POSTING_STATUSES.has(p.postingStatus)
  );
}
