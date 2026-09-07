import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { ReadingSource } from "../../reading_contracts.js";
import type { CollectedReading } from "../adapters/types.js";

export const ARCHIVE_CURSOR_MAX_BYTES = 64 * 1024;

export type ArchiveMode = "sitemap-index" | "sitemap-posts" | "youtube-uploads";
export type ArchiveFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface ArchiveRegistryEntry {
  sourceKey: string;
  mode: ArchiveMode;
  sitemapIndexUrl?: string;
  sitemapUrl?: string;
  onlyPathPrefix?: string;
}

export interface ArchiveCollectContext {
  maxItems: number;
  timeoutMs: number;
  fetchImpl?: ArchiveFetch;
  youtubeApiKey?: string;
}

export type ArchiveCursor = Record<string, unknown>;

interface PendingYoutubeVideo {
  videoId: string;
  title?: string;
  published?: string;
}

export interface ArchiveCollectResult {
  status: "collected" | "skipped" | "unavailable" | "failed";
  reason?: string;
  items: CollectedReading[];
  cursor: ArchiveCursor | null;
}

const REGISTRY: Record<string, ArchiveRegistryEntry> = {
  "kurly-tech": {
    sourceKey: "kurly-tech",
    mode: "sitemap-index",
    sitemapIndexUrl: "https://helloworld.kurly.com/sitemap-index.xml",
  },
  "oliveyoung-tech": {
    sourceKey: "oliveyoung-tech",
    mode: "sitemap-index",
    sitemapIndexUrl: "https://oliveyoung.tech/sitemap-index.xml",
  },
  "kakao-tech": {
    sourceKey: "kakao-tech",
    mode: "sitemap-posts",
    sitemapUrl: "https://tech.kakao.com/sitemap.xml",
    onlyPathPrefix: "/posts/",
  },
};

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function parser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    isArray: (name) => ["sitemap", "url", "item", "entry", "link"].includes(name),
    trimValues: true,
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record["#text"] === "string") return record["#text"].trim();
  }
  return "";
}

function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function xmlLocations(xml: string, rootName: "sitemapindex" | "urlset"): string[] {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new Error("sitemap XML 파싱 실패");
  }
  const parsed = asRecord(parser().parse(xml));
  const root = asRecord(parsed[rootName]);
  if (parsed[rootName] === undefined) {
    throw new Error(`sitemap root가 ${rootName}이 아니다.`);
  }
  const rows = rootName === "sitemapindex" ? root.sitemap : root.url;
  const values = Array.isArray(rows) ? rows : rows ? [rows] : [];
  return values
    .map((row) => safeHttpsUrl(text(asRecord(row).loc)))
    .filter((value): value is string => Boolean(value));
}

async function fetchText(url: string, context: ArchiveCollectContext): Promise<string> {
  const fetchImpl = context.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    headers: { "User-Agent": "career-os-morning/1.0" },
    signal: AbortSignal.timeout(context.timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

function trimCursor(cursor: ArchiveCursor): ArchiveCursor {
  let next = cursor;
  while (Buffer.byteLength(JSON.stringify(next), "utf8") > ARCHIVE_CURSOR_MAX_BYTES) {
    if (Array.isArray(next.pendingSitemaps) && next.pendingSitemaps.length > 0) {
      next = {
        ...next,
        pendingSitemaps: [],
        pendingSitemapsTrimmed: true,
        completedSitemapCount: typeof next.completedSitemapCount === "number" ? next.completedSitemapCount : 0,
      };
      continue;
    }
    if (Array.isArray(next.completedSitemaps) && next.completedSitemaps.length > 0) {
      next = {
        ...next,
        completedSitemaps: [],
        completedSitemapCount: (typeof next.completedSitemapCount === "number" ? next.completedSitemapCount : 0)
          + next.completedSitemaps.length,
      };
      continue;
    }
    throw new Error("archive cursor가 64KiB를 초과한다.");
  }
  return next;
}

function initialSitemapIndexCursor(entry: ArchiveRegistryEntry): ArchiveCursor {
  return {
    sitemapIndexUrl: entry.sitemapIndexUrl,
    indexDigest: null,
    pendingSitemaps: [],
    completedSitemaps: [],
    currentSitemap: null,
    lastUrl: null,
    done: false,
  };
}

function initialSitemapPostsCursor(entry: ArchiveRegistryEntry): ArchiveCursor {
  return {
    sitemapUrl: entry.sitemapUrl,
    sitemapDigest: null,
    onlyPathPrefix: entry.onlyPathPrefix,
    lastUrl: null,
    done: false,
  };
}

function channelIdFromFeedUrl(feedUrl?: string): string | null {
  if (!feedUrl) return null;
  try {
    const url = new URL(feedUrl);
    const channelId = url.searchParams.get("channel_id");
    return channelId?.startsWith("UC") ? channelId : null;
  } catch {
    return null;
  }
}

function uploadsPlaylistIdFor(source: ReadingSource): string | null {
  const channelId = channelIdFromFeedUrl(source.feedUrl);
  return channelId ? `UU${channelId.slice(2)}` : null;
}

function initialYoutubeCursor(source: ReadingSource): ArchiveCursor | null {
  const uploadsPlaylistId = uploadsPlaylistIdFor(source);
  if (!uploadsPlaylistId) return null;
  return {
    uploadsPlaylistId,
    pageToken: null,
    nextPageToken: null,
    pendingVideoIds: [],
    pendingVideos: [],
    apiKeyRequired: true,
    done: false,
  };
}

export function resolveArchiveRegistryEntry(source: ReadingSource): ArchiveRegistryEntry | null {
  if (REGISTRY[source.key]) return REGISTRY[source.key];
  if (source.adapter === "youtube" || source.category === "video") {
    return { sourceKey: source.key, mode: "youtube-uploads" };
  }
  return null;
}

export function initialArchiveCursorForSource(source: ReadingSource): ArchiveCursor | null {
  const entry = resolveArchiveRegistryEntry(source);
  if (!entry) return null;
  if (entry.mode === "sitemap-index") return initialSitemapIndexCursor(entry);
  if (entry.mode === "sitemap-posts") return initialSitemapPostsCursor(entry);
  return initialYoutubeCursor(source);
}

function urlTitle(url: string): string {
  const parsed = new URL(url);
  const last = parsed.pathname.split("/").filter(Boolean).at(-1) ?? parsed.hostname;
  return decodeURIComponent(last).replace(/[-_]+/g, " ").trim() || url;
}

function linkItem(url: string): CollectedReading {
  return {
    title: urlTitle(url),
    url,
    published: "",
    kind: "page-link",
  };
}

async function collectFromSitemapUrl(input: {
  sitemapUrl: string;
  previousDigest: unknown;
  lastUrl: unknown;
  onlyPathPrefix?: string;
  context: ArchiveCollectContext;
}): Promise<{ items: CollectedReading[]; digest: string; lastUrl: string | null; done: boolean }> {
  const xml = await fetchText(input.sitemapUrl, input.context);
  const digest = sha256(xml);
  if (typeof input.previousDigest === "string" && input.previousDigest !== digest) {
    throw new Error("sitemap digest가 변경되어 cursor를 진행할 수 없다.");
  }
  const seenLast = typeof input.lastUrl !== "string" || input.lastUrl.length === 0;
  let passedLast = seenLast;
  const accepted: string[] = [];
  for (const url of xmlLocations(xml, "urlset")) {
    if (input.onlyPathPrefix) {
      const parsed = new URL(url);
      if (!parsed.pathname.startsWith(input.onlyPathPrefix)) continue;
    }
    if (!passedLast) {
      passedLast = url === input.lastUrl;
      continue;
    }
    if (url === input.lastUrl) continue;
    accepted.push(url);
    if (accepted.length >= input.context.maxItems) break;
  }
  const lastUrl = accepted.at(-1) ?? (typeof input.lastUrl === "string" ? input.lastUrl : null);
  const allUrls = xmlLocations(xml, "urlset").filter((url) => {
    if (!input.onlyPathPrefix) return true;
    return new URL(url).pathname.startsWith(input.onlyPathPrefix);
  });
  return {
    items: accepted.map(linkItem),
    digest,
    lastUrl,
    done: allUrls.length === 0 || lastUrl === allUrls.at(-1),
  };
}

async function collectSitemapPosts(
  entry: ArchiveRegistryEntry,
  cursor: ArchiveCursor,
  context: ArchiveCollectContext
): Promise<ArchiveCollectResult> {
  const sitemapUrl = typeof cursor.sitemapUrl === "string" ? cursor.sitemapUrl : entry.sitemapUrl!;
  const collected = await collectFromSitemapUrl({
    sitemapUrl,
    previousDigest: cursor.sitemapDigest,
    lastUrl: cursor.lastUrl,
    onlyPathPrefix: entry.onlyPathPrefix,
    context,
  });
  return {
    status: "collected",
    items: collected.items,
    cursor: trimCursor({
      sitemapUrl,
      sitemapDigest: collected.digest,
      onlyPathPrefix: entry.onlyPathPrefix,
      lastUrl: collected.lastUrl,
      done: collected.done,
    }),
  };
}

async function collectSitemapIndex(
  entry: ArchiveRegistryEntry,
  cursor: ArchiveCursor,
  context: ArchiveCollectContext
): Promise<ArchiveCollectResult> {
  const indexUrl = typeof cursor.sitemapIndexUrl === "string" ? cursor.sitemapIndexUrl : entry.sitemapIndexUrl!;
  const indexXml = await fetchText(indexUrl, context);
  const indexDigest = sha256(indexXml);
  if (typeof cursor.indexDigest === "string" && cursor.indexDigest !== indexDigest) {
    throw new Error("sitemap index digest가 변경되어 cursor를 진행할 수 없다.");
  }
  const allSitemaps = xmlLocations(indexXml, "sitemapindex");
  const completedCount = typeof cursor.completedSitemapCount === "number"
    ? cursor.completedSitemapCount
    : Array.isArray(cursor.completedSitemaps)
      ? cursor.completedSitemaps.filter((v): v is string => typeof v === "string").length
      : 0;
  const completed = new Set<string>();
  const pendingWasTrimmed = cursor.pendingSitemapsTrimmed === true;
  let pending = Array.isArray(cursor.pendingSitemaps) && typeof cursor.indexDigest === "string" && !pendingWasTrimmed
    ? cursor.pendingSitemaps.filter((v): v is string => typeof v === "string")
    : allSitemaps.slice(completedCount);
  let currentSitemap = typeof cursor.currentSitemap === "string" ? cursor.currentSitemap : pending.shift() ?? null;
  let lastUrl = typeof cursor.lastUrl === "string" ? cursor.lastUrl : null;
  if (pendingWasTrimmed && currentSitemap) {
    pending = pending.filter((url) => url !== currentSitemap);
  }
  const items: CollectedReading[] = [];
  let currentSitemapDigest: string | null = typeof cursor.currentSitemapDigest === "string"
    ? cursor.currentSitemapDigest
    : null;

  while (currentSitemap && items.length < context.maxItems) {
    const collected = await collectFromSitemapUrl({
      sitemapUrl: currentSitemap,
      previousDigest: cursor.currentSitemap === currentSitemap ? cursor.currentSitemapDigest : null,
      lastUrl,
      context: { ...context, maxItems: context.maxItems - items.length },
    });
    items.push(...collected.items);
    lastUrl = collected.lastUrl;
    currentSitemapDigest = collected.digest;
    if (!collected.done) break;
    completed.add(currentSitemap);
    currentSitemap = pending.shift() ?? null;
    currentSitemapDigest = null;
    lastUrl = null;
  }

  const done = !currentSitemap && pending.length === 0;
  const nextCompletedSitemapCount = completedCount + completed.size;
  return {
    status: "collected",
    items,
    cursor: trimCursor({
      sitemapIndexUrl: indexUrl,
      indexDigest,
      pendingSitemaps: pending,
      completedSitemaps: [...completed],
      completedSitemapCount: nextCompletedSitemapCount,
      currentSitemap,
      currentSitemapDigest,
      lastUrl,
      done,
    }),
  };
}

function videoItem(videoId: string, title?: string, published?: string): CollectedReading {
  return {
    title: title?.trim() || `YouTube video ${videoId}`,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    published: published ?? "",
    kind: "page-video",
  };
}

function pendingVideosFromCursor(cursor: ArchiveCursor): PendingYoutubeVideo[] {
  if (Array.isArray(cursor.pendingVideos)) {
    return cursor.pendingVideos
      .map((value) => asRecord(value))
      .filter((value) => typeof value.videoId === "string")
      .map((value) => ({
        videoId: value.videoId as string,
        title: typeof value.title === "string" ? value.title : undefined,
        published: typeof value.published === "string" ? value.published : undefined,
      }));
  }
  return Array.isArray(cursor.pendingVideoIds)
    ? cursor.pendingVideoIds
      .filter((value): value is string => typeof value === "string")
      .map((videoId) => ({ videoId }))
    : [];
}

async function collectYoutubeUploads(
  source: ReadingSource,
  cursor: ArchiveCursor,
  context: ArchiveCollectContext
): Promise<ArchiveCollectResult> {
  if (!context.youtubeApiKey) {
    return {
      status: "unavailable",
      reason: "YOUTUBE_DATA_API_KEY 없음",
      items: [],
      cursor,
    };
  }
  const uploadsPlaylistId = typeof cursor.uploadsPlaylistId === "string"
    ? cursor.uploadsPlaylistId
    : uploadsPlaylistIdFor(source);
  if (!uploadsPlaylistId) {
    return { status: "skipped", reason: "uploads playlist를 계산할 수 없다.", items: [], cursor: null };
  }
  const pending = pendingVideosFromCursor(cursor);
  const acceptedPending = pending.slice(0, context.maxItems);
  const items: CollectedReading[] = acceptedPending.map((video) => videoItem(video.videoId, video.title, video.published));
  const remainingPending = pending.slice(acceptedPending.length);
  const cursorPageToken = typeof cursor.pageToken === "string" ? cursor.pageToken : null;
  const cursorNextPageToken = typeof cursor.nextPageToken === "string" ? cursor.nextPageToken : null;
  if (items.length >= context.maxItems || remainingPending.length > 0) {
    return {
      status: "collected",
      items,
      cursor: trimCursor({
        uploadsPlaylistId,
        pageToken: cursorPageToken,
        nextPageToken: cursorNextPageToken,
        pendingVideoIds: remainingPending.map((video) => video.videoId),
        pendingVideos: remainingPending,
        apiKeyRequired: true,
        done: false,
      }),
    };
  }
  if (pending.length > 0 && !cursorNextPageToken) {
    return {
      status: "collected",
      items,
      cursor: trimCursor({
        uploadsPlaylistId,
        pageToken: null,
        nextPageToken: null,
        pendingVideoIds: [],
        pendingVideos: [],
        apiKeyRequired: true,
        done: true,
      }),
    };
  }

  const pageTokenForRequest = pending.length > 0 && cursorNextPageToken
    ? cursorNextPageToken
    : cursorPageToken;
  const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("playlistId", uploadsPlaylistId);
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("key", context.youtubeApiKey);
  if (pageTokenForRequest) {
    url.searchParams.set("pageToken", pageTokenForRequest);
  }

  const raw = await fetchText(url.toString(), context);
  const parsed = JSON.parse(raw) as {
    nextPageToken?: string;
    items?: Array<{ contentDetails?: { videoId?: string }; snippet?: { title?: string; publishedAt?: string } }>;
  };
  const pageItems = Array.isArray(parsed.items) ? parsed.items : [];
  const pageVideos: PendingYoutubeVideo[] = [];
  for (const item of pageItems) {
    const videoId = item.contentDetails?.videoId;
    if (typeof videoId === "string") {
      pageVideos.push({
        videoId,
        title: item.snippet?.title,
        published: item.snippet?.publishedAt,
      });
    }
  }
  const remainingCapacity = context.maxItems - items.length;
  const accepted = pageVideos.slice(0, remainingCapacity);
  items.push(...accepted.map((item) => videoItem(item.videoId, item.title, item.published)));
  const leftover = pageVideos.slice(accepted.length);
  const nextPageToken = parsed.nextPageToken ?? null;
  return {
    status: "collected",
    items,
    cursor: trimCursor({
      uploadsPlaylistId,
      pageToken: leftover.length > 0 ? pageTokenForRequest : nextPageToken,
      nextPageToken: leftover.length > 0 ? nextPageToken : null,
      pendingVideoIds: leftover.map((item) => item.videoId),
      pendingVideos: leftover,
      apiKeyRequired: true,
      done: leftover.length === 0 && !nextPageToken,
    }),
  };
}

export async function collectArchiveSource(input: {
  source: ReadingSource;
  cursor: ArchiveCursor | null;
  reset?: boolean;
  context: ArchiveCollectContext;
}): Promise<ArchiveCollectResult> {
  const entry = resolveArchiveRegistryEntry(input.source);
  if (!entry) {
    return { status: "skipped", reason: "archive mode를 지원하지 않는 sourceKey", items: [], cursor: null };
  }
  const cursor = input.reset || !input.cursor
    ? initialArchiveCursorForSource(input.source)
    : input.cursor;
  if (!cursor) {
    return { status: "skipped", reason: "초기 archive cursor를 만들 수 없다.", items: [], cursor: null };
  }
  if (cursor.done === true && !input.reset) {
    return { status: "collected", items: [], cursor };
  }
  try {
    if (entry.mode === "sitemap-index") return await collectSitemapIndex(entry, cursor, input.context);
    if (entry.mode === "sitemap-posts") return await collectSitemapPosts(entry, cursor, input.context);
    return await collectYoutubeUploads(input.source, cursor, input.context);
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
      items: [],
      cursor,
    };
  }
}
