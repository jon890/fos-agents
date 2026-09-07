import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReadingSource } from "../reading_contracts.js";
import { main } from "../morning_reading_cli.js";
import { canonicalizeReadingUrl, readingContentKey } from "../url_identity.js";
import { collectAndIngestStudyLibrary, type StudyLibraryIngestionPayload } from "./ingestion.js";
import type { StudyLibraryClient } from "./client.js";

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": init.headers ? "application/json" : "application/xml" },
  });
}

class MockClient {
  cursor: { sourceKey: string; mode: "recent" | "archive"; cursor: Record<string, unknown> | null; version: number } = {
    sourceKey: "source",
    mode: "recent",
    cursor: null,
    version: 0,
  };
  payloads: StudyLibraryIngestionPayload[] = [];
  failIngestion = false;

  async getSourceCursor(sourceKey: string, mode: "recent" | "archive") {
    return { ...this.cursor, sourceKey, mode };
  }

  async createIngestion(body: unknown) {
    if (this.failIngestion) throw new Error("API down");
    this.payloads.push(body as StudyLibraryIngestionPayload);
    return {
      idempotencyKey: (body as StudyLibraryIngestionPayload).idempotencyKey,
      acceptedCount: (body as StudyLibraryIngestionPayload).items.length,
      cursorVersion: this.cursor.version + this.payloads.length,
    };
  }
}

const feedSource: ReadingSource = {
  key: "feed-source",
  title: "Feed Source",
  category: "techBlog",
  feedUrl: "https://example.com/feed.xml",
  adapter: "feed",
};

const pageSource: ReadingSource = {
  key: "page-source",
  title: "Page Source",
  category: "geek",
  url: "https://example.com/",
  adapter: "page",
};

const youtubeSource: ReadingSource = {
  key: "video-youtube",
  title: "Video",
  category: "video",
  url: "https://www.youtube.com/@example",
  feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890123456789012",
  adapter: "youtube",
};

function rss(items: Array<{ title: string; url: string }>): string {
  return `<?xml version="1.0"?><rss><channel>${
    items.map((item) => `<item><title>${item.title}</title><link>${item.url}</link><pubDate>Mon, 07 Sep 2026 00:00:00 GMT</pubDate><description>${item.title} excerpt</description></item>`).join("")
  }</channel></rss>`;
}

afterEach(() => {
  delete process.env.STUDY_LIBRARY_URL;
  delete process.env.STUDY_SERVICE_TOKEN;
  delete process.env.CAREER_OS_ROOT;
  delete process.env.YOUTUBE_DATA_API_KEY;
});

describe("study-library ingestion", () => {
  test("recent cursor의 lastSeen 자료는 제외하고 새 자료와 다음 cursor를 함께 저장한다", async () => {
    const mock = new MockClient();
    mock.cursor.cursor = { lastSeen: [readingContentKey(canonicalizeReadingUrl("https://example.com/old"))] };
    const fetchImpl = async () => response(rss([
      { title: "Old", url: "https://example.com/old" },
      { title: "New", url: "https://example.com/new" },
    ]));

    const result = await collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [feedSource],
      mode: "recent",
      maxItems: 10,
      timeoutMs: 1000,
      fetchImpl,
      now: () => new Date("2026-09-07T00:00:00.000Z"),
    });

    expect(result.acceptedCount).toBe(1);
    expect(mock.payloads).toHaveLength(1);
    expect(mock.payloads[0].items.map((item) => item.title)).toEqual(["New"]);
    expect(mock.payloads[0].cursor).toMatchObject({ fetchedAt: "2026-09-07T00:00:00.000Z" });
    expect((mock.payloads[0].cursor?.lastSeen as string[])).toHaveLength(2);
  });

  test("recent 한도로 남은 자료는 lastSeen에 넣지 않아 다음 실행에서 수집할 수 있다", async () => {
    const mock = new MockClient();

    await collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [feedSource],
      mode: "recent",
      maxItems: 1,
      timeoutMs: 1000,
      fetchImpl: async () => response(rss([
        { title: "One", url: "https://example.com/one" },
        { title: "Two", url: "https://example.com/two" },
      ])),
      now: () => new Date("2026-09-07T00:00:00.000Z"),
    });

    expect(mock.payloads[0].items.map((item) => item.title)).toEqual(["One"]);
    expect(mock.payloads[0].cursor?.lastSeen).toHaveLength(1);
  });

  test("정상 빈 feed와 빈 page는 빈 ingestion을 보내고 실패한 수집은 보내지 않는다", async () => {
    const emptyFeed = new MockClient();
    await collectAndIngestStudyLibrary({
      client: emptyFeed as unknown as StudyLibraryClient,
      sources: [feedSource],
      mode: "recent",
      maxItems: 10,
      timeoutMs: 1000,
      fetchImpl: async () => response("<?xml version=\"1.0\"?><rss><channel></channel></rss>"),
      now: () => new Date("2026-09-07T00:00:00.000Z"),
    });
    expect(emptyFeed.payloads).toHaveLength(1);
    expect(emptyFeed.payloads[0].items).toEqual([]);

    const emptyPage = new MockClient();
    await collectAndIngestStudyLibrary({
      client: emptyPage as unknown as StudyLibraryClient,
      sources: [pageSource],
      mode: "recent",
      maxItems: 10,
      timeoutMs: 1000,
      fetchImpl: async () => response("<html><body>no links</body></html>"),
      now: () => new Date("2026-09-07T00:00:00.000Z"),
    });
    expect(emptyPage.payloads[0].items).toEqual([]);

    for (const fetchImpl of [
      async () => response("down", { status: 500 }),
      async () => response("<rss><channel>", { status: 200 }),
    ]) {
      const failed = new MockClient();
      const result = await collectAndIngestStudyLibrary({
        client: failed as unknown as StudyLibraryClient,
        sources: [feedSource],
        mode: "recent",
        maxItems: 10,
        timeoutMs: 1000,
        fetchImpl,
        now: () => new Date("2026-09-07T00:00:00.000Z"),
      });
      expect(result.statuses[0].status).toBe("failed");
      expect(failed.payloads).toHaveLength(0);
    }
  });

  test("YouTube recent는 API 키 없이 RSS를 수집하고 rssOnly와 lastSeen을 보존한다", async () => {
    const mock = new MockClient();
    await collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [youtubeSource],
      mode: "recent",
      maxItems: 10,
      timeoutMs: 1000,
      fetchImpl: async () => response(`<?xml version="1.0"?>
        <feed xmlns:media="http://search.yahoo.com/mrss/">
          <entry>
            <title>Video One</title>
            <link rel="alternate" href="https://www.youtube.com/watch?v=abc123" />
            <published>2026-09-07T00:00:00+00:00</published>
          </entry>
        </feed>`),
      now: () => new Date("2026-09-07T00:00:00.000Z"),
    });

    expect(mock.payloads[0].items[0].kind).toBe("feed-video");
    expect(mock.payloads[0].cursor).toMatchObject({ rssOnly: true });
    expect(mock.payloads[0].cursor?.lastSeen).toEqual(["youtube:abc123"]);
  });

  test("YouTube API 키가 없으면 archive ingestion 요청을 보내지 않고 상태를 출력한다", async () => {
    const mock = new MockClient();
    const result = await collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [youtubeSource],
      mode: "archive",
      maxItems: 48,
      timeoutMs: 1000,
    });

    expect(result.statuses[0]).toMatchObject({
      status: "unavailable",
      reason: "YOUTUBE_DATA_API_KEY 없음",
    });
    expect(mock.payloads).toHaveLength(0);
  });

  test("sitemap digest가 바뀌면 ingestion 요청을 보내지 않는다", async () => {
    const mock = new MockClient();
    mock.cursor = {
      sourceKey: "kakao-tech",
      mode: "archive",
      version: 3,
      cursor: {
        sitemapUrl: "https://tech.kakao.com/sitemap.xml",
        sitemapDigest: "sha256:old",
        onlyPathPrefix: "/posts/",
        lastUrl: null,
        done: false,
      },
    };
    const result = await collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [{ ...feedSource, key: "kakao-tech" }],
      mode: "archive",
      maxItems: 10,
      timeoutMs: 1000,
      fetchImpl: async () => response("<urlset></urlset>"),
    });

    expect(result.statuses[0].status).toBe("failed");
    expect(mock.payloads).toHaveLength(0);
  });

  test("--reset-cursor는 기존 cursor version을 expectedCursorVersion으로 보내고 standalone reset API를 호출하지 않는다", async () => {
    const mock = new MockClient();
    mock.cursor = {
      sourceKey: "kakao-tech",
      mode: "archive",
      version: 9,
      cursor: { done: true },
    };
    await collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [{ ...feedSource, key: "kakao-tech" }],
      mode: "archive",
      sourceKey: "kakao-tech",
      resetCursor: true,
      maxItems: 10,
      timeoutMs: 1000,
      fetchImpl: async () => response(`<urlset>
        <url><loc>https://tech.kakao.com/posts/reset</loc></url>
      </urlset>`),
    });

    expect(mock.payloads).toHaveLength(1);
    expect(mock.payloads[0].expectedCursorVersion).toBe(9);
    expect(mock.payloads[0].items[0].canonicalUrl).toBe("https://tech.kakao.com/posts/reset");
  });

  test("cursor JSON이 64 KiB를 넘지 않는다", async () => {
    const mock = new MockClient();
    await collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [{ ...feedSource, key: "kurly-tech" }],
      mode: "archive",
      maxItems: 1,
      timeoutMs: 1000,
      fetchImpl: async (url: string | URL | Request) => {
        const href = String(url);
        if (href.endsWith("sitemap-index.xml")) {
          return response(`<sitemapindex>${
            Array.from({ length: 5000 }, (_, index) => `<sitemap><loc>https://helloworld.kurly.com/sitemap-${index}.xml</loc></sitemap>`).join("")
          }</sitemapindex>`);
        }
        return response("<urlset><url><loc>https://helloworld.kurly.com/post</loc></url></urlset>");
      },
    });

    expect(Buffer.byteLength(JSON.stringify(mock.payloads[0].cursor), "utf8")).toBeLessThanOrEqual(64 * 1024);
  });

  test("자료 저장 API가 실패하면 다음 cursor가 진행된 것으로 기록되지 않는다", async () => {
    const mock = new MockClient();
    mock.failIngestion = true;

    await expect(collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [feedSource],
      mode: "recent",
      maxItems: 10,
      timeoutMs: 1000,
      fetchImpl: async () => response(rss([{ title: "One", url: "https://example.com/one" }])),
    })).rejects.toThrow("API down");
    expect(mock.payloads).toHaveLength(0);
  });

  test("max-items가 100을 넘으면 각 ingestion cursor가 실제 저장분만 반영한다", async () => {
    const mock = new MockClient();
    const items = Array.from({ length: 150 }, (_, index) => ({
      title: `Post ${index}`,
      url: `https://example.com/post-${index}`,
    }));

    await collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [feedSource],
      mode: "recent",
      maxItems: 150,
      timeoutMs: 1000,
      fetchImpl: async () => response(rss(items)),
      now: () => new Date("2026-09-07T00:00:00.000Z"),
    });

    expect(mock.payloads).toHaveLength(2);
    expect(mock.payloads[0].items).toHaveLength(100);
    expect(mock.payloads[0].cursor?.lastSeen).toHaveLength(100);
    expect(mock.payloads[1].items).toHaveLength(50);
    expect(mock.payloads[1].cursor?.lastSeen).toHaveLength(150);
  });
});

describe("library collect-only CLI", () => {
  test("--reset-cursor는 archive 단일 source에서만 허용된다", async () => {
    const originalArgv = process.argv;
    process.argv = ["bun", "morning_reading_cli.ts", "--library", "--collect-only", "--reset-cursor"];
    process.env.STUDY_LIBRARY_URL = "https://study.example.com";
    process.env.STUDY_SERVICE_TOKEN = "test-token-123456789012345678901234567890";
    const directory = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
    process.env.CAREER_OS_ROOT = directory;
    try {
      await expect(main()).rejects.toThrow("--reset-cursor");
    } finally {
      process.argv = originalArgv;
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("--library --collect-only --mode recent --run-dir는 파일모드 history를 읽지 않는다", async () => {
    const originalArgv = process.argv;
    const originalFetch = globalThis.fetch;
    const directory = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
    const requests: string[] = [];
    process.argv = [
      "bun",
      "morning_reading_cli.ts",
      "--run-dir",
      directory,
      "--library",
      "--collect-only",
      "--mode",
      "recent",
      "--source-key",
      "kurly-tech",
      "--max-items",
      "0",
    ];
    process.env.STUDY_LIBRARY_URL = "https://study.example.com";
    process.env.STUDY_SERVICE_TOKEN = "test-token-123456789012345678901234567890";
    globalThis.fetch = (async (url: URL, init: RequestInit) => {
      requests.push(`${init.method} ${url.pathname}${url.search}`);
      if (init.method === "GET" && url.pathname.endsWith("/sources")) return response({ sources: [] }, { headers: { "Content-Type": "application/json" } });
      if (init.method === "PUT") {
        return response({
          source: {
            sourceKey: decodeURIComponent(url.pathname.split("/").at(-1) ?? ""),
            title: "Source",
            category: "techBlog",
            url: "https://example.com",
            feedUrl: null,
            adapter: "page",
            enabled: true,
            version: 1,
          },
          version: 1,
        }, { headers: { "Content-Type": "application/json" } });
      }
      if (init.method === "GET" && url.pathname.includes("/cursor")) {
        return response({ sourceKey: "kurly-tech", mode: "recent", cursor: null, version: 0 }, { headers: { "Content-Type": "application/json" } });
      }
      return response({ idempotencyKey: "ok", acceptedCount: 0, cursorVersion: 1 }, { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    try {
      await main();
    } finally {
      process.argv = originalArgv;
      globalThis.fetch = originalFetch;
      rmSync(directory, { recursive: true, force: true });
    }

    expect(requests.some((request) => request.includes("/cursor?mode=recent"))).toBe(true);
  });
});
