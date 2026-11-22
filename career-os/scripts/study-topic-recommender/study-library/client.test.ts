import { afterEach, describe, expect, test } from "bun:test";
import { contextVersion } from "../../lib/career-store/context.ts";
import { CareerStoreError } from "../../lib/career-store/errors.ts";
import { cleanupCareerWorkspaces, createCareerWorkspace } from "../../lib/career-store/test-support.ts";
import { StudyLibraryClient } from "./client.js";
import type { StudyLibrarySourcePutPayload } from "./contracts.js";

afterEach(cleanupCareerWorkspaces);

const INTERESTS = "- 예시 관심사 문장";

function client(documents: { "learning-interests"?: string } = { "learning-interests": INTERESTS }) {
  const { environment, db } = createCareerWorkspace(documents);
  return { db, client: new StudyLibraryClient({ environment }) };
}

const source: StudyLibrarySourcePutPayload = {
  title: "예시 블로그",
  category: "techBlog",
  adapter: "feed",
  url: null,
  feedUrl: "https://example.com/feed.xml",
  enabled: true,
  note: "테스트",
  expectedVersion: 0,
};

const ingestion = {
  sourceKey: "example",
  mode: "recent",
  items: [
    {
      contentKey: "post-1",
      canonicalUrl: "https://example.com/post-1",
      url: "https://example.com/post-1",
      title: "글 1",
      published: "2026-11-20",
      publishedAt: "2026-11-20T00:00:00.000Z",
      excerpt: null,
      kind: "feed-article",
      tags: [],
      collectedAt: "2026-11-21T00:00:00.000Z",
    },
  ],
  cursor: { lastSeen: "post-1" },
  expectedCursorVersion: 0,
  idempotencyKey: "ingest-1",
};

describe("StudyLibraryClient", () => {
  test("작업 폴더 저장소에 소스를 쓰고 읽는다", async () => {
    const { client: library } = client();
    expect(await library.getSources()).toEqual({ sources: [] });
    const saved = await library.putSource("example", source);
    expect(saved).toMatchObject({ version: 1, source: { sourceKey: "example", feedUrl: "https://example.com/feed.xml" } });
    expect((await library.getSources()).sources).toEqual([saved.source]);
  });

  test("같은 쓰기를 다시 보내면 처음 응답을 돌려주고 한 번만 반영한다", async () => {
    const { client: library, db } = client();
    const first = await library.putSource("example", source);
    expect(await library.putSource("example", source)).toEqual(first);
    await library.createIngestion(ingestion);
    expect(await library.createIngestion(ingestion)).toMatchObject({ acceptedCount: 1, cursorVersion: 1 });
    expect(db.all("SELECT idempotency_key FROM request_receipts ORDER BY idempotency_key").map((row) => String(row.idempotency_key).split(":")[0])).toEqual(["ingest-1", "source"]);
  });

  test("수집한 자료를 후보로 읽고 저장한 커서를 돌려준다", async () => {
    const { client: library } = client();
    await library.putSource("example", source);
    await library.createIngestion(ingestion);
    expect(await library.getSourceCursor("example", "recent")).toEqual({
      sourceKey: "example",
      mode: "recent",
      cursor: { lastSeen: "post-1" },
      version: 1,
    });
    // 값이 없는 필터는 보내지 않는다.
    const page = await library.getCandidates({ category: "techBlog", sourceKey: undefined, limit: 10, cursor: null });
    expect(page.candidates.map((candidate) => candidate.contentKey)).toEqual(["post-1"]);
    expect(page.learningInterests).toEqual({ version: contextVersion("learning-interests", INTERESTS), body: INTERESTS });
    expect(page.candidateContextVersion).toBe(page.learningInterests.version);
  });

  test("추천과 게시 기록을 저장하고 추천 실행 목록에서 읽는다", async () => {
    const { client: library } = client();
    await library.putSource("example", source);
    await library.createIngestion(ingestion);
    const run = {
      reportId: "morning-2026-11-21",
      generatedAt: "2026-11-21T00:00:00.000Z",
      candidateContextVersion: contextVersion("learning-interests", INTERESTS),
      rejections: [],
      topics: [{ topicKey: "topic", title: "주제", careerQuestion: "질문", items: [{ contentKey: "post-1", summary: "요약", reason: "이유", careerValue: "target-role" }] }],
    };
    expect(await library.createRecommendationRun(run)).toEqual({ reportId: "morning-2026-11-21", historyVersion: 1 });
    expect(await library.createRecommendationRun(run)).toEqual({ reportId: "morning-2026-11-21", historyVersion: 1 });
    expect(await library.getRecommendationRunStatus("morning-2026-11-21")).toEqual({ reportId: "morning-2026-11-21", exists: true });
    await library.createPublication({ idempotencyKey: "publication-1", reportId: "morning-2026-11-21", channel: "blog", publishedAt: "2026-11-21T01:00:00.000Z", externalId: "p-1", url: "https://example.com/p-1" });
    const runs = (await library.listRecommendationRuns(5)).runs;
    expect(runs).toHaveLength(1);
    expect(runs[0]!.publications).toEqual([{ channel: "blog", url: "https://example.com/p-1", externalId: "p-1", publishedAt: "2026-11-21T01:00:00.000Z" }]);
  });

  test("계약을 어긴 본문과 버전 충돌은 저장소 오류로 올린다", async () => {
    const { client: library } = client();
    await expect(library.putSource("example", { ...source, adapter: "page" })).rejects.toMatchObject({ code: "BAD_REQUEST", status: 400 });
    await library.putSource("example", source);
    const conflict = await library.putSource("example", { ...source, title: "다른 제목" }).catch((error: unknown) => error);
    expect(conflict).toBeInstanceOf(CareerStoreError);
    expect(conflict).toMatchObject({ code: "VERSION_CONFLICT", status: 409 });
  });

  test("learning-interests 문서가 없으면 후보 조회가 멈춘다", async () => {
    const { client: library } = client({});
    await expect(library.getCandidates()).rejects.toMatchObject({ code: "CANDIDATE_CONTEXT_MISSING" });
  });
});
