import { XMLParser } from "fast-xml-parser";

import type { CompanyEvidenceCollector } from "./types.ts";
import { compactSummary, dateAfter } from "./types.ts";

type FeedEntry = {
  title: string;
  category: string[];
  pubDate: string | null;
  creator: string | null;
};

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return text(record["#text"] ?? record.__cdata ?? "");
  }
  return "";
}

function items(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function categories(value: unknown): string[] {
  return items(value)
    .map((entry) =>
      entry && typeof entry === "object" && "term" in entry
        ? text((entry as { term: unknown }).term)
        : text(entry),
    )
    .filter(Boolean);
}

export function parseFeed(xml: string): FeedEntry[] {
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" }).parse(xml);
  const feed = parsed?.rss?.channel?.item ?? parsed?.feed?.entry;
  return items(feed)
    .slice(0, 20)
    .map((raw) => {
      const entry = raw as Record<string, unknown>;
      return {
        title: text(entry.title),
        category: categories(entry.category),
        pubDate: text(entry.pubDate ?? entry.published ?? entry.updated) || null,
        creator:
          text(
            entry["dc:creator"] ??
              (entry.author as { name?: unknown } | undefined)?.name ??
              entry.author,
          ) || null,
      };
    })
    .filter((entry) => entry.title);
}

export const techBlogCollector: CompanyEvidenceCollector = {
  name: "tech-blog",
  sourceTypes: ["tech-blog"],
  enabled: (input) => Boolean(input.preference?.techBlogFeedUrl),
  async collect(input) {
    const url = input.preference!.techBlogFeedUrl!;
    const response = await input.fetcher(url);
    if (!response.ok) return { evidence: [], diagnostics: [`tech-blog: HTTP ${response.status}`] };
    const posts = parseFeed(await response.text());
    if (posts.length === 0) return { evidence: [], diagnostics: ["tech-blog: 글이 없다"] };
    const recent = posts.filter(
      (post) => post.pubDate && Date.parse(post.pubDate) >= input.now.getTime() - 90 * 86_400_000,
    );
    const counts = new Map<string, number>();
    for (const post of posts)
      for (const category of post.category) counts.set(category, (counts.get(category) ?? 0) + 1);
    const top = [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
    return {
      diagnostics: [],
      evidence: [
        {
          sourceType: "tech-blog",
          url,
          title: `${input.companyName} 기술 블로그`,
          summary: compactSummary(
            `최근 90일 ${recent.length}건, 확인한 글 ${posts.length}건. 주요 분류: ${top.join(", ") || "미분류"}.`,
          ),
          payloadJson: { posts },
          observedAt: input.now.toISOString(),
          validUntil: dateAfter(input.now, 14),
        },
      ],
    };
  },
};
