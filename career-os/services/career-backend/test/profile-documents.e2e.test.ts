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

const basePath = "/api/profile/v1/documents";
const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function put(documentKey: string, body: unknown, idempotencyKey: string) {
  return harness.send("PUT", `${basePath}/${documentKey}`, { body, idempotencyKey });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    body: "# 예시 프로필\n\n- 예시 경력 한 줄",
    note: "예시 프로필 원고를 처음 저장한다.",
    expectedVersion: 0,
    ...overrides,
  };
}

type RevisionRow = { document_key: string; version: number; body: string; note: string };

async function revisions(documentKey: string): Promise<RevisionRow[]> {
  const rows = await harness.prisma.$queryRawUnsafe<RevisionRow[]>(
    "SELECT document_key, version, body, note FROM profile_document_revisions WHERE document_key = ? ORDER BY version",
    documentKey,
  );
  return rows.map((row) => ({ ...row, version: Number(row.version) }));
}

async function documentRow(documentKey: string) {
  const rows = await harness.prisma.$queryRawUnsafe<Array<{ body: string; note: string; version: number }>>(
    "SELECT body, note, version FROM profile_documents WHERE document_key = ?",
    documentKey,
  );
  return rows[0] ? { ...rows[0], version: Number(rows[0].version) } : undefined;
}

describe("프로필 원고", () => {
  it("새 문서를 expectedVersion 0 으로 저장하면 version 1 과 이력 행 하나가 생기고 응답과 멱등 기록에는 본문이 없다", async () => {
    const saved = await put("github", payload(), "profile-create");

    expect(saved.status).toBe(200);
    expect(saved.json).toEqual({
      document: { documentKey: "github", version: 1, updatedAt: expect.stringMatching(isoPattern) },
    });
    const document = (saved.json as { document: Record<string, unknown> }).document;
    expect(document, "PUT 응답에 본문이 없어야 한다").not.toHaveProperty("body");
    expect(document, "PUT 응답에 note 가 없어야 한다").not.toHaveProperty("note");

    expect(await revisions("github")).toEqual([
      {
        document_key: "github",
        version: 1,
        body: "# 예시 프로필\n\n- 예시 경력 한 줄",
        note: "예시 프로필 원고를 처음 저장한다.",
      },
    ]);

    const receipts = await harness.prisma.$queryRawUnsafe<Array<{ response_body: unknown }>>(
      "SELECT response_body FROM request_receipts WHERE idempotency_key = ?",
      "profile-create",
    );
    expect(receipts).toHaveLength(1);
    expect(JSON.stringify(receipts[0]?.response_body), "멱등 기록에 본문이 남으면 안 된다").not.toContain("예시 경력 한 줄");

    const fetched = await harness.send("GET", `${basePath}/github`);
    expect(fetched.status).toBe(200);
    expect(fetched.json).toEqual({
      document: {
        documentKey: "github",
        body: "# 예시 프로필\n\n- 예시 경력 한 줄",
        version: 1,
        note: "예시 프로필 원고를 처음 저장한다.",
        updatedAt: document.updatedAt,
      },
    });
  });

  it("현재 version 으로 다시 저장하면 version 2 가 되고 첫 이력 행은 그대로 남는다", async () => {
    await put("github", payload(), "profile-first");
    const second = await put(
      "github",
      payload({ body: "# 바뀐 예시\n\n- 다른 경력 한 줄", note: "예시 원고를 바꾼다.", expectedVersion: 1 }),
      "profile-second",
    );

    expect(second.status).toBe(200);
    expect(second.json).toMatchObject({ document: { documentKey: "github", version: 2 } });
    expect(await revisions("github")).toEqual([
      { document_key: "github", version: 1, body: "# 예시 프로필\n\n- 예시 경력 한 줄", note: "예시 프로필 원고를 처음 저장한다." },
      { document_key: "github", version: 2, body: "# 바뀐 예시\n\n- 다른 경력 한 줄", note: "예시 원고를 바꾼다." },
    ]);
    expect(await documentRow("github")).toEqual({
      body: "# 바뀐 예시\n\n- 다른 경력 한 줄",
      note: "예시 원고를 바꾼다.",
      version: 2,
    });
  });

  it("expectedVersion 이 현재 version 과 다르면 409 이고 문서와 이력이 바뀌지 않는다", async () => {
    await put("github", payload(), "profile-before-conflict");
    const stale = await put("github", payload({ body: "덮어쓰면 안 되는 본문", expectedVersion: 0 }), "profile-stale");
    const ahead = await put("github", payload({ body: "덮어쓰면 안 되는 본문", expectedVersion: 5 }), "profile-ahead");
    const newWithVersion = await put("wanted", payload({ expectedVersion: 1 }), "profile-new-nonzero");

    for (const [label, reply] of [["낮은 version", stale], ["높은 version", ahead], ["새 문서의 0 아닌 version", newWithVersion]] as const) {
      expect(reply.status, label).toBe(409);
      expect(reply.json, label).toMatchObject({ error: { code: "VERSION_CONFLICT" } });
    }
    expect(await documentRow("github")).toEqual({
      body: "# 예시 프로필\n\n- 예시 경력 한 줄",
      note: "예시 프로필 원고를 처음 저장한다.",
      version: 1,
    });
    expect(await revisions("github")).toHaveLength(1);
    expect(await documentRow("wanted")).toBeUndefined();
    expect(await revisions("wanted")).toEqual([]);
  });

  it("정하지 않은 문서 키와 후보자 맥락의 문서 키는 GET 과 PUT 모두 400 이고 행이 생기지 않는다", async () => {
    for (const documentKey of ["unknown-key", "career-status"]) {
      const written = await put(documentKey, payload(), `profile-invalid-key-${documentKey}`);
      const read = await harness.send("GET", `${basePath}/${documentKey}`);

      expect(written.status, `PUT ${documentKey}`).toBe(400);
      expect(written.json, `PUT ${documentKey}`).toMatchObject({ error: { code: "BAD_REQUEST" } });
      expect(read.status, `GET ${documentKey}`).toBe(400);
      expect(read.json, `GET ${documentKey}`).toMatchObject({ error: { code: "BAD_REQUEST" } });
    }
    expect(await harness.prisma.$queryRawUnsafe<unknown[]>("SELECT document_key FROM profile_documents")).toEqual([]);
    expect(await harness.prisma.$queryRawUnsafe<unknown[]>("SELECT document_key FROM profile_document_revisions")).toEqual([]);
    expect(await harness.prisma.$queryRawUnsafe<unknown[]>("SELECT document_key FROM candidate_context_documents")).toEqual([]);
  });

  it("비었거나 공백뿐인 본문과 UTF-8 64 KiB 를 넘는 본문은 400 이고 64 KiB 정확히는 저장한다", async () => {
    const cases: Array<[string, string]> = [
      ["빈 본문", ""],
      ["공백뿐인 본문", "  \n\t "],
      ["ASCII 65,537 바이트", "a".repeat(65_537)],
      // 한 글자가 3 바이트라 글자 수는 상한보다 작아도 바이트 수는 넘는다. 65,535 + 2 바이트다.
      ["한글이 섞인 65,537 바이트", `${"가".repeat(21_845)}ab`],
    ];
    for (const [index, [label, body]] of cases.entries()) {
      const reply = await put("linkedin", payload({ body }), `profile-invalid-body-${index}`);
      expect(reply.status, label).toBe(400);
      expect(reply.json, label).toMatchObject({ error: { code: "BAD_REQUEST" } });
    }
    expect(await documentRow("linkedin")).toBeUndefined();

    const atLimit = await put("linkedin", payload({ body: `${"가".repeat(21_845)}a` }), "profile-at-limit");
    expect(atLimit.status).toBe(200);
    const stored = await documentRow("linkedin");
    expect(Buffer.byteLength(stored?.body ?? "", "utf8")).toBe(65_536);
  });

  it("저장한 적 없는 문서를 조회하면 404 다", async () => {
    const reply = await harness.send("GET", `${basePath}/wanted`);

    expect(reply.status).toBe(404);
    expect(reply.json).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("문서 목록은 본문과 note 없이 키, version, updatedAt 을 키 순으로 돌려준다", async () => {
    await put("wanted", payload(), "profile-list-wanted");
    await put("linkedin", payload(), "profile-list-linkedin");
    await put("github", payload(), "profile-list-github");
    await put("wanted", payload({ expectedVersion: 1 }), "profile-list-wanted-2");

    const listed = await harness.send("GET", basePath);

    expect(listed.status).toBe(200);
    expect(listed.json).toEqual({
      documents: [
        { documentKey: "github", version: 1, updatedAt: expect.stringMatching(isoPattern) },
        { documentKey: "linkedin", version: 1, updatedAt: expect.stringMatching(isoPattern) },
        { documentKey: "wanted", version: 2, updatedAt: expect.stringMatching(isoPattern) },
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
      put("linkedin", payload({ body: "첫 요청 본문" }), "profile-concurrent-first"),
      put("linkedin", payload({ body: "둘째 요청 본문" }), "profile-concurrent-second"),
    ]);

    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409]);
    expect(replies.find((reply) => reply.status === 409)?.json).toMatchObject({
      error: { code: "VERSION_CONFLICT" },
    });
    expect((await documentRow("linkedin"))?.version).toBe(1);
    expect(await revisions("linkedin")).toHaveLength(1);
  });

  it("프로필 원고를 저장해도 후보자 맥락 문서 table 에는 행이 생기지 않는다", async () => {
    const saved = await put("wanted", payload(), "profile-separate-table");

    expect(saved.status).toBe(200);
    expect(await harness.prisma.$queryRawUnsafe<unknown[]>("SELECT document_key FROM candidate_context_documents")).toEqual([]);
    expect(await harness.prisma.$queryRawUnsafe<unknown[]>("SELECT document_key FROM candidate_context_document_revisions")).toEqual([]);
  });
});
