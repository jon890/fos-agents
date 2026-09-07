import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateReadingCandidatePool } from "../reading_candidate_pool.js";
import { StudyLibraryApiError, type StudyLibraryClient } from "./client.js";
import {
  buildReportCountsFromLibrary,
  prepareStudyLibraryCandidates,
  studyLibraryMetaPath,
  type StudyLibraryCandidateMeta,
} from "./candidates.js";
import type { StudyLibraryCandidatePage, StudyLibrarySourcesResponse } from "./contracts.js";

const temporaryDirectories: string[] = [];

const sources: StudyLibrarySourcesResponse = {
  sources: [
    {
      sourceKey: "blog-a",
      title: "Blog A",
      category: "techBlog",
      url: "https://example.com",
      feedUrl: null,
      adapter: "page",
      enabled: true,
      version: 1,
    },
    {
      sourceKey: "video-a",
      title: "Video A",
      category: "video",
      url: "https://www.youtube.com/@example",
      feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890123456789012",
      adapter: "youtube",
      enabled: true,
      version: 2,
    },
    {
      sourceKey: "off",
      title: "Off",
      category: "ai",
      url: "https://off.example.com",
      feedUrl: null,
      adapter: "page",
      enabled: false,
      version: 3,
    },
  ],
};

function candidate(contentKey: string, sourceKey = "blog-a") {
  return {
    id: contentKey,
    contentKey,
    canonicalUrl: `https://example.com/${contentKey}`,
    sourceKey,
    sourceName: sourceKey === "blog-a" ? "Blog A" : "Video A",
    category: sourceKey === "blog-a" ? "techBlog" as const : "video" as const,
    title: `Title ${contentKey}`,
    url: `https://example.com/${contentKey}`,
    published: "2026-09-07",
    kind: sourceKey === "blog-a" ? "page-link" as const : "feed-video" as const,
    previouslyRecommended: false,
  };
}

function page(input: Partial<StudyLibraryCandidatePage>): StudyLibraryCandidatePage {
  return {
    candidates: [],
    recentStudyTopicKeys: [],
    nextCursor: null,
    historyVersion: 7,
    ...input,
  };
}

class MockClient {
  readonly params: Array<Record<string, unknown>> = [];
  pages: StudyLibraryCandidatePage[] = [];
  failOnCall?: number;

  async getSources() {
    return sources;
  }

  async getCandidates(searchParams: Record<string, unknown>) {
    this.params.push(searchParams);
    if (this.failOnCall === this.params.length) {
      throw new StudyLibraryApiError({ status: 409, code: "VERSION_CONFLICT" });
    }
    const next = this.pages.shift();
    if (!next) throw new Error("unexpected candidate page request");
    return next;
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("study-library candidates", () => {
  test("pagination 후보를 기존 후보풀 schema로 저장하고 historyVersion을 meta에 남긴다", async () => {
    const runDir = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
    temporaryDirectories.push(runDir);
    const outputPath = join(runDir, "state", "reading-candidates.json");
    const mock = new MockClient();
    mock.pages = [
      page({
        candidates: [candidate("content-a")],
        recentStudyTopicKeys: ["operable-ai-products"],
        nextCursor: "cursor-2",
        historyVersion: 12,
      }),
      page({
        candidates: [candidate("content-b", "video-a")],
        recentStudyTopicKeys: ["ignored-after-first"],
        nextCursor: null,
        historyVersion: 12,
      }),
    ];

    const result = await prepareStudyLibraryCandidates({
      client: mock as unknown as StudyLibraryClient,
      outputPath,
      filters: { limit: 50 },
      generatedAt: "2026-09-07T00:00:00.000Z",
    });

    const pool = JSON.parse(readFileSync(outputPath, "utf8")) as unknown;
    const meta = JSON.parse(readFileSync(result.metaPath, "utf8")) as StudyLibraryCandidateMeta;
    expect(validateReadingCandidatePool(pool)).toEqual([]);
    expect(result.candidateCount).toBe(2);
    expect(meta.historyVersion).toBe(12);
    expect(meta.enabledSources.map((source) => source.sourceKey)).toEqual(["blog-a", "video-a"]);
    expect((pool as { collectionLog: unknown[] }).collectionLog).toEqual([]);
  });

  test("후보 조회 필터와 limit, cursor를 query에 반영한다", async () => {
    const runDir = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
    temporaryDirectories.push(runDir);
    const mock = new MockClient();
    mock.pages = [page({ candidates: [candidate("content-a")] })];

    await prepareStudyLibraryCandidates({
      client: mock as unknown as StudyLibraryClient,
      outputPath: join(runDir, "state", "reading-candidates.json"),
      filters: {
        sourceKey: "blog-a",
        category: "techBlog",
        publishedFrom: "2026-09-01T00:00:00.000Z",
        publishedTo: "2026-09-08T00:00:00.000Z",
        limit: 25,
        cursor: "from-here",
      },
    });

    expect(mock.params[0]).toEqual({
      sourceKey: "blog-a",
      category: "techBlog",
      publishedFrom: "2026-09-01T00:00:00.000Z",
      publishedTo: "2026-09-08T00:00:00.000Z",
      limit: 25,
      cursor: "from-here",
    });
  });

  test("페이지 중간 VERSION_CONFLICT는 후보풀 파일을 만들지 않고 자동 재시작하지 않는다", async () => {
    const runDir = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
    temporaryDirectories.push(runDir);
    const outputPath = join(runDir, "state", "reading-candidates.json");
    const mock = new MockClient();
    mock.pages = [page({ candidates: [candidate("content-a")], nextCursor: "cursor-2" })];
    mock.failOnCall = 2;

    await expect(prepareStudyLibraryCandidates({
      client: mock as unknown as StudyLibraryClient,
      outputPath,
    })).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });

    expect(mock.params).toHaveLength(2);
    expect(existsSync(outputPath)).toBe(false);
    expect(existsSync(studyLibraryMetaPath(outputPath))).toBe(false);
  });

  test("report counts는 meta의 enabled 소스와 후보풀에서 계산한다", async () => {
    const candidatePool = {
      generatedAt: "2026-09-07T00:00:00.000Z",
      recentStudyTopicKeys: [],
      policy: {
        selection: "llm" as const,
        fixedKeywordsUsed: false as const,
        sourcePriorityUsed: false as const,
        maxCandidatesPerSource: 100,
      },
      candidates: [candidate("content-a"), candidate("content-b", "video-a")],
      collectionLog: [],
    };
    const counts = buildReportCountsFromLibrary({
      candidatePool,
      meta: {
        historyVersion: 1,
        filters: { limit: 100 },
        nextCursor: null,
        enabledSources: [
          { sourceKey: "blog-a", title: "Blog A", category: "techBlog" },
          { sourceKey: "blog-b", title: "Blog B", category: "techBlog" },
          { sourceKey: "video-a", title: "Video A", category: "video" },
        ],
      },
    });

    expect(counts).toEqual({
      activeSources: 3,
      sourcesWithCandidates: 2,
      collectedArticles: 2,
      techBlogSources: 2,
      geekSources: 0,
      aiSources: 0,
      videoSources: 1,
    });
  });
});
