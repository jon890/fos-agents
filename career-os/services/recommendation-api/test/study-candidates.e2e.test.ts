import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startE2eHarness, type E2eHarness } from "./support/e2e-harness.js";

const clientContracts = await import(
  new URL(
    "../../../scripts/study-topic-recommender/study-library/contracts.ts",
    import.meta.url,
  ).href,
);

let harness: E2eHarness;
let requestNumber = 0;

beforeAll(async () => {
  harness = await startE2eHarness();
});

afterAll(async () => {
  await harness?.close();
});

beforeEach(async () => {
  await harness.clearAll();
  requestNumber = 0;
  const source = await harness.send("PUT", "/api/study/v1/sources/example", {
    idempotencyKey: nextKey("source"),
    body: {
      title: "예시 기술 블로그",
      category: "techBlog",
      url: "https://example.com/blog",
      feedUrl: "https://example.com/feed.xml",
      adapter: "feed",
      enabled: true,
      expectedVersion: 0,
    },
  });
  expect(source.status).toBe(200);
});

function nextKey(prefix: string): string {
  requestNumber += 1;
  return `study-candidates-${prefix}-${requestNumber}`;
}

function item(contentKey: string, overrides: Record<string, unknown> = {}) {
  return {
    contentKey,
    canonicalUrl: `https://example.com/${contentKey}`,
    url: `https://example.com/${contentKey}`,
    title: `제목 ${contentKey}`,
    published: "2026-09-24",
    publishedAt: "2026-09-24T12:00:00.000Z",
    excerpt: `요약 ${contentKey}`,
    kind: "feed-article",
    tags: [],
    collectedAt: "2026-09-24T13:00:00.000Z",
    ...overrides,
  };
}

async function ingest(items: unknown[], overrides: Record<string, unknown> = {}) {
  return harness.send("POST", "/api/study/v1/ingestions", {
    idempotencyKey: nextKey("ingestion"),
    body: {
      sourceKey: "example",
      mode: "recent",
      items,
      cursor: { lastSeen: items.map((value) => (value as { contentKey: string }).contentKey) },
      expectedCursorVersion: 0,
      idempotencyKey: nextKey("payload"),
      ...overrides,
    },
  });
}

async function insertRecommendationRun(reportId: string): Promise<void> {
  await harness.prisma.$executeRawUnsafe(
    `INSERT INTO study_recommendation_runs (report_id, generated_at, candidate_context_version, created_at)
     VALUES (?, NOW(3), 'initial', NOW(3))`,
    reportId,
  );
}

describe("학습 후보", () => {
  it("ingestion으로 저장한 자료를 후보 계약과 제어 버전으로 돌려준다", async () => {
    const saved = await ingest([item("alpha"), item("beta")]);
    expect(saved.status).toBe(201);
    expect(saved.json).toEqual({ idempotencyKey: "study-candidates-payload-3", acceptedCount: 2, cursorVersion: 1 });

    const candidates = await harness.send("GET", "/api/study/v1/candidates?limit=100");
    expect(candidates.status).toBe(200);
    expect(clientContracts.studyLibraryCandidatePageSchema.parse(candidates.json)).toMatchObject({
      candidates: [{ contentKey: "alpha" }, { contentKey: "beta" }],
      historyVersion: 0,
    });
    expect(candidates.json).toMatchObject({ candidateContextVersion: "initial" });
  });

  it("같은 contentKey를 다시 받으면 자료 수는 유지하고 제목을 갱신한다", async () => {
    expect((await ingest([item("alpha")])).status).toBe(201);
    const saved = await ingest([item("alpha", { title: "바뀐 제목" })], { expectedCursorVersion: 1 });
    expect(saved.status).toBe(201);
    const rows = await harness.prisma.$queryRawUnsafe<Array<{ count: bigint; title: string }>>(
      "SELECT COUNT(*) AS count, MAX(title) AS title FROM study_materials WHERE content_key = 'alpha'",
    );
    expect(Number(rows[0]?.count)).toBe(1);
    expect(rows[0]?.title).toBe("바뀐 제목");
  });

  it("예상 cursor 버전이 다르면 자료와 cursor를 바꾸지 않는다", async () => {
    expect((await ingest([item("alpha")])).status).toBe(201);
    const conflict = await ingest([item("beta")], { expectedCursorVersion: 0 });
    expect(conflict.status).toBe(409);
    expect(await harness.prisma.$queryRawUnsafe("SELECT content_key FROM study_materials ORDER BY content_key"))
      .toEqual([{ content_key: "alpha" }]);
    const cursor = await harness.prisma.$queryRawUnsafe<Array<{ version: bigint }>>(
      "SELECT version FROM study_source_cursors WHERE source_key = 'example' AND mode = 'recent'",
    );
    expect(Number(cursor[0]?.version)).toBe(1);
  });

  it("비어 있지 않은 tags는 거부한다", async () => {
    const reply = await ingest([item("alpha", { tags: ["backend"] })]);
    expect(reply.status).toBe(400);
  });

  it("없는 소스와 꺼진 소스에는 ingestion을 허용하지 않는다", async () => {
    const missing = await harness.send("POST", "/api/study/v1/ingestions", {
      idempotencyKey: nextKey("missing-source"),
      body: {
        sourceKey: "missing",
        mode: "recent",
        items: [],
        cursor: null,
        expectedCursorVersion: 0,
        idempotencyKey: nextKey("missing-payload"),
      },
    });
    expect(missing.status).toBe(404);
    await harness.prisma.$executeRawUnsafe("UPDATE study_sources SET enabled = FALSE WHERE source_key = 'example'");
    const disabled = await ingest([]);
    expect(disabled.status).toBe(409);
  });

  it("추천된 자료와 현재 기준에서 유효한 제외 판정을 SQL에서 거른다", async () => {
    expect((await ingest([item("recommended"), item("rejected"), item("visible")])).status).toBe(201);
    await insertRecommendationRun("morning-2026-09-24");
    await harness.prisma.$executeRawUnsafe(
      "INSERT INTO study_recommendation_topics (report_id, topic_key, title, career_question, position) VALUES ('morning-2026-09-24', 'topic', '주제', NULL, 1)",
    );
    await harness.prisma.$executeRawUnsafe(
      "INSERT INTO study_recommended_materials (report_id, content_key, topic_key, summary, reason, career_value, position) VALUES ('morning-2026-09-24', 'recommended', 'topic', NULL, NULL, NULL, 1)",
    );
    await harness.prisma.$executeRawUnsafe(
      "INSERT INTO study_material_verdicts (content_key, candidate_context_version, verdict, reason, report_id, judged_at, valid_until) VALUES ('rejected', 'initial', 'rejected', '이미 검토함', 'morning-2026-09-24', NOW(3), DATE_ADD(CURDATE(), INTERVAL 1 DAY))",
    );
    const reply = await harness.send("GET", "/api/study/v1/candidates");
    expect(reply.status).toBe(200);
    expect((reply.json as { candidates: Array<{ contentKey: string }> }).candidates.map((candidate) => candidate.contentKey))
      .toEqual(["visible"]);
  });

  it("어제 만료된 판정과 기준 버전을 바꾸기 전의 판정은 후보를 막지 않는다", async () => {
    expect((await ingest([item("expired"), item("old-context")])).status).toBe(201);
    await insertRecommendationRun("morning-2026-09-24");
    await harness.prisma.$executeRawUnsafe(
      "INSERT INTO study_material_verdicts (content_key, candidate_context_version, verdict, reason, report_id, judged_at, valid_until) VALUES ('expired', 'initial', 'rejected', '만료', 'morning-2026-09-24', NOW(3), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), ('old-context', 'old', 'rejected', '이전 기준', 'morning-2026-09-24', NOW(3), DATE_ADD(CURDATE(), INTERVAL 1 DAY))",
    );
    await harness.prisma.$executeRawUnsafe(
      "UPDATE study_recommendation_control SET candidate_context_version = 'new', updated_at = NOW(3) WHERE singleton_id = 1",
    );
    const reply = await harness.send("GET", "/api/study/v1/candidates");
    expect((reply.json as { candidates: Array<{ contentKey: string }> }).candidates.map((candidate) => candidate.contentKey))
      .toEqual(["expired", "old-context"]);
  });

  it("결정적 cursor로 다음 페이지의 나머지를 돌려준다", async () => {
    expect((await ingest([
      item("newer", { publishedAt: "2026-09-25T00:00:00.000Z" }),
      item("middle", { publishedAt: "2026-09-24T00:00:00.000Z" }),
      item("null-date", { publishedAt: null }),
    ])).status).toBe(201);
    const first = await harness.send("GET", "/api/study/v1/candidates?limit=2");
    expect(first.status).toBe(200);
    const firstPage = first.json as { candidates: Array<{ contentKey: string }>; nextCursor: string | null };
    expect(firstPage.candidates.map((candidate) => candidate.contentKey)).toEqual(["newer", "middle"]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    const second = await harness.send("GET", `/api/study/v1/candidates?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor!)}`);
    expect((second.json as { candidates: Array<{ contentKey: string }> }).candidates.map((candidate) => candidate.contentKey))
      .toEqual(["null-date"]);
  });

  it("꺼진 소스에서만 나온 자료는 후보에 넣지 않는다", async () => {
    expect((await ingest([item("hidden")])).status).toBe(201);
    await harness.prisma.$executeRawUnsafe("UPDATE study_sources SET enabled = FALSE WHERE source_key = 'example'");
    const reply = await harness.send("GET", "/api/study/v1/candidates");
    expect((reply.json as { candidates: unknown[] }).candidates).toEqual([]);
  });

  it("가장 최근 추천 실행의 주제 키를 함께 돌려준다", async () => {
    await insertRecommendationRun("morning-2026-09-23");
    await insertRecommendationRun("morning-2026-09-24");
    await harness.prisma.$executeRawUnsafe(
      "INSERT INTO study_recommendation_topics (report_id, topic_key, title, career_question, position) VALUES ('morning-2026-09-23', 'old-topic', '이전', NULL, 1), ('morning-2026-09-24', 'first-topic', '첫째', NULL, 1), ('morning-2026-09-24', 'second-topic', '둘째', NULL, 2)",
    );
    const reply = await harness.send("GET", "/api/study/v1/candidates");
    expect((reply.json as { recentStudyTopicKeys: string[] }).recentStudyTopicKeys).toEqual([
      "first-topic",
      "second-topic",
    ]);
  });
});
