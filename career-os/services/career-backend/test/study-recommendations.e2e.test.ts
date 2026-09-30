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
  expect(await harness.putLearningInterests("이벤트 소싱과 메시지 큐를 공부하고 싶다.")).toBe(1);
  expect((await harness.send("PUT", "/api/study/v1/sources/example", {
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
  })).status).toBe(200);
});

function nextKey(prefix: string): string {
  requestNumber += 1;
  return `study-recommendations-${prefix}-${requestNumber}`;
}

function material(contentKey: string) {
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
  };
}

async function ingest(contentKeys: string[]): Promise<void> {
  const reply = await harness.send("POST", "/api/study/v1/ingestions", {
    idempotencyKey: nextKey("ingestion"),
    body: {
      sourceKey: "example",
      mode: "recent",
      items: contentKeys.map(material),
      cursor: null,
      expectedCursorVersion: 0,
      idempotencyKey: nextKey("payload"),
    },
  });
  expect(reply.status).toBe(201);
}

function run(reportId: string, topicKey: string, contentKeys: string[], overrides: Record<string, unknown> = {}) {
  return {
    reportId,
    generatedAt: "2026-09-24T13:00:00.000Z",
    candidateContextVersion: "learning-interests:v1",
    topics: [{
      topicKey,
      title: `주제 ${topicKey}`,
      careerQuestion: `질문 ${topicKey}`,
      items: contentKeys.map((contentKey) => ({
        contentKey,
        summary: `요약 ${contentKey}`,
        reason: `이유 ${contentKey}`,
        careerValue: "current-work",
      })),
    }],
    rejections: [],
    ...overrides,
  };
}

function saveRun(body: unknown, idempotencyKey = nextKey("run")) {
  return harness.send("POST", "/api/study/v1/recommendation-runs", { body, idempotencyKey });
}

describe("학습 추천 실행", () => {
  it("추천과 제외 판정을 함께 저장해 후보에서 빼고 이력 버전을 올린다", async () => {
    await ingest(["selected-a", "selected-b", "rejected-a", "rejected-b", "rejected-c"]);
    const saved = await saveRun(run("morning-2026-09-24", "transaction", ["selected-a", "selected-b"], {
      rejections: [
        { contentKey: "rejected-a", reason: "현재 우선순위와 다릅니다." },
        { contentKey: "rejected-b", reason: "이미 검토했습니다." },
        { contentKey: "rejected-c", reason: "중복 주제입니다." },
      ],
    }));

    expect(saved.status).toBe(201);
    expect(clientContracts.studyLibraryRecommendationRunResultSchema.parse(saved.json)).toEqual({
      reportId: "morning-2026-09-24",
      historyVersion: 1,
    });
    const candidates = await harness.send("GET", "/api/study/v1/candidates");
    expect((candidates.json as { candidates: unknown[]; historyVersion: number })).toMatchObject({
      candidates: [],
      historyVersion: 1,
    });
  });

  it("같은 멱등 키는 저장한 응답을 돌려주고 같은 reportId의 다른 요청은 거부한다", async () => {
    await ingest(["first", "second"]);
    const body = run("morning-2026-09-24", "first-topic", ["first"]);
    const key = nextKey("replay");
    const saved = await saveRun(body, key);
    const replayed = await saveRun(body, key);
    const conflict = await saveRun(run("morning-2026-09-24", "second-topic", ["second"]));

    expect(replayed).toMatchObject({ status: 201, json: saved.json });
    expect(conflict.status).toBe(409);
  });

  it("직전 주제와 이미 추천한 자료를 다시 저장하지 않고 이전 저장을 유지한다", async () => {
    await ingest(["first", "other"]);
    expect((await saveRun(run("morning-2026-09-24", "kept-topic", ["first"]))).status).toBe(201);
    expect((await saveRun(run("morning-2026-09-25", "kept-topic", ["other"]))).status).toBe(409);
    const repeatedMaterial = await saveRun(run("morning-2026-09-25", "new-topic", ["first"]));
    expect(repeatedMaterial.status).toBe(409);
    expect(await harness.prisma.$queryRawUnsafe("SELECT report_id FROM study_recommendation_runs ORDER BY report_id"))
      .toEqual([{ report_id: "morning-2026-09-24" }]);
  });

  it("현재 후보 기준이 아니거나 자료가 없거나 추천과 제외가 겹치면 저장하지 않는다", async () => {
    await ingest(["selected", "rejected"]);
    const stale = await saveRun(run("morning-2026-09-24", "stale", ["selected"], {
      candidateContextVersion: "learning-interests:v2",
    }));
    const overlapping = await saveRun(run("morning-2026-09-24", "overlapping", ["selected"], {
      rejections: [{ contentKey: "selected", reason: "겹칩니다." }],
    }));
    const missingMaterial = await saveRun(run("morning-2026-09-24", "missing", ["missing"]));

    expect(stale.status).toBe(409);
    expect(overlapping.status).toBe(400);
    expect(missingMaterial.status).toBe(400);
    expect(await harness.prisma.$queryRawUnsafe("SELECT report_id FROM study_recommendation_runs"))
      .toEqual([]);
  });

  it("이관한 NULL 추천을 저장하고 기준 버전 변경 뒤 이전 제외 자료를 다시 후보로 돌린다", async () => {
    await ingest(["nullable", "rejected"]);
    const saved = await saveRun(run("morning-2026-09-24", "nullable", ["nullable"], {
      topics: [{
        topicKey: "nullable",
        title: "NULL 허용 주제",
        careerQuestion: null,
        items: [{ contentKey: "nullable", summary: null, reason: null, careerValue: null }],
      }],
      rejections: [{ contentKey: "rejected", reason: "현재와 맞지 않습니다." }],
    }));
    expect(saved.status).toBe(201);
    const stored = await harness.prisma.$queryRawUnsafe<Array<{ summary: string | null; reason: string | null }>>(
      "SELECT summary, reason FROM study_recommended_materials WHERE content_key = 'nullable'",
    );
    expect(stored).toEqual([{ summary: null, reason: null }]);
    expect((await harness.send("GET", "/api/study/v1/candidates")).json).toMatchObject({ candidates: [] });

    expect(await harness.putLearningInterests("검색 엔진 색인 구조를 공부하고 싶다.")).toBe(2);
    expect((await harness.send("GET", "/api/study/v1/candidates")).json).toMatchObject({
      candidateContextVersion: "learning-interests:v2",
      candidates: [{ contentKey: "rejected" }],
    });
  });

  it("게시 이력과 추천 실행 존재 여부를 기록하고 없는 실행의 게시를 거부한다", async () => {
    expect(await harness.send("GET", "/api/study/v1/recommendation-runs/morning-2026-09-24/status"))
      .toMatchObject({ status: 200, json: { reportId: "morning-2026-09-24", exists: false } });
    const missing = await harness.send("POST", "/api/study/v1/publications", {
      idempotencyKey: nextKey("missing-publication"),
      body: {
        reportId: "morning-2026-09-24", channel: "blog", url: null, externalId: "missing",
        publishedAt: "2026-09-24T13:00:00.000Z", idempotencyKey: "publication:missing",
      },
    });
    expect(missing.status).toBe(404);

    await ingest(["published"]);
    expect((await saveRun(run("morning-2026-09-24", "published", ["published"]))).status).toBe(201);
    expect(await harness.send("GET", "/api/study/v1/recommendation-runs/morning-2026-09-24/status"))
      .toMatchObject({ status: 200, json: { reportId: "morning-2026-09-24", exists: true } });
    const publication = await harness.send("POST", "/api/study/v1/publications", {
      idempotencyKey: nextKey("publication"),
      body: {
        reportId: "morning-2026-09-24", channel: "blog", url: "https://example.com/post", externalId: "post-1",
        publishedAt: "2026-09-24T13:00:00.000Z", idempotencyKey: "publication:post-1",
      },
    });
    expect(publication.status).toBe(201);
    expect(clientContracts.studyLibraryPublicationResultSchema.parse(publication.json).publicationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("문서 본문을 A, B, A로 되돌려 저장해도 기준 버전은 계속 올라 이전 제외 판정이 되살아나지 않는다", async () => {
    await ingest(["kept", "rejected"]);
    expect((await saveRun(run("morning-2026-09-24", "kept", ["kept"], {
      rejections: [{ contentKey: "rejected", reason: "지금은 필요 없습니다." }],
    }))).status).toBe(201);
    expect(await harness.putLearningInterests("분산 락과 재시도 전략을 공부하고 싶다.")).toBe(2);
    expect(await harness.putLearningInterests("이벤트 소싱과 메시지 큐를 공부하고 싶다.")).toBe(3);

    expect((await harness.send("GET", "/api/study/v1/candidates")).json).toMatchObject({
      candidateContextVersion: "learning-interests:v3",
      learningInterests: { version: 3, body: "이벤트 소싱과 메시지 큐를 공부하고 싶다." },
      candidates: [{ contentKey: "rejected" }],
    });
  });

  it("후보를 받은 뒤 문서를 다시 저장하면 받은 기준 버전의 추천 저장을 409 VERSION_CONFLICT 로 거부한다", async () => {
    await ingest(["selected"]);
    const candidates = await harness.send("GET", "/api/study/v1/candidates");
    const received = (candidates.json as { candidateContextVersion: string }).candidateContextVersion;
    expect(received).toBe("learning-interests:v1");
    expect(await harness.putLearningInterests("관계형 DB 인덱스 설계를 공부하고 싶다.")).toBe(2);

    const stale = await saveRun(run("morning-2026-09-24", "stale", ["selected"], { candidateContextVersion: received }));
    expect(stale.status).toBe(409);
    expect(stale.json).toMatchObject({ error: { code: "VERSION_CONFLICT" } });
    expect(await harness.prisma.$queryRawUnsafe("SELECT report_id FROM study_recommendation_runs")).toEqual([]);
  });

  it("learning-interests 문서가 없으면 추천 저장을 409 CANDIDATE_CONTEXT_MISSING 으로 거부한다", async () => {
    await harness.clearAll();
    const reply = await saveRun(run("morning-2026-09-24", "missing-context", ["selected"]));
    expect(reply.status).toBe(409);
    expect(reply.json).toMatchObject({ error: { code: "CANDIDATE_CONTEXT_MISSING" } });
    expect(await harness.prisma.$queryRawUnsafe("SELECT report_id FROM study_recommendation_runs")).toEqual([]);
  });

  it("사람이 기준 버전을 따로 올리던 경로는 없다", async () => {
    const reply = await harness.send("PUT", "/api/study/v1/recommendation-control", {
      idempotencyKey: nextKey("removed-control"),
      body: { candidateContextVersion: "learning-interests:v1" },
    });
    expect(reply.status).toBe(404);
  });
});
