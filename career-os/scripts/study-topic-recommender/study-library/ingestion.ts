import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { ReadingSource } from "../reading_contracts.js";
import { parseFeed } from "../source/feed.js";
import { extractPageLinks } from "../source/adapters/page.js";
import type { CollectedReading } from "../source/adapters/types.js";
import { collectArchiveSource, type ArchiveCursor } from "../source/archive/index.js";
import { canonicalizeReadingUrl, readingContentKey } from "../url_identity.js";
import type { StudyLibraryClient } from "./client.js";

export const INGESTION_BATCH_LIMIT = 100;
export const CURSOR_MAX_BYTES = 64 * 1024;

export type LibraryCollectMode = "recent" | "archive";
export type LibraryFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface StudyLibraryIngestionItem {
  contentKey: string;
  canonicalUrl: string;
  url: string;
  title: string;
  published: string;
  publishedAt: string | null;
  excerpt: string | null;
  kind: CollectedReading["kind"];
  tags: string[];
  collectedAt: string;
}

export interface StudyLibraryIngestionPayload {
  sourceKey: string;
  mode: LibraryCollectMode;
  items: StudyLibraryIngestionItem[];
  cursor: Record<string, unknown> | null;
  expectedCursorVersion: number;
  idempotencyKey: string;
}

export interface LibraryCollectStatus {
  sourceKey: string;
  status: "ingested" | "skipped" | "unavailable" | "failed";
  acceptedCount: number;
  cursorUpdated: boolean;
  reason?: string;
}

export interface CollectAndIngestResult {
  mode: LibraryCollectMode;
  sourceCount: number;
  acceptedCount: number;
  cursorUpdates: number;
  statuses: LibraryCollectStatus[];
}

interface RecentCursor {
  lastSeen?: string[];
  fetchedAt?: string;
  rssOnly?: boolean;
}

export interface CollectAndIngestOptions {
  client: StudyLibraryClient;
  sources: ReadingSource[];
  mode: LibraryCollectMode;
  sourceKey?: string;
  maxItems: number;
  resetCursor?: boolean;
  timeoutMs: number;
  fetchImpl?: LibraryFetch;
  now?: () => Date;
  youtubeApiKey?: string;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => {
    return `${JSON.stringify(key)}:${stableJson(record[key])}`;
  }).join(",")}}`;
}

function hash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function assertCursorSize(cursor: Record<string, unknown> | null): void {
  if (cursor && Buffer.byteLength(JSON.stringify(cursor), "utf8") > CURSOR_MAX_BYTES) {
    throw new Error("cursor JSON이 64KiB를 초과한다.");
  }
}

function trimLastSeen(cursor: RecentCursor): RecentCursor {
  let lastSeen = cursor.lastSeen ?? [];
  let next: RecentCursor = { ...cursor, lastSeen };
  while (Buffer.byteLength(JSON.stringify(next), "utf8") > CURSOR_MAX_BYTES && lastSeen.length > 0) {
    lastSeen = lastSeen.slice(1);
    next = { ...next, lastSeen };
  }
  assertCursorSize(next as Record<string, unknown>);
  return next;
}

function parsePublishedAt(published: string): string | null {
  if (!published.trim()) return null;
  const date = new Date(published);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toIngestionItem(item: CollectedReading, collectedAt: string): StudyLibraryIngestionItem {
  const canonicalUrl = canonicalizeReadingUrl(item.url);
  return {
    contentKey: readingContentKey(canonicalUrl),
    canonicalUrl,
    url: item.url,
    title: item.title,
    published: item.published,
    publishedAt: parsePublishedAt(item.published),
    excerpt: item.excerpt ?? null,
    kind: item.kind,
    tags: [],
    collectedAt,
  };
}

function assertNoDuplicateContentKeys(items: StudyLibraryIngestionItem[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.contentKey)) {
      throw new Error(`같은 ingestion 배치에 중복 contentKey가 있다: ${item.contentKey}`);
    }
    seen.add(item.contentKey);
  }
}

export function buildIngestionPayload(input: {
  sourceKey: string;
  mode: LibraryCollectMode;
  items: StudyLibraryIngestionItem[];
  cursor: Record<string, unknown> | null;
  expectedCursorVersion: number;
}): StudyLibraryIngestionPayload {
  if (input.items.length > INGESTION_BATCH_LIMIT) {
    throw new Error("ingestion items는 한 배치에 100개 이하여야 한다.");
  }
  assertNoDuplicateContentKeys(input.items);
  assertCursorSize(input.cursor);
  const contentKeys = input.items.map((item) => item.contentKey).sort();
  const idempotencySeed = {
    sourceKey: input.sourceKey,
    mode: input.mode,
    expectedCursorVersion: input.expectedCursorVersion,
    contentKeys,
    nextCursorHash: hash(input.cursor),
  };
  return {
    ...input,
    idempotencyKey: `ing:${hash(idempotencySeed).slice(0, 48)}`,
  };
}

async function fetchText(url: string, timeoutMs: number, fetchImpl?: LibraryFetch): Promise<string> {
  const response = await (fetchImpl ?? fetch)(url, {
    headers: { "User-Agent": "career-os-morning/1.0" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

function validXml(xml: string): boolean {
  return XMLValidator.validate(xml) === true;
}

function hasFeedRoot(xml: string): boolean {
  const parsed = new XMLParser({ removeNSPrefix: true }).parse(xml) as Record<string, unknown>;
  return typeof parsed === "object" && parsed !== null && (parsed.rss !== undefined || parsed.feed !== undefined);
}

function looksLikeHtmlDocument(html: string): boolean {
  return /<!doctype\s+html\b|<html\b|<body\b|<a\b/i.test(html);
}

async function collectRecentSource(input: {
  source: ReadingSource;
  cursor: RecentCursor;
  maxItems: number;
  timeoutMs: number;
  fetchImpl?: LibraryFetch;
  collectedAt: string;
}): Promise<{ status: "collected" | "failed"; reason?: string; items: StudyLibraryIngestionItem[]; cursor: RecentCursor }> {
  try {
    const collected: CollectedReading[] = [];
    if (input.source.adapter === "page") {
      if (!input.source.url) throw new Error("page source URL 없음");
      const html = await fetchText(input.source.url, input.timeoutMs, input.fetchImpl);
      if (!looksLikeHtmlDocument(html)) throw new Error("page HTML 구조가 아니다.");
      collected.push(...extractPageLinks(html, input.source.url, Number.MAX_SAFE_INTEGER));
    } else {
      if (!input.source.feedUrl) throw new Error("feed URL 없음");
      const xml = await fetchText(input.source.feedUrl, input.timeoutMs, input.fetchImpl);
      if (!validXml(xml)) throw new Error("feed XML 파싱 실패");
      if (!hasFeedRoot(xml)) throw new Error("feed root가 rss 또는 feed가 아니다.");
      const entries = parseFeed(xml);
      for (const entry of entries) {
        try {
          const canonicalUrl = canonicalizeReadingUrl(entry.link);
          collected.push({
            title: entry.title,
            url: canonicalUrl,
            published: entry.published || "",
            excerpt: entry.description,
            kind: input.source.adapter === "youtube" || input.source.category === "video"
              ? "feed-video"
              : "feed-article",
          });
        } catch {
          // 잘못된 항목 하나는 정상 feed 전체 실패로 보지 않는다.
        }
      }
    }
    const previousSeen = new Set(input.cursor.lastSeen ?? []);
    const responseKeys = collected.map((item) => readingContentKey(canonicalizeReadingUrl(item.url)));
    const newItems: StudyLibraryIngestionItem[] = [];
    const savedKeys = new Set<string>();
    for (let index = 0; index < collected.length && newItems.length < input.maxItems; index += 1) {
      const key = responseKeys[index];
      if (previousSeen.has(key)) continue;
      const apiItem = toIngestionItem(collected[index], input.collectedAt);
      newItems.push(apiItem);
      savedKeys.add(apiItem.contentKey);
    }
    const seenInCurrentResponse = (input.cursor.lastSeen ?? []).filter((key) => responseKeys.includes(key));
    const nextSeen = [...seenInCurrentResponse, ...responseKeys.filter((key) => savedKeys.has(key))];
    return {
      status: "collected",
      items: newItems,
      cursor: trimLastSeen({
        lastSeen: [...new Set(nextSeen)],
        fetchedAt: input.source.adapter === "youtube" ? undefined : input.collectedAt,
        rssOnly: input.source.adapter === "youtube" ? true : undefined,
      }),
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
      items: [],
      cursor: input.cursor,
    };
  }
}

async function ingestPayload(client: StudyLibraryClient, payload: StudyLibraryIngestionPayload): Promise<number> {
  const result = await client.createIngestion(payload);
  return result.acceptedCount;
}

async function collectOneBatch(input: {
  options: CollectAndIngestOptions;
  source: ReadingSource;
  cursor: Record<string, unknown> | null;
  cursorVersion: number;
  batchLimit: number;
  collectedAt: string;
}): Promise<LibraryCollectStatus & { nextCursor: Record<string, unknown> | null; accepted: number }> {
  if (input.options.mode === "archive") {
    const result = await collectArchiveSource({
      source: input.source,
      cursor: input.cursor as ArchiveCursor | null,
      reset: input.options.resetCursor,
      context: {
        maxItems: input.batchLimit,
        timeoutMs: input.options.timeoutMs,
        fetchImpl: input.options.fetchImpl,
        youtubeApiKey: input.options.youtubeApiKey,
      },
    });
    if (result.status !== "collected") {
      return {
        sourceKey: input.source.key,
        status: result.status,
        reason: result.reason,
        acceptedCount: 0,
        cursorUpdated: false,
        nextCursor: input.cursor,
        accepted: 0,
      };
    }
    const items = result.items.map((item) => toIngestionItem(item, input.collectedAt));
    const payload = buildIngestionPayload({
      sourceKey: input.source.key,
      mode: "archive",
      items,
      cursor: result.cursor,
      expectedCursorVersion: input.cursorVersion,
    });
    const accepted = await ingestPayload(input.options.client, payload);
    return {
      sourceKey: input.source.key,
      status: "ingested",
      acceptedCount: accepted,
      cursorUpdated: true,
      nextCursor: result.cursor,
      accepted,
    };
  }

  const result = await collectRecentSource({
    source: input.source,
    cursor: (input.cursor ?? {}) as RecentCursor,
    maxItems: input.batchLimit,
    timeoutMs: input.options.timeoutMs,
    fetchImpl: input.options.fetchImpl,
    collectedAt: input.collectedAt,
  });
  if (result.status !== "collected") {
    return {
      sourceKey: input.source.key,
      status: "failed",
      reason: result.reason,
      acceptedCount: 0,
      cursorUpdated: false,
      nextCursor: input.cursor,
      accepted: 0,
    };
  }
  const payload = buildIngestionPayload({
    sourceKey: input.source.key,
    mode: "recent",
    items: result.items,
    cursor: result.cursor as Record<string, unknown>,
    expectedCursorVersion: input.cursorVersion,
  });
  const accepted = await ingestPayload(input.options.client, payload);
  return {
    sourceKey: input.source.key,
    status: "ingested",
    acceptedCount: accepted,
    cursorUpdated: true,
    nextCursor: result.cursor as Record<string, unknown>,
    accepted,
  };
}

function selectedSources(sources: ReadingSource[], sourceKey?: string): ReadingSource[] {
  if (!sourceKey) return sources;
  const selected = sources.filter((source) => source.key === sourceKey);
  if (selected.length === 0) {
    throw new Error(`활성 소스에서 sourceKey를 찾을 수 없다: ${sourceKey}`);
  }
  return selected;
}

export async function collectAndIngestStudyLibrary(input: CollectAndIngestOptions): Promise<CollectAndIngestResult> {
  if (!Number.isInteger(input.maxItems) || input.maxItems <= 0) {
    throw new Error("maxItems는 양의 정수여야 한다.");
  }
  const sources = selectedSources(input.sources, input.sourceKey);
  const statuses: LibraryCollectStatus[] = [];
  let acceptedCount = 0;
  let cursorUpdates = 0;
  const maxItems = input.maxItems;
  const collectedAt = (input.now ?? (() => new Date()))().toISOString();

  for (const source of sources) {
    const cursorResult = await input.client.getSourceCursor(source.key, input.mode);
    let cursor = input.resetCursor && input.mode === "archive" ? null : cursorResult.cursor;
    let cursorVersion = cursorResult.version;
    let remaining = maxItems;
    let sourceAccepted = 0;
    let sourceUpdates = 0;
    let terminalStatus: LibraryCollectStatus | null = null;

    do {
      const batchLimit = Math.min(INGESTION_BATCH_LIMIT, remaining || INGESTION_BATCH_LIMIT);
      const batch = await collectOneBatch({
        options: input,
        source,
        cursor,
        cursorVersion,
        batchLimit,
        collectedAt,
      });
      if (batch.status !== "ingested") {
        terminalStatus = batch;
        break;
      }
      sourceAccepted += batch.acceptedCount;
      acceptedCount += batch.acceptedCount;
      sourceUpdates += 1;
      cursorUpdates += 1;
      cursor = batch.nextCursor;
      cursorVersion += 1;
      remaining -= batch.accepted;
      const done = cursor?.done === true || batch.accepted < batchLimit || remaining <= 0;
      if (done) break;
    } while (remaining > 0);

    statuses.push(terminalStatus ?? {
      sourceKey: source.key,
      status: "ingested",
      acceptedCount: sourceAccepted,
      cursorUpdated: sourceUpdates > 0,
    });
  }

  return {
    mode: input.mode,
    sourceCount: sources.length,
    acceptedCount,
    cursorUpdates,
    statuses,
  };
}
