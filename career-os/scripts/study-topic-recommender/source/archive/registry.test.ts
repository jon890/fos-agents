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
      pageToken: null,
      done: false,
    });
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
