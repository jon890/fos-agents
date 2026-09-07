import { describe, expect, test } from "bun:test";
import { collectArchiveSource, initialArchiveCursorForSource } from "./registry.js";
import type { ReadingSource } from "../../reading_contracts.js";

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/xml" },
  });
}

const kurly: ReadingSource = {
  key: "kurly-tech",
  title: "Kurly",
  category: "techBlog",
  url: "https://helloworld.kurly.com/",
  feedUrl: "https://helloworld.kurly.com/rss.xml",
  adapter: "feed",
};

const olive: ReadingSource = {
  ...kurly,
  key: "oliveyoung-tech",
  title: "OliveYoung",
  url: "https://oliveyoung.tech/",
  feedUrl: "https://oliveyoung.tech/rss.xml",
};

const kakao: ReadingSource = {
  ...kurly,
  key: "kakao-tech",
  title: "Kakao",
  url: "https://tech.kakao.com/blog/",
  feedUrl: "https://tech.kakao.com/feed/",
};

describe("archive source registry", () => {
  test.each([kurly, olive])("sitemap index cursor가 다음 sitemap과 URL 위치를 보존한다: %p", async (source) => {
    const fetchImpl = async (url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("sitemap-index.xml")) {
        return response(`<sitemapindex>
          <sitemap><loc>${source.url}post-1.xml</loc></sitemap>
          <sitemap><loc>${source.url}post-2.xml</loc></sitemap>
        </sitemapindex>`);
      }
      return response(`<urlset>
        <url><loc>${source.url}a</loc></url>
        <url><loc>${source.url}b</loc></url>
      </urlset>`);
    };

    const result = await collectArchiveSource({
      source,
      cursor: initialArchiveCursorForSource(source),
      context: { maxItems: 1, timeoutMs: 1000, fetchImpl },
    });

    expect(result.status).toBe("collected");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe("page-link");
    expect(result.items[0].published).toBe("");
    expect(result.cursor).toMatchObject({
      currentSitemap: `${source.url}post-1.xml`,
      lastUrl: `${source.url}a`,
      done: false,
    });
  });

  test("Kakao 수집기는 /posts/ 경로만 후보로 만든다", async () => {
    const result = await collectArchiveSource({
      source: kakao,
      cursor: initialArchiveCursorForSource(kakao),
      context: {
        maxItems: 10,
        timeoutMs: 1000,
        fetchImpl: async () => response(`<urlset>
          <url><loc>https://tech.kakao.com/posts/635</loc></url>
          <url><loc>https://tech.kakao.com/events/1</loc></url>
        </urlset>`),
      },
    });

    expect(result.items.map((item) => item.url)).toEqual(["https://tech.kakao.com/posts/635"]);
    expect(result.cursor?.done).toBe(true);
  });

  test("YouTube API 키가 없으면 archive 수집 불가 상태만 반환한다", async () => {
    const source: ReadingSource = {
      key: "video-youtube",
      title: "Video",
      category: "video",
      url: "https://www.youtube.com/@example",
      feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890123456789012",
      adapter: "youtube",
    };

    const result = await collectArchiveSource({
      source,
      cursor: initialArchiveCursorForSource(source),
      context: { maxItems: 48, timeoutMs: 1000 },
    });

    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("YOUTUBE_DATA_API_KEY 없음");
  });

  test("YouTube uploads는 50개 페이지에서 maxItems 48 이후 남은 2개를 보존한다", async () => {
    const source: ReadingSource = {
      key: "video-youtube",
      title: "Video",
      category: "video",
      url: "https://www.youtube.com/@example",
      feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890123456789012",
      adapter: "youtube",
    };
    const items = Array.from({ length: 50 }, (_, index) => ({
      contentDetails: { videoId: `video-${index}` },
      snippet: { title: `Video ${index}`, publishedAt: "2026-09-07T00:00:00.000Z" },
    }));

    const result = await collectArchiveSource({
      source,
      cursor: initialArchiveCursorForSource(source),
      context: {
        maxItems: 48,
        timeoutMs: 1000,
        youtubeApiKey: "api-key",
        fetchImpl: async () => response({ nextPageToken: "next-page", items }),
      },
    });

    expect(result.items).toHaveLength(48);
    expect(result.cursor).toMatchObject({
      pendingVideoIds: ["video-48", "video-49"],
      pendingVideos: [
        { videoId: "video-48", title: "Video 48", published: "2026-09-07T00:00:00.000Z" },
        { videoId: "video-49", title: "Video 49", published: "2026-09-07T00:00:00.000Z" },
      ],
      pageToken: null,
      nextPageToken: "next-page",
      done: false,
    });
  });

  test("YouTube uploads는 pending 2개 뒤 다음 페이지로 진행하고 메타를 보존한다", async () => {
    const source: ReadingSource = {
      key: "video-youtube",
      title: "Video",
      category: "video",
      url: "https://www.youtube.com/@example",
      feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890123456789012",
      adapter: "youtube",
    };
    const firstPage = Array.from({ length: 50 }, (_, index) => ({
      contentDetails: { videoId: `first-${index}` },
      snippet: { title: `First ${index}`, publishedAt: `2026-09-07T00:00:${String(index).padStart(2, "0")}.000Z` },
    }));
    const secondPage = Array.from({ length: 50 }, (_, index) => ({
      contentDetails: { videoId: `second-${index}` },
      snippet: { title: `Second ${index}`, publishedAt: `2026-09-08T00:00:${String(index).padStart(2, "0")}.000Z` },
    }));
    const requestedPageTokens: Array<string | null> = [];
    const fetchImpl = async (url: string | URL | Request) => {
      const parsed = new URL(String(url));
      const pageToken = parsed.searchParams.get("pageToken");
      requestedPageTokens.push(pageToken);
      return pageToken === "next-page"
        ? response({ items: secondPage })
        : response({ nextPageToken: "next-page", items: firstPage });
    };

    const first = await collectArchiveSource({
      source,
      cursor: initialArchiveCursorForSource(source),
      context: { maxItems: 48, timeoutMs: 1000, youtubeApiKey: "api-key", fetchImpl },
    });
    const second = await collectArchiveSource({
      source,
      cursor: first.cursor,
      context: { maxItems: 48, timeoutMs: 1000, youtubeApiKey: "api-key", fetchImpl },
    });

    expect(requestedPageTokens).toEqual([null, "next-page"]);
    expect(second.items).toHaveLength(48);
    expect(second.items.slice(0, 3).map((item) => item.title)).toEqual(["First 48", "First 49", "Second 0"]);
    expect(new Set(second.items.map((item) => item.url)).size).toBe(48);
    expect(second.cursor).toMatchObject({
      pageToken: "next-page",
      nextPageToken: null,
      pendingVideoIds: ["second-46", "second-47", "second-48", "second-49"],
      done: false,
    });
  });

  test("YouTube uploads는 마지막 페이지 pending 소진 뒤 done true로 끝난다", async () => {
    const source: ReadingSource = {
      key: "video-youtube",
      title: "Video",
      category: "video",
      url: "https://www.youtube.com/@example",
      feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890123456789012",
      adapter: "youtube",
    };
    const result = await collectArchiveSource({
      source,
      cursor: {
        uploadsPlaylistId: "UU1234567890123456789012",
        pageToken: null,
        nextPageToken: null,
        pendingVideoIds: ["tail-1", "tail-2"],
        pendingVideos: [
          { videoId: "tail-1", title: "Tail 1", published: "2026-09-07T00:00:00.000Z" },
          { videoId: "tail-2", title: "Tail 2", published: "2026-09-07T00:00:01.000Z" },
        ],
        apiKeyRequired: true,
        done: false,
      },
      context: {
        maxItems: 48,
        timeoutMs: 1000,
        youtubeApiKey: "api-key",
        fetchImpl: async () => {
          throw new Error("마지막 pending 소진 뒤에는 재조회하지 않아야 한다.");
        },
      },
    });

    expect(result.items.map((item) => item.title)).toEqual(["Tail 1", "Tail 2"]);
    expect(result.cursor).toMatchObject({ pendingVideoIds: [], pendingVideos: [], done: true });
  });

  test("sitemap digest가 바뀌면 실패하고 cursor를 진행하지 않는다", async () => {
    const cursor = {
      sitemapUrl: "https://tech.kakao.com/sitemap.xml",
      sitemapDigest: "sha256:old",
      onlyPathPrefix: "/posts/",
      lastUrl: null,
      done: false,
    };

    const result = await collectArchiveSource({
      source: kakao,
      cursor,
      context: {
        maxItems: 10,
        timeoutMs: 1000,
        fetchImpl: async () => response("<urlset></urlset>"),
      },
    });

    expect(result.status).toBe("failed");
    expect(result.cursor).toBe(cursor);
  });

  test("malformed sitemap과 wrong root는 빈 완료가 아니라 실패로 처리한다", async () => {
    for (const body of ["<urlset><url>", "<html><body>not sitemap</body></html>"]) {
      const result = await collectArchiveSource({
        source: kakao,
        cursor: initialArchiveCursorForSource(kakao),
        context: {
          maxItems: 10,
          timeoutMs: 1000,
          fetchImpl: async () => response(body),
        },
      });

      expect(result.status).toBe("failed");
      expect(result.items).toEqual([]);
    }
  });

  test("정상 빈 sitemap root는 빈 items와 done true로 처리한다", async () => {
    for (const body of ["<urlset/>", "<urlset></urlset>"]) {
      const result = await collectArchiveSource({
        source: kakao,
        cursor: initialArchiveCursorForSource(kakao),
        context: {
          maxItems: 10,
          timeoutMs: 1000,
          fetchImpl: async () => response(body),
        },
      });

      expect(result.status).toBe("collected");
      expect(result.items).toEqual([]);
      expect(result.cursor).toMatchObject({ done: true });
    }

    for (const body of ["<sitemapindex/>", "<sitemapindex></sitemapindex>"]) {
      const result = await collectArchiveSource({
        source: kurly,
        cursor: initialArchiveCursorForSource(kurly),
        context: {
          maxItems: 10,
          timeoutMs: 1000,
          fetchImpl: async () => response(body),
        },
      });

      expect(result.status).toBe("collected");
      expect(result.items).toEqual([]);
      expect(result.cursor).toMatchObject({ done: true });
    }
  });

  test("큰 sitemap index cursor를 여러 번 축약한 뒤 재개해도 다음 sitemap부터 진행하고 마지막에 done이 된다", async () => {
    const requestedSitemaps: string[] = [];
    const sitemapCount = 1300;
    const fetchImpl = async (url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("sitemap-index.xml")) {
        return response(`<sitemapindex>${
          Array.from({ length: sitemapCount }, (_, index) => `<sitemap><loc>https://helloworld.kurly.com/sitemap-${index}.xml</loc></sitemap>`).join("")
        }</sitemapindex>`);
      }
      requestedSitemaps.push(href);
      const index = href.match(/sitemap-(\d+)\.xml/)?.[1] ?? "unknown";
      return response(`<urlset><url><loc>https://helloworld.kurly.com/post-${index}</loc></url></urlset>`);
    };

    let cursor = initialArchiveCursorForSource(kurly);
    const firstPosts: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const result = await collectArchiveSource({
        source: kurly,
        cursor,
        context: { maxItems: 1, timeoutMs: 1000, fetchImpl },
      });
      firstPosts.push(result.items[0].url);
      expect(Buffer.byteLength(JSON.stringify(result.cursor), "utf8")).toBeLessThanOrEqual(64 * 1024);
      cursor = result.cursor;
    }

    expect(firstPosts).toEqual([
      "https://helloworld.kurly.com/post-0",
      "https://helloworld.kurly.com/post-1",
      "https://helloworld.kurly.com/post-2",
    ]);
    expect(requestedSitemaps.slice(0, 3)).toEqual([
      "https://helloworld.kurly.com/sitemap-0.xml",
      "https://helloworld.kurly.com/sitemap-1.xml",
      "https://helloworld.kurly.com/sitemap-2.xml",
    ]);

    for (let index = 3; index < sitemapCount; index += 1) {
      const result = await collectArchiveSource({
        source: kurly,
        cursor,
        context: { maxItems: 1, timeoutMs: 1000, fetchImpl },
      });
      cursor = result.cursor;
      if (index === 1000) {
        expect(Buffer.byteLength(JSON.stringify(cursor), "utf8")).toBeLessThanOrEqual(64 * 1024);
      }
    }

    expect(cursor).toMatchObject({
      completedSitemapCount: sitemapCount,
      currentSitemap: null,
      done: true,
    });
    expect(requestedSitemaps.at(-1)).toBe("https://helloworld.kurly.com/sitemap-1299.xml");
    expect(new Set(requestedSitemaps).size).toBe(sitemapCount);
  }, 20_000);

  test("sitemap index의 현재 sitemap 본문 digest가 바뀌면 실패한다", async () => {
    const cursor = {
      sitemapIndexUrl: "https://helloworld.kurly.com/sitemap-index.xml",
      indexDigest: undefined,
      pendingSitemaps: [],
      completedSitemaps: [],
      currentSitemap: null,
      lastUrl: null,
      done: false,
    };
    const first = await collectArchiveSource({
      source: kurly,
      cursor,
      context: {
        maxItems: 1,
        timeoutMs: 1000,
        fetchImpl: async (url: string | URL | Request) => String(url).endsWith("sitemap-index.xml")
          ? response("<sitemapindex><sitemap><loc>https://helloworld.kurly.com/post.xml</loc></sitemap></sitemapindex>")
          : response("<urlset><url><loc>https://helloworld.kurly.com/a</loc></url><url><loc>https://helloworld.kurly.com/b</loc></url></urlset>"),
      },
    });
    expect(first.status).toBe("collected");

    const second = await collectArchiveSource({
      source: kurly,
      cursor: first.cursor,
      context: {
        maxItems: 1,
        timeoutMs: 1000,
        fetchImpl: async (url: string | URL | Request) => String(url).endsWith("sitemap-index.xml")
          ? response("<sitemapindex><sitemap><loc>https://helloworld.kurly.com/post.xml</loc></sitemap></sitemapindex>")
          : response("<urlset><url><loc>https://helloworld.kurly.com/changed</loc></url></urlset>"),
      },
    });

    expect(second.status).toBe("failed");
    expect(second.items).toEqual([]);
  });
});
