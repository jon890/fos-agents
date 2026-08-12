import type { ReadingSourceAdapter } from "./types.js";
import { isLowSignalTitle } from "../feed.js";

const NAVIGATION_TITLES = new Set([
  "home",
  "about",
  "blog",
  "login",
  "sign in",
  "privacy",
  "terms",
  "더보기",
  "전체보기",
  "홈",
]);

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function comparableHost(hostname: string): string {
  return hostname.replace(/^www\./, "").toLowerCase();
}

export function extractPageLinks(html: string, sourceUrl: string, limit: number) {
  const source = new URL(sourceUrl);
  const found = new Map<string, { title: string; url: string; published: string; kind: "page-link" }>();
  const pattern = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const title = decodeHtml(match[2] ?? "");
    if (title.length < 4 || NAVIGATION_TITLES.has(title.toLowerCase()) || isLowSignalTitle(title)) {
      continue;
    }
    let url: URL;
    try {
      url = new URL(match[1], source);
    } catch {
      continue;
    }
    url.hash = "";
    if (url.protocol !== "https:" || comparableHost(url.hostname) !== comparableHost(source.hostname)) {
      continue;
    }
    if (url.toString() === source.toString() || url.pathname === "/") continue;
    found.set(url.toString(), { title, url: url.toString(), published: "", kind: "page-link" });
    if (found.size >= limit) break;
  }
  return [...found.values()];
}

export const pageSourceAdapter: ReadingSourceAdapter = {
  id: "page",
  supports: (source) => Boolean(source.url),
  async collect(source, context) {
    const url = safeHttpsUrl(source.url);
    if (!url) return [];
    const sourcePage = {
      title: String(source.source || source.title || source.key),
      url,
      published: "",
      kind: "source-page" as const,
    };
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "career-os-morning/1.0" },
        signal: AbortSignal.timeout(context.timeoutMs),
      });
      if (response.ok) {
        const links = extractPageLinks(
          await response.text(),
          url,
          Math.max(0, context.maxCandidatesPerSource - 1)
        );
        if (links.length > 0) return [sourcePage, ...links];
      }
    } catch {
      // 아래 출처 페이지 후보로 복구한다.
    }
    return [sourcePage];
  },
};
