import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReadingSource } from "../reading_contracts.js";
import { main, reportMorningReadingError } from "../morning_reading_cli.js";
import { canonicalizeReadingUrl, readingContentKey } from "../url_identity.js";
import { collectAndIngestStudyLibrary, type StudyLibraryIngestionPayload } from "./ingestion.js";
import { CareerStoreError } from "../../lib/career-store/errors.ts";
import { restoreCareerWorkspaceEnv, useCareerWorkspaceEnv } from "../../lib/career-store/test-support.ts";
import { StudyLibraryClient } from "./client.js";

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
  delete process.env.CAREER_BACKEND_URL;
  delete process.env.CAREER_BACKEND_TOKEN;
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

  test("recent 응답에서 query만 다른 같은 글은 한 번만 저장한다", async () => {
    const mock = new MockClient();

    await collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [feedSource],
      mode: "recent",
      maxItems: 2,
      timeoutMs: 1000,
      fetchImpl: async () => response(rss([
        { title: "First", url: "https://example.com/post?utm_source=feed" },
        { title: "Duplicate", url: "https://example.com/post?utm_source=mail" },
        { title: "Second", url: "https://example.com/second" },
      ])),
    });

    expect(mock.payloads[0].items.map((item) => item.title)).toEqual(["First", "Second"]);
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
      async () => response("<note><title>not feed</title></note>", { status: 200 }),
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

  test("정상 RSS, Atom, HTML 구조는 성공하고 plain text page는 실패한다", async () => {
    for (const xml of [
      rss([{ title: "RSS", url: "https://example.com/rss" }]),
      `<?xml version="1.0"?><feed><entry><title>Atom</title><link rel="alternate" href="https://example.com/atom" /></entry></feed>`,
    ]) {
      const mock = new MockClient();
      await collectAndIngestStudyLibrary({
        client: mock as unknown as StudyLibraryClient,
        sources: [feedSource],
        mode: "recent",
        maxItems: 10,
        timeoutMs: 1000,
        fetchImpl: async () => response(xml),
      });
      expect(mock.payloads).toHaveLength(1);
    }

    const html = new MockClient();
    await collectAndIngestStudyLibrary({
      client: html as unknown as StudyLibraryClient,
      sources: [pageSource],
      mode: "recent",
      maxItems: 10,
      timeoutMs: 1000,
      fetchImpl: async () => response("<!doctype html><html><body><a href='/post'>Post title</a></body></html>"),
    });
    expect(html.payloads).toHaveLength(1);

    const plainText = new MockClient();
    const result = await collectAndIngestStudyLibrary({
      client: plainText as unknown as StudyLibraryClient,
      sources: [pageSource],
      mode: "recent",
      maxItems: 10,
      timeoutMs: 1000,
      fetchImpl: async () => response("not html"),
    });
    expect(result.statuses[0].status).toBe("failed");
    expect(plainText.payloads).toHaveLength(0);
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

  test("정상 빈 archive sitemap은 빈 배치와 다음 cursor를 ingestion으로 저장한다", async () => {
    const mock = new MockClient();
    await collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [{ ...feedSource, key: "kakao-tech" }],
      mode: "archive",
      maxItems: 10,
      timeoutMs: 1000,
      fetchImpl: async () => response("<urlset/>"),
    });

    expect(mock.payloads).toHaveLength(1);
    expect(mock.payloads[0].items).toEqual([]);
    expect(mock.payloads[0].cursor).toMatchObject({ done: true });
  });

  test("archive 응답의 같은 글은 한 번만 저장하고 끝나지 않은 cursor는 계속 수집한다", async () => {
    const mock = new MockClient();

    await collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [{ ...feedSource, key: "kakao-tech" }],
      mode: "archive",
      maxItems: 4,
      timeoutMs: 1000,
      fetchImpl: async () => response(`<urlset>
        <url><loc>https://tech.kakao.com/posts/one?utm_source=feed</loc></url>
        <url><loc>https://tech.kakao.com/posts/one?utm_source=mail</loc></url>
        <url><loc>https://tech.kakao.com/posts/two</loc></url>
        <url><loc>https://tech.kakao.com/posts/three</loc></url>
        <url><loc>https://tech.kakao.com/posts/four</loc></url>
      </urlset>`),
    });

    expect(mock.payloads).toHaveLength(2);
    expect(mock.payloads.flatMap((payload) => payload.items.map((item) => item.canonicalUrl))).toEqual([
      "https://tech.kakao.com/posts/one",
      "https://tech.kakao.com/posts/two",
      "https://tech.kakao.com/posts/three",
      "https://tech.kakao.com/posts/four",
    ]);
  });

  test("일반 수집 오류는 실패 상태로 남기고 다음 소스를 수집한다", async () => {
    const mock = new MockClient();
    mock.getSourceCursor = async (sourceKey, mode) => {
      if (sourceKey === feedSource.key) throw new Error(`${"a".repeat(250)}\nsecond line`);
      return { ...mock.cursor, sourceKey, mode };
    };

    const result = await collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [feedSource, pageSource],
      mode: "recent",
      maxItems: 10,
      timeoutMs: 1000,
      fetchImpl: async () => response("<html><body><a href='/post'>Post</a></body></html>"),
    });

    expect(result.statuses).toEqual([
      expect.objectContaining({
        sourceKey: feedSource.key,
        status: "failed",
        acceptedCount: 0,
        cursorUpdated: false,
        reason: "a".repeat(200),
      }),
      expect.objectContaining({ sourceKey: pageSource.key, status: "ingested" }),
    ]);
  });

  test("저장소 오류는 종류와 관계없이 출처 반복을 멈추고 그대로 전파한다", async () => {
    const errors = [
      new CareerStoreError(503, "CAREER_STORE_BUSY", "다른 실행이 쓰고 있습니다."),
      new CareerStoreError(500, "CAREER_STORE_CORRUPT", "파일을 읽을 수 없습니다."),
      new CareerStoreError(409, "VERSION_CONFLICT", "cursor 버전이 현재 값과 다릅니다."),
    ];

    for (const error of errors) {
      const mock = new MockClient();
      const requestedSources: string[] = [];
      mock.getSourceCursor = async (sourceKey) => {
        requestedSources.push(sourceKey);
        throw error;
      };

      await expect(collectAndIngestStudyLibrary({
        client: mock as unknown as StudyLibraryClient,
        sources: [feedSource, pageSource],
        mode: "recent",
        maxItems: 10,
        timeoutMs: 1000,
      })).rejects.toBe(error);
      expect(requestedSources).toEqual([feedSource.key]);
    }
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

  test("일반 자료 저장 오류는 실패 상태로 남기고 cursor가 진행된 것으로 기록하지 않는다", async () => {
    const mock = new MockClient();
    mock.failIngestion = true;

    const result = await collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [feedSource],
      mode: "recent",
      maxItems: 10,
      timeoutMs: 1000,
      fetchImpl: async () => response(rss([{ title: "One", url: "https://example.com/one" }])),
    });

    expect(result.statuses[0]).toMatchObject({
      status: "failed",
      acceptedCount: 0,
      cursorUpdated: false,
      reason: "API down",
    });
    expect(mock.payloads).toHaveLength(0);
  });

  test("sourceKey 오타와 maxItems 0은 수집 전에 실패한다", async () => {
    const mock = new MockClient();
    await expect(collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [feedSource],
      mode: "recent",
      sourceKey: "missing-source",
      maxItems: 10,
      timeoutMs: 1000,
    })).rejects.toThrow("sourceKey");

    await expect(collectAndIngestStudyLibrary({
      client: mock as unknown as StudyLibraryClient,
      sources: [feedSource],
      mode: "recent",
      maxItems: 0,
      timeoutMs: 1000,
    })).rejects.toThrow("maxItems");
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
  const originalArgv = process.argv;
  const originalFetch = globalThis.fetch;
  const originalRunRoot = process.env.CAREER_OS_ROOT;
  const directories: string[] = [];

  afterEach(() => {
    process.argv = originalArgv;
    globalThis.fetch = originalFetch;
    if (originalRunRoot === undefined) delete process.env.CAREER_OS_ROOT;
    else process.env.CAREER_OS_ROOT = originalRunRoot;
    restoreCareerWorkspaceEnv();
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  /** 임시 작업 폴더에 소스 하나를 넣고, 실행 폴더를 만들어 건다. */
  async function workspaceWithSource(): Promise<StudyLibraryClient> {
    useCareerWorkspaceEnv();
    const directory = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
    directories.push(directory);
    process.env.CAREER_OS_ROOT = directory;
    const client = new StudyLibraryClient();
    await client.putSource("kurly-tech", {
      title: "Kurly",
      category: "techBlog",
      url: "https://helloworld.kurly.com",
      feedUrl: "https://helloworld.kurly.com/rss.xml",
      adapter: "feed",
      enabled: true,
      note: null,
      expectedVersion: 0,
    });
    return client;
  }

  function feed(items: Array<{ title: string; url: string }>): typeof fetch {
    return (async () => response(rss(items))) as unknown as typeof fetch;
  }

  test("--reset-cursor는 archive 단일 source에서만 허용된다", async () => {
    await workspaceWithSource();
    globalThis.fetch = feed([]);
    process.argv = ["bun", "morning_reading_cli.ts", "--collect-only", "--reset-cursor"];
    await expect(main()).rejects.toThrow("--reset-cursor");
  });

  test("CLI는 source-key 오타와 max-items 0을 usage error로 처리한다", async () => {
    await workspaceWithSource();
    globalThis.fetch = feed([]);
    process.argv = ["bun", "morning_reading_cli.ts", "--collect-only", "--source-key", "missing-source"];
    await expect(main()).rejects.toThrow("sourceKey");

    process.argv = ["bun", "morning_reading_cli.ts", "--collect-only", "--source-key", "kurly-tech", "--max-items", "0"];
    await expect(main()).rejects.toThrow("--max-items");
  });

  test("두 번째 수집은 저장된 커서 버전에서 이어 가고 같은 자료를 다시 쌓지 않는다", async () => {
    const client = await workspaceWithSource();
    const args = ["bun", "morning_reading_cli.ts", "--collect-only", "--mode", "recent", "--source-key", "kurly-tech"];

    globalThis.fetch = feed([{ title: "One", url: "https://helloworld.kurly.com/one" }]);
    process.argv = args;
    await main();
    const first = await client.getSourceCursor("kurly-tech", "recent");
    expect(first.version).toBe(1);

    globalThis.fetch = feed([
      { title: "Two", url: "https://helloworld.kurly.com/two" },
      { title: "One", url: "https://helloworld.kurly.com/one" },
    ]);
    process.argv = args;
    await main();
    const second = await client.getSourceCursor("kurly-tech", "recent");
    expect(second.version).toBe(2);
    expect((second.cursor?.lastSeen as string[]).length).toBe(2);
  });

  test("저장소 오류는 code 를 첫 줄에 내고 종료 코드 1로 끝낸다", () => {
    const originalError = console.error;
    const originalExit = process.exit;
    const messages: string[] = [];
    console.error = (message?: unknown) => {
      messages.push(String(message));
    };
    process.exit = ((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    }) as typeof process.exit;
    const error = new CareerStoreError(503, "CAREER_STORE_BUSY", "다른 실행이 쓰고 있습니다.");

    try {
      expect(() => reportMorningReadingError(error)).toThrow("exit:1");
    } finally {
      console.error = originalError;
      process.exit = originalExit;
    }

    expect(messages).toEqual(["CAREER_STORE_BUSY: 다른 실행이 쓰고 있습니다."]);
  });
});
