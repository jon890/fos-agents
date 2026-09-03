import { describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractYouTubeVideos, youtubeSourceAdapter } from "./youtube.js";

describe("YouTube 채널 페이지 어댑터", () => {
  test("초기 페이지 데이터에서 공개 영상 정보를 수집한다", () => {
    const html = `<script>var ytInitialData = ${JSON.stringify({
      contents: [{
        richItemRenderer: {
          content: {
            videoRenderer: {
              videoId: "nfUKLULchXE",
              title: { runs: [{ text: "루프가 아니라 그래프를 설계하는 이유" }] },
              publishedTimeText: { simpleText: "2주 전" },
              descriptionSnippet: { runs: [{ text: "에이전트 실행 그래프를 설명한다." }] },
            },
          },
        },
      }],
    })};</script>`;

    expect(extractYouTubeVideos(html, 8)).toEqual([{
      title: "루프가 아니라 그래프를 설계하는 이유",
      url: "https://www.youtube.com/watch?v=nfUKLULchXE",
      published: "2주 전",
      excerpt: "에이전트 실행 그래프를 설명한다.",
      kind: "page-video",
    }]);
  });

  test("최신 lockup 형식의 영상 정보를 수집한다", () => {
    const html = `<script>var ytInitialData = ${JSON.stringify({
      contents: [{
        richItemRenderer: {
          content: {
            lockupViewModel: {
              contentId: "wQkFDtqwQCk",
              metadata: {
                lockupMetadataViewModel: {
                  title: { content: "AI 자동화에서 얻은 핵심 교훈" },
                  metadata: {
                    contentMetadataViewModel: {
                      metadataRows: [{
                        metadataParts: [
                          { text: { content: "조회수 32회" } },
                          { text: { content: "18분 전" } },
                        ],
                      }],
                    },
                  },
                },
              },
            },
          },
        },
      }],
    })};</script>`;

    expect(extractYouTubeVideos(html, 8)).toEqual([{
      title: "AI 자동화에서 얻은 핵심 교훈",
      url: "https://www.youtube.com/watch?v=wQkFDtqwQCk",
      published: "18분 전",
      kind: "page-video",
    }]);
  });

  test("feedUrl이 있으면 공식 Atom feed를 우선한다", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "youtube-feed."));
    const originalFetch = globalThis.fetch;
    const fetchMock = mock(async () => new Response(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>커리어 판단이 있는 영상</title><link rel="alternate" href="https://www.youtube.com/watch?v=feed123"/><published>2026-09-03T00:00:00Z</published><summary>제품 운영 판단</summary></entry></feed>`, { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    try {
      const items = await youtubeSourceAdapter.collect({
        key: "video",
        title: "영상 채널",
        category: "video",
        url: "https://www.youtube.com/@example",
        feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=example",
        adapter: "youtube",
      }, { cacheDir, cacheTtlHours: 0, timeoutMs: 1_000, maxCandidatesPerSource: 8 });
      expect(items[0]?.url).toBe("https://www.youtube.com/watch?v=feed123");
      expect(items[0]?.kind).toBe("feed-video");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  test("Atom feed가 비면 공개 채널 페이지를 보조 경로로 사용한다", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "youtube-fallback."));
    const originalFetch = globalThis.fetch;
    const html = `<script>var ytInitialData = ${JSON.stringify({ contents: [{ videoRenderer: { videoId: "page123", title: { simpleText: "페이지 영상" } } }] })};</script>`;
    const fetchMock = mock(async (input: string | URL | Request) => {
      const url = String(input);
      return url.includes("feeds/videos.xml")
        ? new Response("", { status: 503 })
        : new Response(html, { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    try {
      const items = await youtubeSourceAdapter.collect({
        key: "video",
        title: "영상 채널",
        category: "video",
        url: "https://www.youtube.com/@example",
        feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=example",
        adapter: "youtube",
      }, { cacheDir, cacheTtlHours: 0, timeoutMs: 1_000, maxCandidatesPerSource: 8 });
      expect(items[0]?.url).toBe("https://www.youtube.com/watch?v=page123");
      expect(items[0]?.kind).toBe("page-video");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });
});
