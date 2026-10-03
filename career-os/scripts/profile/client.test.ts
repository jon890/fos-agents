import { describe, expect, test } from "bun:test";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import { ProfileClient, type ProfileFetch } from "./client.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function client(fetchImpl: ProfileFetch): ProfileClient {
  return new ProfileClient({ origin: "https://career.example.com", token: "x".repeat(32), fetchImpl, maxRetries: 0 });
}

const receipt = { document: { documentKey: "github" as const, version: 2, updatedAt: "2026-09-01T00:00:00.000Z" } };
const payload = { body: "예시 프로필 문장", note: "예시 메모", expectedVersion: 1 };

const usagePayload = { claudeTokens: 1200, codexTokens: 300, unpricedTokens: 0, measuredOn: "2026-10-01", source: "MEASURED" as const };
const snapshot = {
  month: "2026-09", claudeTokens: 1200, codexTokens: 300, claudeCostUsd: null, codexCostUsd: null, sessions: null,
  unpricedTokens: 0, measuredOn: "2026-10-01", source: "MEASURED" as const, note: null,
  createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
};
const keyOf = (init: RequestInit) => (init.headers as Headers).get("Idempotency-Key");

describe("ProfileClient 문서", () => {
  test("putDocument 는 문서 경로에 Idempotency-Key 와 본문을 보내고 영수증을 돌려준다", async () => {
    const calls: Array<{ url: URL; init: RequestInit }> = [];
    const result = await client(async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(receipt);
    }).putDocument("github", payload);

    expect(calls[0].url.pathname).toBe("/api/profile/v1/documents/github");
    expect(calls[0].init.method).toBe("PUT");
    expect(JSON.parse(String(calls[0].init.body))).toEqual(payload);
    expect(keyOf(calls[0].init)).toStartWith("profile-document:");
    expect(result).toEqual(receipt);
  });

  test("같은 입력은 같은 키를, expectedVersion 이 다르면 다른 키를 쓴다", async () => {
    const keys: Array<string | null> = [];
    const c = client(async (_url, init) => { keys.push(keyOf(init)); return jsonResponse(receipt); });
    await c.putDocument("github", payload);
    await c.putDocument("github", { ...payload });
    await c.putDocument("github", { ...payload, expectedVersion: 2 });

    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  test("409 응답은 status, code, requestId 를 담은 CareerBackendHttpError 로 나온다", async () => {
    const c = client(async () => jsonResponse({ error: { code: "VERSION_CONFLICT", message: "raw", requestId: "req-409" } }, 409));

    await expect(c.putDocument("github", payload)).rejects.toBeInstanceOf(CareerBackendHttpError);
    await expect(c.putDocument("github", payload)).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT", requestId: "req-409" });
  });

  test("없는 문서 키와 공백뿐인 본문은 요청 전에 거절한다", async () => {
    let count = 0;
    const c = client(async () => { count += 1; return jsonResponse(receipt); });

    await expect(c.putDocument("unknown-key", payload)).rejects.toThrow();
    await expect(c.putDocument("github", { ...payload, body: "  " })).rejects.toThrow();
    expect(count).toBe(0);
  });

  test("getDocument 는 본문을 돌려주고 listDocuments 는 요약 목록을 돌려준다", async () => {
    const document = { documentKey: "github" as const, body: "예시 프로필 문장", version: 2, note: "예시 메모", updatedAt: "2026-09-01T00:00:00.000Z" };
    const c = client(async (url) => url.pathname.endsWith("/documents")
      ? jsonResponse({ documents: [{ documentKey: "github", version: 2, updatedAt: document.updatedAt }] })
      : jsonResponse({ document }));

    expect(await c.getDocument("github")).toEqual(document);
    expect((await c.listDocuments()).documents).toHaveLength(1);
  });
});

describe("ProfileClient 사용량", () => {
  test("putUsageSnapshot 은 달 경로에 Idempotency-Key 를 보내고 값이 다르면 키도 다르다", async () => {
    const calls: Array<{ url: URL; init: RequestInit }> = [];
    const c = client(async (url, init) => { calls.push({ url, init }); return jsonResponse({ snapshot, created: true }); });

    await c.putUsageSnapshot("2026-09", usagePayload);
    await c.putUsageSnapshot("2026-09", { ...usagePayload });
    await c.putUsageSnapshot("2026-09", { ...usagePayload, claudeTokens: 1201 });

    expect(calls[0].url.pathname).toBe("/api/profile/v1/usage-snapshots/2026-09");
    expect(calls[0].init.method).toBe("PUT");
    expect(keyOf(calls[0].init)).toStartWith("profile-usage:");
    expect(keyOf(calls[1].init)).toBe(keyOf(calls[0].init));
    expect(keyOf(calls[2].init)).not.toBe(keyOf(calls[0].init));
  });

  test("replace 요청은 같은 값이어도 실행마다 다른 Idempotency-Key 를 쓴다", async () => {
    const calls: RequestInit[] = [];
    const c = client(async (_url, init) => { calls.push(init); return jsonResponse({ snapshot, created: false }); });
    const replacePayload = { ...usagePayload, replace: true, note: "재측정" };

    await c.putUsageSnapshot("2026-09", replacePayload);
    await c.putUsageSnapshot("2026-09", replacePayload);

    expect(keyOf(calls[0])).toStartWith("profile-usage:");
    expect(keyOf(calls[1])).not.toBe(keyOf(calls[0]));
  });

  test("created: false 응답도 예외 없이 그대로 돌려준다", async () => {
    const stored = { ...snapshot, claudeTokens: 999 };
    const result = await client(async () => jsonResponse({ snapshot: stored, created: false })).putUsageSnapshot("2026-09", usagePayload);

    expect(result).toEqual({ snapshot: stored, created: false });
  });

  test("잘못된 달, 음수 토큰, note 없는 replace 는 요청 전에 거절한다", async () => {
    let count = 0;
    const c = client(async () => { count += 1; return jsonResponse({ snapshot, created: true }); });

    await expect(c.putUsageSnapshot("2026-13", usagePayload)).rejects.toThrow();
    await expect(c.putUsageSnapshot("2026-09", { ...usagePayload, claudeTokens: -1 })).rejects.toThrow();
    await expect(c.putUsageSnapshot("2026-09", { ...usagePayload, replace: true })).rejects.toThrow();
    expect(count).toBe(0);
  });

  test("비용 0.07 과 0.29 는 거절하지 않는다", async () => {
    const result = await client(async () => jsonResponse({ snapshot, created: true }))
      .putUsageSnapshot("2026-09", { ...usagePayload, claudeCostUsd: 0.07, codexCostUsd: 0.29 });

    expect(result.created).toBe(true);
  });

  test("비용과 세션 수가 null 인 기록 목록을 읽는다", async () => {
    const list = await client(async () => jsonResponse({ snapshots: [snapshot] })).listUsageSnapshots();

    expect(list).toEqual([snapshot]);
    expect(list[0].claudeCostUsd).toBeNull();
    expect(list[0].sessions).toBeNull();
  });

  test("계약에 없는 모양의 성공 응답은 INVALID_RESPONSE 로 나온다", async () => {
    const c = client(async () => jsonResponse({ snapshots: "none" }));

    await expect(c.listUsageSnapshots()).rejects.toBeInstanceOf(CareerBackendHttpError);
    await expect(c.listUsageSnapshots()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
