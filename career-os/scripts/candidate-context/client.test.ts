import { describe, expect, test } from "bun:test";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import { CandidateContextClient, type CandidateContextFetch } from "./client.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function client(fetchImpl: CandidateContextFetch): CandidateContextClient {
  return new CandidateContextClient({ origin: "https://career.example.com", token: "x".repeat(32), fetchImpl, maxRetries: 0 });
}

const receipt = { document: { documentKey: "learning-interests" as const, version: 2, updatedAt: "2026-09-01T00:00:00.000Z" } };
const payload = { body: "예시 관심사 문장", note: "예시 메모", expectedVersion: 1 };

describe("CandidateContextClient", () => {
  test("putDocument 는 문서 경로에 Idempotency-Key 와 본문을 보내고 영수증을 돌려준다", async () => {
    const calls: Array<{ url: URL; init: RequestInit }> = [];
    const result = await client(async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(receipt);
    }).putDocument("learning-interests", payload);

    expect(calls[0].url.pathname).toBe("/api/candidate-context/v1/documents/learning-interests");
    expect(calls[0].init.method).toBe("PUT");
    expect(JSON.parse(String(calls[0].init.body))).toEqual(payload);
    expect((calls[0].init.headers as Headers).get("Idempotency-Key")).toStartWith("candidate-context:");
    expect(result).toEqual(receipt);
  });

  test("같은 입력은 같은 키를, 다른 입력은 다른 키를 쓴다", async () => {
    const keys: Array<string | null> = [];
    const c = client(async (_url, init) => {
      keys.push((init.headers as Headers).get("Idempotency-Key"));
      return jsonResponse(receipt);
    });
    await c.putDocument("learning-interests", payload);
    await c.putDocument("learning-interests", { ...payload });
    await c.putDocument("learning-interests", { ...payload, expectedVersion: 2 });

    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  test("409 응답은 CareerBackendHttpError 로 나온다", async () => {
    const c = client(async () => jsonResponse({ error: { code: "VERSION_CONFLICT", message: "raw", requestId: "req-409" } }, 409));

    await expect(c.putDocument("learning-interests", payload)).rejects.toBeInstanceOf(CareerBackendHttpError);
    await expect(c.putDocument("learning-interests", payload)).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT", requestId: "req-409" });
  });

  test("알 수 없는 키와 빈 본문은 요청 전에 거절한다", async () => {
    let count = 0;
    const c = client(async () => { count += 1; return jsonResponse(receipt); });

    await expect(c.putDocument("unknown-key", payload)).rejects.toThrow();
    await expect(c.putDocument("learning-interests", { ...payload, body: "  " })).rejects.toThrow();
    expect(count).toBe(0);
  });

  test("getDocument 는 본문을 돌려주고 listDocuments 는 요약 목록을 돌려준다", async () => {
    const document = { documentKey: "learning-interests" as const, body: "예시 관심사 문장", version: 2, note: "예시 메모", updatedAt: "2026-09-01T00:00:00.000Z" };
    const c = client(async (url) => url.pathname.endsWith("/documents")
      ? jsonResponse({ documents: [{ documentKey: "learning-interests", version: 2, updatedAt: document.updatedAt }] })
      : jsonResponse({ document }));

    expect(await c.getDocument("learning-interests")).toEqual(document);
    expect((await c.listDocuments()).documents).toHaveLength(1);
  });
});
