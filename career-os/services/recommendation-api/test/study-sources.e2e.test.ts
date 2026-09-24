import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startE2eHarness, type E2eHarness } from "./support/e2e-harness.js";

const clientContracts = await import(
  new URL(
    "../../../scripts/study-topic-recommender/study-library/contracts.ts",
    import.meta.url,
  ).href,
);

let harness: E2eHarness;

beforeAll(async () => {
  harness = await startE2eHarness();
});

afterAll(async () => {
  await harness?.close();
});

beforeEach(async () => {
  await harness.clearAll();
});

function source(overrides: Record<string, unknown> = {}) {
  return {
    title: "예시 기술 블로그",
    category: "techBlog",
    url: "https://example.com/blog",
    feedUrl: "https://example.com/feed.xml",
    adapter: "feed",
    enabled: true,
    note: "수집 주소를 새 피드로 바꿨다.",
    expectedVersion: 0,
    ...overrides,
  };
}

function put(sourceKey: string, body: unknown, idempotencyKey?: string) {
  return harness.send("PUT", `/api/study/v1/sources/${sourceKey}`, { body, idempotencyKey });
}

describe("학습 소스", () => {
  it("새 소스를 저장하고 note를 포함한 목록 계약으로 돌려준다", async () => {
    const saved = await put("example", source(), "study-source-create");

    expect(saved.status).toBe(200);
    expect(saved.json).toEqual({
      source: {
        sourceKey: "example",
        title: "예시 기술 블로그",
        category: "techBlog",
        url: "https://example.com/blog",
        feedUrl: "https://example.com/feed.xml",
        adapter: "feed",
        enabled: true,
        note: "수집 주소를 새 피드로 바꿨다.",
        version: 1,
      },
      version: 1,
    });
    expect(clientContracts.studyLibrarySourceUpsertResponseSchema.parse(saved.json)).toEqual(saved.json);

    const listed = await harness.send("GET", "/api/study/v1/sources");
    expect(listed.status).toBe(200);
    expect(clientContracts.studyLibrarySourcesResponseSchema.parse(listed.json)).toEqual(listed.json);
    expect((listed.json as { sources: Array<{ note: string | null }> }).sources[0]?.note).toBe(
      "수집 주소를 새 피드로 바꿨다.",
    );
  });

  it("이전 version으로 다시 저장하면 충돌을 돌려준다", async () => {
    await put("example", source(), "study-source-first");
    const conflict = await put("example", source({ title: "다른 제목" }), "study-source-conflict");

    expect(conflict.status).toBe(409);
    expect(conflict.json).toMatchObject({ error: { code: "VERSION_CONFLICT" } });
  });

  it("수집할 수 없는 adapter별 주소 조합을 거부한다", async () => {
    const cases = [
      source({ url: null, feedUrl: null }),
      source({ adapter: "feed", feedUrl: null }),
      source({ adapter: "page", url: null }),
      source({ adapter: "youtube", feedUrl: null }),
      source({ adapter: "youtube", url: null }),
      source({ url: "http://example.com/blog" }),
    ];
    for (const [index, body] of cases.entries()) {
      expect(
        clientContracts.studyLibrarySourcePutPayloadSchema.safeParse(body).success,
        `client invalid-${index}`,
      ).toBe(false);
      const reply = await put(`invalid-${index}`, body, `study-source-invalid-${index}`);
      expect(reply.status, `invalid-${index}`).toBe(400);
    }
  });

  it("SQL 제약도 HTTP가 우회된 비HTTPS 주소를 막는다", async () => {
    await expect(
      harness.prisma.$executeRawUnsafe(
        `INSERT INTO study_sources
          (source_key, title, category, adapter, url, feed_url, enabled, version, created_at, updated_at)
         VALUES ('unsafe', '직접 입력', 'techBlog', 'page', 'http://example.com', NULL, 1, 1, NOW(3), NOW(3))`,
      ),
    ).rejects.toThrow();
  });

  it("없는 cursor는 null과 0으로, 없는 source는 404로 돌려준다", async () => {
    await put("example", source(), "study-source-cursor-source");
    const empty = await harness.send("GET", "/api/study/v1/sources/example/cursor?mode=recent");
    expect(empty.status).toBe(200);
    expect(clientContracts.studyLibraryCursorResultSchema.parse(empty.json)).toEqual({
      sourceKey: "example",
      mode: "recent",
      cursor: null,
      version: 0,
    });

    const missing = await harness.send("GET", "/api/study/v1/sources/missing/cursor?mode=archive");
    expect(missing.status).toBe(404);
  });

  it("Idempotency-Key 없이 쓰기 요청을 거부한다", async () => {
    const reply = await put("missing-key", source());
    expect(reply.status).toBe(400);
    expect(reply.json).toMatchObject({ error: { code: "BAD_REQUEST" } });
  });
});
