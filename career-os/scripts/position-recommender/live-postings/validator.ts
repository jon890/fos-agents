// Active-snapshot boundary: only direct individual postings with verified active/open status
// are kept. This is the single barrier that prevents career_article / search_page links
// and unknown-status postings from leaking into the snapshot regardless of source.

import type { Posting } from "./types.ts";

const ACTIVE_POSTING_STATUSES: ReadonlySet<Posting["postingStatus"]> = new Set(["active", "open"]);

export function dedupe(posts: Posting[]): Posting[] {
  const seen = new Set<string>();
  const officialRoleKeys = new Set(
    posts
      .filter((p) => p.source !== "wanted" && p.discoveryMode === "official-detail")
      .map(roleKey)
  );

  return posts.filter((p) => {
    // Official detail pages are authoritative when the same company and role were
    // also discovered through Wanted. Keep Wanted-only roles intact.
    if (p.source === "wanted" && officialRoleKeys.has(roleKey(p))) return false;
    const urlKey = `${p.source}|url|${p.url}`;
    const hashKey = p.identityHash ? `${p.source}|hash|${p.identityHash}` : "";
    if (seen.has(urlKey) || (hashKey && seen.has(hashKey))) return false;
    seen.add(urlKey);
    if (hashKey) seen.add(hashKey);
    return true;
  });
}

function roleKey(posting: Posting): string {
  const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  return `${normalize(posting.company)}|${normalize(posting.title)}`;
}

export function keepActiveDirectPostings(posts: Posting[]): Posting[] {
  return posts.filter(
    (p) => p.linkType === "direct_posting" && ACTIVE_POSTING_STATUSES.has(p.postingStatus)
  );
}
