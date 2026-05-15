/**
 * RSS/Atom feed discovery for morning recommendation secondary categories.
 *
 * ADR-013: tech-blog / AI / geek 카테고리 추천에 실제 최신 글 title + URL을
 * 부착하기 위한 가벼운 RSS/Atom discovery 레이어.
 *
 * 설계 원칙:
 * - fast-xml-parser 단일 외부 의존 (Python stdlib ET 대체).
 * - 네트워크 실패는 표면화하지 않는다 — 항상 fallback(reservoir 원본)으로 복구 가능해야 한다.
 * - 디스크 캐시(data/runtime/feed-cache/)로 동일 cron 주기 내 중복 요청을 줄인다.
 * - 타임아웃은 보수적으로 짧게 (default 8s).
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { XMLParser } from "fast-xml-parser";

export const USER_AGENT =
  "career-os-morning/1.0 (+https://github.com/jon890/career-os; daily morning recommendation discovery)";
export const DEFAULT_TIMEOUT_MS = 8_000;
export const DEFAULT_CACHE_TTL_HOURS = 6;

// ── types ─────────────────────────────────────────────────────────────────────

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

export interface ReservoirItem {
  key?: string;
  feedUrl?: string;
  filterKeywords?: string[];
  [key: string]: unknown;
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

export const GENERIC_BACKEND_RELEVANCE_KEYWORDS: string[] = [
  "backend", "백엔드", "server", "서버", "spring", "java", "kotlin",
  "mysql", "db", "database", "데이터베이스", "redis", "cache", "캐시",
  "kafka", "flink", "rocksdb", "starrocks", "stream", "streaming", "스트림",
  "transaction", "트랜잭션", "race condition", "경쟁 조건", "동시성",
  "distributed", "분산", "messaging", "메시징", "queue", "event", "이벤트",
  "architecture", "아키텍처", "scale", "scaling", "확장", "slo", "sli",
  "storage", "스토리지", "검색", "search", "운영", "성능", "performance",
  "batch", "배치", "eks", "kubernetes", "autoscaling", "오토스케일링",
];

export const LOW_SIGNAL_TITLE_KEYWORDS: string[] = [
  "세미나", "현장 스케치", "참가 신청", "사전 안내", "공채", "코딩테스트",
  "문제해설", "학생에서 개발자로", "직무", "디자인 직무", "프론트", "front",
];

// ── article selection ─────────────────────────────────────────────────────────

function keywordScore(title: string, keywords: string[]): number {
  const lower = title.toLowerCase();
  return keywords.reduce(
    (sum, kw) => sum + (kw && lower.includes(kw.toLowerCase()) ? 1 : 0),
    0
  );
}

/**
 * Choose a non-excluded article from a feed.
 *
 * Prefer item-specific keyword matches, but do not fall back to a vague reservoir
 * card when a real backend-relevant article exists. Broad company feeds often use
 * titles such as "Flink 운영기" or "경쟁 조건 문제" that are useful even when they
 * miss the narrow source card keywords.
 */
export function selectArticle(
  entries: FeedEntry[],
  filterKeywords?: string[],
  excludeUrls?: Set<string>
): FeedEntry | null {
  const excluded = excludeUrls ?? new Set<string>();
  const candidates = entries.filter(
    (e) =>
      e.link &&
      !excluded.has(e.link) &&
      keywordScore(e.title ?? "", LOW_SIGNAL_TITLE_KEYWORDS) === 0
  );

  if (candidates.length === 0) return null;

  if (filterKeywords && filterKeywords.length > 0) {
    const exactMatches = candidates.filter(
      (e) => keywordScore(e.title ?? "", filterKeywords) > 0
    );
    if (exactMatches.length > 0) return exactMatches[0];

    const relevanceMatches = candidates
      .map((e) => ({
        score: keywordScore(e.title ?? "", GENERIC_BACKEND_RELEVANCE_KEYWORDS),
        entry: e,
      }))
      .filter(({ score }) => score > 0)
      // stable sort (feed order = newest-first), higher score first
      .sort((a, b) => b.score - a.score);

    if (relevanceMatches.length > 0) return relevanceMatches[0].entry;
    return null;
  }

  return candidates[0];
}

// ── public entry point ────────────────────────────────────────────────────────

export async function discoverForItem(
  item: ReservoirItem,
  cacheDir: string,
  excludeUrls?: Set<string>,
  ttlHours: number = DEFAULT_CACHE_TTL_HOURS,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<FeedEntry | null> {
  const feedUrl = item.feedUrl;
  if (!feedUrl) return null;
  const entries = await fetchFeedCached(feedUrl, cacheDir, ttlHours, timeoutMs);
  if (entries.length === 0) return null;
  return selectArticle(entries, item.filterKeywords, excludeUrls);
}
