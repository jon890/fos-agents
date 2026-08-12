/**
 * RSS·Atom 파싱과 캐시를 담당하는 feed 어댑터 하부 모듈.
 * 개별 네트워크 실패는 빈 후보로 반환해 다른 소스 수집을 계속한다.
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { XMLParser } from "fast-xml-parser";

export const USER_AGENT =
  "career-os-morning/1.0 (+https://github.com/jon890/career-os; daily morning recommendation discovery)";
export const DEFAULT_TIMEOUT_MS = 8_000;
export const DEFAULT_CACHE_TTL_HOURS = 6;

export interface FeedEntry {
  title: string;
  link: string;
  published: string;
}

export interface CachePayload {
  fetchedAt: string;
  feedUrl: string;
  entries: FeedEntry[];
}

// ── XML parser setup ─────────────────────────────────────────────────────────

function buildParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    isArray: (name) => ["item", "entry", "link"].includes(name),
    trimValues: true,
  });
}

// ── feed parsing ──────────────────────────────────────────────────────────────

function resolveAtomLink(links: unknown[]): string {
  let best = "";
  for (const l of links) {
    if (typeof l !== "object" || l === null) continue;
    const link = l as Record<string, string>;
    const rel = link["@_rel"] ?? "alternate";
    const href = (link["@_href"] ?? "").trim();
    if (!href) continue;
    if (rel === "alternate") return href;
    if (!best) best = href;
  }
  return best;
}

export function parseFeed(xmlText: string): FeedEntry[] {
  const parser = buildParser();
  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xmlText) as Record<string, unknown>;
  } catch {
    return [];
  }

  const entries: FeedEntry[] = [];

  // RSS 2.0
  if (parsed?.rss) {
    const rss = parsed.rss as Record<string, unknown>;
    const channel = rss?.channel as Record<string, unknown> | undefined;
    if (!channel) return entries;
    const items = Array.isArray(channel.item)
      ? channel.item
      : channel.item != null
      ? [channel.item]
      : [];
    for (const item of items as Record<string, unknown>[]) {
      entries.push({
        title: String(item.title ?? "").trim(),
        link: String(item.link ?? "").trim(),
        published: String(item.pubDate ?? item["dc:date"] ?? "").trim(),
      });
    }
    return entries;
  }

  // Atom 1.0
  if (parsed?.feed) {
    const feed = parsed.feed as Record<string, unknown>;
    const items = Array.isArray(feed.entry)
      ? feed.entry
      : feed.entry != null
      ? [feed.entry]
      : [];
    for (const item of items as Record<string, unknown>[]) {
      const links = Array.isArray(item.link)
        ? item.link
        : item.link != null
        ? [item.link]
        : [];
      const link = resolveAtomLink(links as unknown[]);

      const titleRaw = item.title;
      const title =
        typeof titleRaw === "object" && titleRaw !== null
          ? String((titleRaw as Record<string, unknown>)["#text"] ?? "").trim()
          : String(titleRaw ?? "").trim();

      const publishedRaw = item.published ?? item.updated;
      const published =
        typeof publishedRaw === "object" && publishedRaw !== null
          ? String((publishedRaw as Record<string, unknown>)["#text"] ?? "").trim()
          : String(publishedRaw ?? "").trim();

      entries.push({ title, link, published });
    }
    return entries;
  }

  return entries;
}

// ── cache helpers ─────────────────────────────────────────────────────────────

function cachePathFor(cacheDir: string, feedUrl: string): string {
  const digest = createHash("sha1").update(feedUrl, "utf-8").digest("hex").slice(0, 16);
  return join(cacheDir, `${digest}.json`);
}

function loadCached(cachePath: string): CachePayload | null {
  if (!existsSync(cachePath)) return null;
  try {
    return JSON.parse(readFileSync(cachePath, "utf-8")) as CachePayload;
  } catch {
    return null;
  }
}

// ── HTTP fetch ────────────────────────────────────────────────────────────────

async function httpGet(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── cached feed fetch ─────────────────────────────────────────────────────────

export async function fetchFeedCached(
  feedUrl: string,
  cacheDir: string,
  ttlHours: number = DEFAULT_CACHE_TTL_HOURS,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<FeedEntry[]> {
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = cachePathFor(cacheDir, feedUrl);
  const now = new Date();

  // fresh cache hit
  const cached = loadCached(cachePath);
  if (cached) {
    try {
      // Normalize: Python writes UTC timestamps without 'Z'; treat as UTC.
      const ts = cached.fetchedAt.match(/[Z+]/) ? cached.fetchedAt : cached.fetchedAt + "Z";
      const fetchedAt = new Date(ts);
      const ageHours = (now.getTime() - fetchedAt.getTime()) / 3_600_000;
      if (ageHours < ttlHours) return cached.entries;
    } catch {
      // corrupt fetchedAt — fall through to refresh
    }
  }

  // network fetch
  let entries: FeedEntry[];
  try {
    const body = await httpGet(feedUrl, timeoutMs);
    entries = parseFeed(body);
  } catch {
    // network or parse failure → stale cache fallback
    if (cached) return cached.entries;
    return [];
  }

  const payload: CachePayload = {
    fetchedAt: now.toISOString(),
    feedUrl,
    entries,
  };
  try {
    writeFileSync(cachePath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  } catch {
    // cache write failure is non-fatal
  }
  return entries;
}

// ── relevance keywords (Python 원본과 동일) ───────────────────────────────────

export const LOW_SIGNAL_TITLE_KEYWORDS: string[] = [
  "세미나", "현장 스케치", "참가 신청", "사전 안내", "공채", "코딩테스트",
  "문제해설", "학생에서 개발자로", "직무", "디자인 직무", "프론트", "front",
  "conference", "summit", "schedule", "registration", "webinar", "meetup",
  "컨퍼런스", "서밋", "일정 공개", "등록 안내", "웨비나", "밋업",
];

// ── article selection ─────────────────────────────────────────────────────────

function keywordScore(title: string, keywords: string[]): number {
  const lower = title.toLowerCase();
  return keywords.reduce(
    (sum, kw) => sum + (kw && lower.includes(kw.toLowerCase()) ? 1 : 0),
    0
  );
}

export function isLowSignalTitle(title: string): boolean {
  return keywordScore(title, LOW_SIGNAL_TITLE_KEYWORDS) > 0;
}
