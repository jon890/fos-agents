import { afterEach, describe, expect, test } from "bun:test";
import { contextVersion } from "../context.ts";
import {
  cleanupCareerWorkspaces,
  createCareerWorkspace,
  writeContextDocument,
} from "../test-support.ts";
import { StudyStore } from "./store.ts";

afterEach(cleanupCareerWorkspaces);

const INTERESTS = "- 분산 시스템\n- LLM 서비스 운영";
const VERSION = contextVersion("learning-interests", INTERESTS);

function setup(documents: { "learning-interests"?: string } = { "learning-interests": INTERESTS }) {
  const workspace = createCareerWorkspace(documents);
  return { ...workspace, store: new StudyStore(workspace.db) };
}

const sourceBody = (expectedVersion: number, overrides: Record<string, unknown> = {}) => ({
  title: "예시 기술 블로그",
  category: "techBlog",
  url: "https://example.com/blog",
  feedUrl: "https://example.com/feed.xml",
  adapter: "feed",
  enabled: true,
  note: "테스트 소스",
  expectedVersion,
  ...overrides,
});

const item = (key: string, publishedAt: string | null = "2026-11-20T00:00:00.000Z") => ({
  contentKey: key,
  canonicalUrl: `https://example.com/posts/${key}`,
  url: `https://example.com/posts/${key}`,
  title: `글 ${key}`,
  published: publishedAt ?? "",
  publishedAt,
  excerpt: null,
  kind: "feed-article",
  tags: [],
  collectedAt: "2026-11-21T00:00:00.000Z",
});

const ingestion = (keys: string[], expectedCursorVersion: number, cursor: Record<string, unknown>) => ({
  sourceKey: "example-blog",
  mode: "recent",
  items: keys.map((key) => item(key)),
  cursor,
  expectedCursorVersion,
  idempotencyKey: `ingest:${keys.join(",")}:${expectedCursorVersion}`,
});

const run = (reportId: string, topicKey: string, contentKeys: string[], rejections: string[] = []) => ({
  reportId,
  generatedAt: `${reportId.slice("morning-".length)}T00:00:00.000Z`,
  candidateContextVersion: VERSION,
  topics: [
    {
      topicKey,
      title: `주제 ${topicKey}`,
      careerQuestion: "이 주제가 다음 역할에 왜 필요한가",
      items: contentKeys.map((contentKey) => ({
        contentKey,
        summary: "요약",
        reason: "이유",
        careerValue: "target-role",
      })),
    },
  ],
  rejections: rejections.map((contentKey) => ({ contentKey, reason: "관심사와 거리가 멀다" })),
});

async function seeded() {
  const context = setup();
  await context.store.upsertSource("example-blog", sourceBody(0), "source-1");
  const body = ingestion(["a", "b", "c"], 0, { lastSeen: "c" });
  await context.store.createIngestion(body, body.idempotencyKey);
  return context;
}

describe("공부 추천 저장 모듈", () => {
  test("소스는 expectedVersion 이 맞을 때만 저장되고 버전이 1 오른다", async () => {
    const { store } = setup();
    expect((await store.upsertSource("example-blog", sourceBody(0), "s-1")).version).toBe(1);
    await expect(store.upsertSource("example-blog", sourceBody(0, { title: "다른 제목" }), "s-2")).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
    await expect(store.upsertSource("new-blog", sourceBody(3), "s-3")).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    const updated = await store.upsertSource("example-blog", sourceBody(1, { enabled: false }), "s-4");
    expect(updated).toMatchObject({ version: 2, source: { enabled: false, sourceKey: "example-blog" } });
    expect((await store.listSources()).sources).toEqual([updated.source]);
  });

  test("수집은 커서 버전이 맞을 때만 저장되고 다음 실행이 저장한 커서부터 읽는다", async () => {
    const { store } = await seeded();
    expect(await store.getCursor("example-blog", "recent")).toEqual({
      sourceKey: "example-blog",
      mode: "recent",
      cursor: { lastSeen: "c" },
      version: 1,
    });
    const stale = ingestion(["d"], 0, { lastSeen: "d" });
    await expect(store.createIngestion(stale, stale.idempotencyKey)).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    const next = ingestion(["d"], 1, { lastSeen: "d" });
    expect(await store.createIngestion(next, next.idempotencyKey)).toMatchObject({ acceptedCount: 1, cursorVersion: 2 });
    // 같은 수집을 다시 보내면 처음 응답을 돌려주고 커서가 더 오르지 않는다.
    expect(await store.createIngestion(next, next.idempotencyKey)).toMatchObject({ cursorVersion: 2 });
    expect((await store.getCursor("example-blog", "archive")).version).toBe(0);
    await expect(store.getCursor("missing", "recent")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("learning-interests 문서가 없으면 후보를 주지 않는다", async () => {
    const { store } = setup({});
    await expect(store.getCandidates({})).rejects.toMatchObject({ code: "CANDIDATE_CONTEXT_MISSING", status: 409 });
  });

  test("추천한 자료와 제외 판정이 붙은 자료는 다음 후보에서 빠진다", async () => {
    const { store, root } = await seeded();
    const before = await store.getCandidates({});
    expect(before.candidates.map((candidate) => candidate.contentKey)).toEqual(["a", "b", "c"]);
    expect(before).toMatchObject({
      historyVersion: 0,
      candidateContextVersion: VERSION,
      learningInterests: { version: VERSION, body: INTERESTS },
      recentStudyTopicKeys: [],
    });

    const saved = await store.createRecommendationRun(run("morning-2026-11-21", "topic-1", ["a"], ["b"]), "run-1");
    expect(saved).toEqual({ reportId: "morning-2026-11-21", historyVersion: 1 });

    const after = await store.getCandidates({});
    expect(after.candidates.map((candidate) => candidate.contentKey)).toEqual(["c"]);
    expect(after.recentStudyTopicKeys).toEqual(["topic-1"]);

    // 관심사 본문이 바뀌면 옛 기준의 제외 판정은 적용하지 않는다. 추천한 자료는 계속 빠진다.
    writeContextDocument(root, "learning-interests", "- 데이터베이스 내부 구조");
    expect((await store.getCandidates({})).candidates.map((candidate) => candidate.contentKey)).toEqual(["b", "c"]);
  });

  test("같은 날의 추천은 한 번만 저장되고 직전 주제는 다시 고를 수 없다", async () => {
    const { store } = await seeded();
    await store.createRecommendationRun(run("morning-2026-11-21", "topic-1", ["a"]), "run-1");
    await expect(
      store.createRecommendationRun(run("morning-2026-11-21", "topic-2", ["b"]), "run-1-again"),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    await expect(
      store.createRecommendationRun(run("morning-2026-11-22", "topic-1", ["b"]), "run-2"),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    await expect(
      store.createRecommendationRun(run("morning-2026-11-22", "topic-2", ["a"]), "run-3"),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    await expect(
      store.createRecommendationRun(
        { ...run("morning-2026-11-22", "topic-2", ["b"]), candidateContextVersion: "learning-interests:sha256:old" },
        "run-4",
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(await store.createRecommendationRun(run("morning-2026-11-22", "topic-2", ["b"]), "run-5")).toEqual({
      reportId: "morning-2026-11-22",
      historyVersion: 2,
    });
    expect(await store.getRecommendationRunStatus("morning-2026-11-22")).toEqual({
      reportId: "morning-2026-11-22",
      exists: true,
    });
  });

  test("게시 기록은 추천 실행이 있을 때만 저장되고 추천 실행 목록에서 보인다", async () => {
    const { store } = await seeded();
    const publication = {
      reportId: "morning-2026-11-21",
      channel: "blog",
      url: "https://example.com/published/1",
      externalId: "post-1",
      publishedAt: "2026-11-21T03:00:00.000Z",
      idempotencyKey: "publication-1",
    };
    await expect(store.createPublication(publication, publication.idempotencyKey)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await store.createRecommendationRun(run("morning-2026-11-21", "topic-1", ["a"]), "run-1");
    const saved = await store.createPublication(publication, publication.idempotencyKey);
    expect(await store.createPublication(publication, publication.idempotencyKey)).toEqual(saved);

    expect((await store.listRecommendationRuns()).runs).toEqual([
      {
        reportId: "morning-2026-11-21",
        generatedAt: "2026-11-21T00:00:00.000Z",
        publications: [
          { channel: "blog", url: "https://example.com/published/1", externalId: "post-1", publishedAt: "2026-11-21T03:00:00.000Z" },
        ],
        topics: [
          {
            topicKey: "topic-1",
            title: "주제 topic-1",
            careerQuestion: "이 주제가 다음 역할에 왜 필요한가",
            items: [{ contentKey: "a", title: "글 a", url: "https://example.com/posts/a" }],
          },
        ],
      },
    ]);
  });

  test("꺼진 소스의 자료는 후보에서 빠지고 그 소스에는 수집을 저장하지 않는다", async () => {
    const { store } = await seeded();
    await store.upsertSource("example-blog", sourceBody(1, { enabled: false }), "source-off");
    expect((await store.getCandidates({})).candidates).toEqual([]);
    const next = ingestion(["d"], 1, { lastSeen: "d" });
    await expect(store.createIngestion(next, next.idempotencyKey)).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  test("후보는 발행 시각이 최신인 것부터 주고 cursor 로 이어 읽는다", async () => {
    const { store } = setup();
    await store.upsertSource("example-blog", sourceBody(0), "source-1");
    const body = {
      ...ingestion([], 0, null as unknown as Record<string, unknown>),
      items: [item("old", "2026-11-01T00:00:00.000Z"), item("new", "2026-11-20T00:00:00.000Z"), item("undated", null)],
      idempotencyKey: "ingest-order",
    };
    await store.createIngestion(body, body.idempotencyKey);
    const first = await store.getCandidates({ limit: 2 });
    expect(first.candidates.map((candidate) => candidate.contentKey)).toEqual(["new", "old"]);
    expect(first.nextCursor).not.toBeNull();
    const second = await store.getCandidates({ limit: 2, cursor: first.nextCursor! });
    expect(second.candidates.map((candidate) => candidate.contentKey)).toEqual(["undated"]);
    expect(second.nextCursor).toBeNull();
  });
});
