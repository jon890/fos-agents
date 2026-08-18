import type { CollectedReading, ReadingSourceAdapter } from "./types.js";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown): string {
  if (!isObject(value)) return "";
  if (typeof value.simpleText === "string") return value.simpleText.trim();
  if (!Array.isArray(value.runs)) return "";
  return value.runs
    .map((run) => isObject(run) && typeof run.text === "string" ? run.text : "")
    .join("")
    .trim();
}

function extractJsonObject(html: string, marker: string): unknown {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return undefined;
  const start = html.indexOf("{", markerIndex + marker.length);
  if (start < 0) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, index + 1)) as unknown;
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

function initialData(html: string): unknown {
  for (const marker of ["var ytInitialData = ", "window[\"ytInitialData\"] = ", "ytInitialData = "]) {
    const value = extractJsonObject(html, marker);
    if (value !== undefined) return value;
  }
  return undefined;
}

function rendererToVideo(renderer: unknown): CollectedReading | null {
  if (!isObject(renderer) || typeof renderer.videoId !== "string") return null;
  const title = textValue(renderer.title);
  if (!title) return null;
  const excerpt = textValue(renderer.descriptionSnippet)
    || (Array.isArray(renderer.detailedMetadataSnippets)
      ? renderer.detailedMetadataSnippets.map((item) => {
        return isObject(item) ? textValue(item.snippetText) : "";
      }).find(Boolean) ?? ""
      : "");
  return {
    title,
    url: `https://www.youtube.com/watch?v=${renderer.videoId}`,
    published: textValue(renderer.publishedTimeText),
    excerpt: excerpt || undefined,
    kind: "page-video",
  };
}

function lockupToVideo(renderer: unknown): CollectedReading | null {
  if (!isObject(renderer) || typeof renderer.contentId !== "string") return null;
  const metadata = isObject(renderer.metadata) ? renderer.metadata : undefined;
  const lockupMetadata = metadata && isObject(metadata.lockupMetadataViewModel)
    ? metadata.lockupMetadataViewModel
    : undefined;
  const titleValue = lockupMetadata && isObject(lockupMetadata.title)
    ? lockupMetadata.title.content
    : undefined;
  if (typeof titleValue !== "string" || !titleValue.trim()) return null;

  const detail = lockupMetadata && isObject(lockupMetadata.metadata)
    ? lockupMetadata.metadata.contentMetadataViewModel
    : undefined;
  const rows = isObject(detail) && Array.isArray(detail.metadataRows)
    ? detail.metadataRows
    : [];
  const firstRow = isObject(rows[0]) && Array.isArray(rows[0].metadataParts)
    ? rows[0].metadataParts
    : [];
  const publishedPart = isObject(firstRow[1]) && isObject(firstRow[1].text)
    ? firstRow[1].text.content
    : undefined;

  return {
    title: titleValue.trim(),
    url: `https://www.youtube.com/watch?v=${renderer.contentId}`,
    published: typeof publishedPart === "string" ? publishedPart.trim() : "",
    kind: "page-video",
  };
}

export function extractYouTubeVideos(html: string, limit: number): CollectedReading[] {
  const root = initialData(html);
  if (root === undefined) return [];

  const videos = new Map<string, CollectedReading>();
  const pending: unknown[] = [root];
  let cursor = 0;
  while (cursor < pending.length && videos.size < limit) {
    const current = pending[cursor];
    cursor += 1;
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    if (!isObject(current)) continue;

    for (const key of ["videoRenderer", "gridVideoRenderer"]) {
      const video = rendererToVideo(current[key]);
      if (video) videos.set(video.url, video);
    }
    const lockupVideo = lockupToVideo(current.lockupViewModel);
    if (lockupVideo) videos.set(lockupVideo.url, lockupVideo);
    pending.push(...Object.values(current));
  }
  return [...videos.values()].slice(0, limit);
}

function channelVideosUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.endsWith("youtube.com")) return null;
    url.pathname = `${url.pathname.replace(/\/$/, "")}/videos`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export const youtubeSourceAdapter: ReadingSourceAdapter = {
  id: "youtube",
  supports: (source) => Boolean(source.url?.includes("youtube.com/")),
  async collect(source, context) {
    const url = source.url ? channelVideosUrl(source.url) : null;
    if (!url) return [];
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 career-os-morning/1.0" },
        signal: AbortSignal.timeout(context.timeoutMs),
      });
      if (!response.ok) return [];
      return extractYouTubeVideos(await response.text(), context.maxCandidatesPerSource);
    } catch {
      return [];
    }
  },
};
