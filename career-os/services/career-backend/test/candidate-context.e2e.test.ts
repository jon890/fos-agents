import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startE2eHarness, type E2eHarness } from "./support/e2e-harness.js";

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

const basePath = "/api/candidate-context/v1/documents";
const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function put(documentKey: string, body: unknown, idempotencyKey: string) {
  return harness.send("PUT", `${basePath}/${documentKey}`, { body, idempotencyKey });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    body: "# 예시 문서\n\n- 예시 항목 하나",
    note: "예시 문서를 처음 저장한다.",
    expectedVersion: 0,
    ...overrides,
  };
}

type RevisionRow = { document_key: string; version: number; body: string; note: string };

async function revisions(documentKey: string): Promise<RevisionRow[]> {
  const rows = await harness.prisma.$queryRawUnsafe<RevisionRow[]>(
    "SELECT document_key, version, body, note FROM candidate_context_document_revisions WHERE document_key = ? ORDER BY version",
    documentKey,
  );
  return rows.map((row) => ({ ...row, version: Number(row.version) }));
}

async function documentRow(documentKey: string) {
  const rows = await harness.prisma.$queryRawUnsafe<Array<{ body: string; note: string; version: number }>>(
    "SELECT body, note, version FROM candidate_context_documents WHERE document_key = ?",
    documentKey,
  );
  return rows[0] ? { ...rows[0], version: Number(rows[0].version) } : undefined;
}

describe("후보자 맥락 문서", () => {
  it("새 문서를 expectedVersion 0 으로 저장하면 version 1 과 이력 행 하나가 생기고 응답에는 본문이 없다", async () => {
    const saved = await put("learning-interests", payload(), "candidate-context-create");

    expect(saved.status).toBe(200);
    expect(saved.json).toEqual({
      document: { documentKey: "learning-interests", version: 1, updatedAt: expect.stringMatching(isoPattern) },
    });
    const document = (saved.json as { document: Record<string, unknown> }).document;
    expect(document, "PUT 응답에 본문이 없어야 한다").not.toHaveProperty("body");
    expect(document, "PUT 응답에 note 가 없어야 한다").not.toHaveProperty("note");

    expect(await revisions("learning-interests")).toEqual([
      {
        document_key: "learning-interests",
        version: 1,
        body: "# 예시 문서\n\n- 예시 항목 하나",
        note: "예시 문서를 처음 저장한다.",
      },
    ]);

    const receipts = await harness.prisma.$queryRawUnsafe<Array<{ response_body: unknown }>>(
      "SELECT response_body FROM request_receipts WHERE idempotency_key = ?",
      "candidate-context-create",
    );
    expect(receipts).toHaveLength(1);
    expect(JSON.stringify(receipts[0]?.response_body), "멱등 기록에 본문이 남으면 안 된다").not.toContain("예시 항목 하나");

    const fetched = await harness.send("GET", `${basePath}/learning-interests`);
    expect(fetched.status).toBe(200);
    expect(fetched.json).toEqual({
      document: {
        documentKey: "learning-interests",
        body: "# 예시 문서\n\n- 예시 항목 하나",
        version: 1,
        note: "예시 문서를 처음 저장한다.",
        updatedAt: document.updatedAt,
      },
    });
  });

  it("현재 version 으로 다시 저장하면 version 2 가 되고 첫 이력 행은 그대로 남는다", async () => {
    await put("learning-interests", payload(), "candidate-context-first");
    const second = await put(
      "learning-interests",
      payload({ body: "# 바뀐 예시\n\n- 다른 항목", note: "예시 본문을 바꾼다.", expectedVersion: 1 }),
      "candidate-context-second",
    );

    expect(second.status).toBe(200);
    expect(second.json).toMatchObject({ document: { documentKey: "learning-interests", version: 2 } });
    expect(await revisions("learning-interests")).toEqual([
      { document_key: "learning-interests", version: 1, body: "# 예시 문서\n\n- 예시 항목 하나", note: "예시 문서를 처음 저장한다." },
      { document_key: "learning-interests", version: 2, body: "# 바뀐 예시\n\n- 다른 항목", note: "예시 본문을 바꾼다." },
    ]);
    expect(await documentRow("learning-interests")).toEqual({
      body: "# 바뀐 예시\n\n- 다른 항목",
      note: "예시 본문을 바꾼다.",
      version: 2,
    });
  });

  it("expectedVersion 이 현재 version 과 다르면 409 이고 문서와 이력이 바뀌지 않는다", async () => {
    await put("learning-interests", payload(), "candidate-context-before-conflict");
    const stale = await put(
      "learning-interests",
      payload({ body: "덮어쓰면 안 되는 본문", expectedVersion: 0 }),
      "candidate-context-stale",
    );
    const ahead = await put(
      "learning-interests",
      payload({ body: "덮어쓰면 안 되는 본문", expectedVersion: 5 }),
      "candidate-context-ahead",
    );
    const newWithVersion = await put("career-status", payload({ expectedVersion: 1 }), "candidate-context-new-nonzero");

    for (const [label, reply] of [["낮은 version", stale], ["높은 version", ahead], ["새 문서의 0 아닌 version", newWithVersion]] as const) {
      expect(reply.status, label).toBe(409);
      expect(reply.json, label).toMatchObject({ error: { code: "VERSION_CONFLICT" } });
    }
    expect(await documentRow("learning-interests")).toEqual({
      body: "# 예시 문서\n\n- 예시 항목 하나",
      note: "예시 문서를 처음 저장한다.",
      version: 1,
    });
    expect(await revisions("learning-interests")).toHaveLength(1);
    expect(await documentRow("career-status")).toBeUndefined();
    expect(await revisions("career-status")).toEqual([]);
  });

  it("정하지 않은 문서 키는 GET 과 PUT 모두 400 이다", async () => {
    const written = await put("unknown-key", payload(), "candidate-context-unknown-key");
    const read = await harness.send("GET", `${basePath}/unknown-key`);

    expect(written.status).toBe(400);
    expect(written.json).toMatchObject({ error: { code: "BAD_REQUEST" } });
    expect(read.status).toBe(400);
    expect(read.json).toMatchObject({ error: { code: "BAD_REQUEST" } });
    const rows = await harness.prisma.$queryRawUnsafe<unknown[]>("SELECT document_key FROM candidate_context_documents");
    expect(rows).toEqual([]);
  });

  it("비었거나 공백뿐인 본문과 UTF-8 64 KiB 를 넘는 본문은 400 이고 64 KiB 정확히는 저장한다", async () => {
    const cases: Array<[string, string]> = [
      ["빈 본문", ""],
      ["공백뿐인 본문", "  \n\t "],
      ["ASCII 65,537 바이트", "a".repeat(65_537)],
      // 한 글자가 3 바이트라 글자 수는 상한보다 작아도 바이트 수는 넘는다.
      ["한글 65,538 바이트", "가".repeat(21_846)],
    ];
    for (const [index, [label, body]] of cases.entries()) {
      const reply = await put("learning-interests", payload({ body }), `candidate-context-invalid-${index}`);
      expect(reply.status, label).toBe(400);
      expect(reply.json, label).toMatchObject({ error: { code: "BAD_REQUEST" } });
    }
    expect(await documentRow("learning-interests")).toBeUndefined();

    const atLimit = await put("learning-interests", payload({ body: "a".repeat(65_536) }), "candidate-context-at-limit");
    expect(atLimit.status).toBe(200);
    expect((await documentRow("learning-interests"))?.body).toHaveLength(65_536);
  });

  it("저장한 적 없는 문서를 조회하면 404 다", async () => {
    const reply = await harness.send("GET", `${basePath}/position-preferences`);

    expect(reply.status).toBe(404);
    expect(reply.json).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("문서 목록은 본문과 note 없이 키, version, updatedAt 을 키 순으로 돌려준다", async () => {
    await put("learning-interests", payload(), "candidate-context-list-learning");
    await put("application-state", payload(), "candidate-context-list-application");
    await put("learning-interests", payload({ expectedVersion: 1 }), "candidate-context-list-learning-2");

    const listed = await harness.send("GET", basePath);

    expect(listed.status).toBe(200);
    expect(listed.json).toEqual({
      documents: [
        { documentKey: "application-state", version: 1, updatedAt: expect.stringMatching(isoPattern) },
        { documentKey: "learning-interests", version: 2, updatedAt: expect.stringMatching(isoPattern) },
      ],
    });
  });

  it("문서가 하나도 없으면 빈 목록이다", async () => {
    const listed = await harness.send("GET", basePath);

    expect(listed.status).toBe(200);
    expect(listed.json).toEqual({ documents: [] });
  });

  it("같은 새 문서를 두 요청이 동시에 만들면 하나만 저장하고 나머지는 409 다", async () => {
    const replies = await Promise.all([
      put("career-status", payload({ body: "첫 요청 본문" }), "candidate-context-concurrent-first"),
      put("career-status", payload({ body: "둘째 요청 본문" }), "candidate-context-concurrent-second"),
    ]);

    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409]);
    expect(replies.find((reply) => reply.status === 409)?.json).toMatchObject({
      error: { code: "VERSION_CONFLICT" },
    });
    expect((await documentRow("career-status"))?.version).toBe(1);
    expect(await revisions("career-status")).toHaveLength(1);
  });
});
