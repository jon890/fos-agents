import { createHash } from "node:crypto";

const TRACKING_PARAMETERS = new Set(["fbclid", "feature", "gclid", "si"]);

function youtubeVideoId(url: URL): string | undefined {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0];
  if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
    if (url.pathname === "/watch") return url.searchParams.get("v") ?? undefined;
    const parts = url.pathname.split("/").filter(Boolean);
    if (["embed", "live", "shorts"].includes(parts[0] ?? "")) return parts[1];
  }
  return undefined;
}

export function canonicalizeReadingUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`HTTPS URL이어야 한다: ${value}`);

  const videoId = youtubeVideoId(url);
  if (videoId) return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMETERS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function readingContentKey(value: string): string {
  const canonicalUrl = canonicalizeReadingUrl(value);
  const videoId = youtubeVideoId(new URL(canonicalUrl));
  if (videoId) return `youtube:${videoId}`;
  return `url:${createHash("sha256").update(canonicalUrl).digest("hex")}`;
}
