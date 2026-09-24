import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { StudyLibraryApiError, StudyLibraryClient, type StudyLibraryFetch } from "./client.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init.headers),
    },
  });
}

function client(fetchImpl: StudyLibraryFetch): StudyLibraryClient {
  return new StudyLibraryClient({
    origin: "https://study.example.com",
    token: "test-token-123456789012345678901234567890",
    fetchImpl,
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("StudyLibraryClient", () => {
  test("Bearer 헤더와 JSON 요청 기본값을 보낸다", async () => {
    const calls: RequestInit[] = [];
    const fetchImpl: StudyLibraryFetch = async (_url, init) => {
      calls.push(init ?? {});
      return jsonResponse({ sources: [] });
    };

    await client(fetchImpl).getSources();

    const headers = calls[0].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer test-token-123456789012345678901234567890");
    expect(headers.get("Accept")).toBe("application/json");
  });

  test("쓰기 요청은 Content-Type application/json을 보낸다", async () => {
    const calls: RequestInit[] = [];
    const fetchImpl: StudyLibraryFetch = async (_url, init) => {
      calls.push(init ?? {});
      return jsonResponse({
        source: {
          sourceKey: "source-a",
          title: "Source A",
          category: "techBlog",
          url: "https://example.com",
          feedUrl: null,
          adapter: "page",
          enabled: true,
          version: 1,
          note: null,
        },
        version: 1,
      });
    };

    await client(fetchImpl).putSource("source-a", {
      title: "Source A",
      category: "techBlog",
      url: "https://example.com",
      feedUrl: null,
      adapter: "page",
      enabled: true,
      expectedVersion: 0,
    });

    const headers = calls[0].headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  test("모든 쓰기 요청은 계약별 Idempotency-Key를 보내고 재시도는 같은 키를 쓴다", async () => {
    const calls: Array<{ url: URL; init: RequestInit }> = [];
    let controlAttempts = 0;
    const fetchImpl: StudyLibraryFetch = async (url, init) => {
      calls.push({ url, init: init ?? {} });
      if (url.pathname.endsWith("/sources/source-a")) return jsonResponse({ source: { sourceKey: "source-a", title: "Source A", category: "techBlog", url: "https://example.com", feedUrl: null, adapter: "page", enabled: true, version: 1, note: null }, version: 1 });
      if (url.pathname.endsWith("/ingestions")) return jsonResponse({ idempotencyKey: "ingestion-key", acceptedCount: 0, cursorVersion: 1 });
      if (url.pathname.endsWith("/recommendation-runs")) return jsonResponse({ reportId: "report-a", historyVersion: 1 });
      if (url.pathname.endsWith("/publications")) return jsonResponse({ publicationId: "publication-a" });
      if (url.pathname.endsWith("/recommendation-control")) {
        controlAttempts += 1;
        if (controlAttempts === 1) return jsonResponse({ error: { code: "UNAVAILABLE", message: "retry", requestId: "control-1" } }, { status: 503 });
        return jsonResponse({ candidateContextVersion: "context-a" });
      }
      throw new Error(`unexpected ${url.pathname}`);
    };
    const library = new StudyLibraryClient({ origin: "http://study.example.com", token: "x".repeat(32), fetchImpl, maxRetries: 1 });
    const source = { title: "Source A", category: "techBlog" as const, url: "https://example.com", feedUrl: null, adapter: "page" as const, enabled: true, expectedVersion: 0 };
    const recommendation = { reportId: "report-a", generatedAt: "2026-09-01T09:00:00.000Z" };

    await library.putSource("source-a", source);
    await library.createIngestion({ idempotencyKey: "ingestion-key", items: [] });
    await library.createRecommendationRun(recommendation);
    await library.createPublication({ idempotencyKey: "publication-key" });
    await library.updateRecommendationControl("context-a");
    await library.updateRecommendationControl("context-a");

    const keys = calls.map(({ init }) => (init.headers as Headers).get("Idempotency-Key"));
    const sourcePayload = JSON.stringify({ adapter: "page", category: "techBlog", enabled: true, expectedVersion: 0, feedUrl: null, title: "Source A", url: "https://example.com" });
    const sourceHash = createHash("sha256").update(`{"payload":${sourcePayload},"sourceKey":"source-a"}`, "utf8").digest("hex");
    const recommendationHash = createHash("sha256").update('{"generatedAt":"2026-09-01T09:00:00.000Z","reportId":"report-a"}', "utf8").digest("hex");
    expect(keys.slice(0, 4)).toEqual([`source:${sourceHash}`, "ingestion-key", `recommendation:${recommendationHash}`, "publication-key"]);
    expect(keys[4]).toBe(keys[5]);
    expect(keys[6]).not.toBe(keys[4]);
  });

  test("소스 응답에서 nullable note가 빠지면 계약 오류로 거부한다", async () => {
    const fetchImpl: StudyLibraryFetch = async () => jsonResponse({ sources: [{ sourceKey: "source-a", title: "Source A", category: "techBlog", url: "https://example.com", feedUrl: null, adapter: "page", enabled: true, version: 1 }] });

    await expect(client(fetchImpl).getSources()).rejects.toThrow("응답 검증 실패");
  });

  test("명시적 연결값과 HTTP/HTTPS origin 규칙을 API 호출 전에 검증한다", () => {
    const fetchImpl: StudyLibraryFetch = async () => jsonResponse({ sources: [] });

    expect(() => new StudyLibraryClient({ origin: "", token: "token", fetchImpl }))
      .toThrow("명시적 origin과 token이 모두 필요하다");
    expect(() => new StudyLibraryClient({ origin: "https://study.example.com", token: "", fetchImpl }))
      .toThrow("명시적 origin과 token이 모두 필요하다");
    expect(() => new StudyLibraryClient({ origin: "http://study.example.com", token: "x".repeat(32), fetchImpl }))
      .not.toThrow();
    expect(() => new StudyLibraryClient({ origin: "https://user:pass@study.example.com", token: "x".repeat(32), fetchImpl }))
      .toThrow("credentials");
    expect(() => new StudyLibraryClient({ origin: "https://study.example.com?x=1", token: "x".repeat(32), fetchImpl }))
      .toThrow("query");
    expect(() => new StudyLibraryClient({ origin: "https://study.example.com#x", token: "x".repeat(32), fetchImpl }))
      .toThrow("hash");
    expect(() => new StudyLibraryClient({ origin: "https://study.example.com/admin", token: "x".repeat(32), fetchImpl }))
      .toThrow("path");
  });

  test("redirect error와 10초 timeout signal을 적용한다", async () => {
    const calls: RequestInit[] = [];
    const fetchImpl: StudyLibraryFetch = async (_url, init) => {
      calls.push(init ?? {});
      return jsonResponse({ sources: [] });
    };

    await client(fetchImpl).getSources();

    expect(calls[0].redirect).toBe("error");
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
  });

  test("네트워크 오류와 5xx는 같은 body로 최대 2회 재시도한다", async () => {
    const bodies: unknown[] = [];
    let count = 0;
    const fetchImpl: StudyLibraryFetch = async (_url, init) => {
      count += 1;
      bodies.push(init?.body);
      if (count === 1) throw new TypeError("network down with secret");
      if (count === 2) return jsonResponse({ error: { code: "UNAVAILABLE", message: "db raw", requestId: "req-5xx" } }, { status: 503 });
      return jsonResponse({ idempotencyKey: "fixed-key", acceptedCount: 1, cursorVersion: 2 });
    };

    const result = await client(fetchImpl).createIngestion({ idempotencyKey: "fixed-key", items: [] });

    expect(result.cursorVersion).toBe(2);
    expect(count).toBe(3);
    expect(new Set(bodies).size).toBe(1);
  });

  test("성공 응답 body stream 읽기에도 timeout을 유지한다", async () => {
    const fetchImpl: StudyLibraryFetch = async (_url, init) => new Response(new ReadableStream({
      start(controller) {
        init.signal?.addEventListener("abort", () => controller.error(new Error("stream secret")));
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const request = new StudyLibraryClient({
      origin: "https://study.example.com",
      token: "test-token-123456789012345678901234567890",
      fetchImpl,
      timeoutMs: 5,
      maxRetries: 0,
    }).getSources();

    const result = await Promise.race([
      request.then(
        () => "resolved",
        (error: unknown) => error
      ),
      wait(30).then(() => "pending"),
    ]);

    expect(result).not.toBe("pending");
    expect(result).toBeInstanceOf(Error);
    expect(String((result as Error).message)).toBe("학습자료 API 네트워크 요청 실패");
    expect(String((result as Error).message)).not.toContain("stream secret");
  });

  test("body read 네트워크 실패도 같은 body로 최대 2회 재시도한다", async () => {
    const bodies: unknown[] = [];
    let count = 0;
    const fetchImpl: StudyLibraryFetch = async (_url, init) => {
      count += 1;
      bodies.push(init.body);
      if (count < 3) {
        return new Response(new ReadableStream({
          start(controller) {
            controller.error(new Error("read failed with private body"));
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return jsonResponse({ idempotencyKey: "fixed-key", acceptedCount: 1, cursorVersion: 2 });
    };

    const result = await client(fetchImpl).createIngestion({ idempotencyKey: "fixed-key", items: [] });

    expect(result.acceptedCount).toBe(1);
    expect(count).toBe(3);
    expect(new Set(bodies).size).toBe(1);
  });

  test("5xx 재시도 전에 응답 body를 취소한다", async () => {
    let count = 0;
    let cancelled = 0;
    const fetchImpl: StudyLibraryFetch = async () => {
      count += 1;
      if (count === 1) {
        return new Response(new ReadableStream({
          cancel() {
            cancelled += 1;
          },
        }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      return jsonResponse({ sources: [] });
    };

    await new StudyLibraryClient({
      origin: "https://study.example.com",
      token: "test-token-123456789012345678901234567890",
      fetchImpl,
      maxRetries: 1,
    }).getSources();

    expect(cancelled).toBe(1);
  });

  test("4xx 응답은 재시도하지 않고 code와 requestId를 보존한다", async () => {
    let count = 0;
    const fetchImpl: StudyLibraryFetch = async () => {
      count += 1;
      return jsonResponse({
        error: {
          code: "UNAUTHENTICATED",
          message: "server raw auth message",
          requestId: "req-401",
        },
      }, { status: 401 });
    };

    await expect(client(fetchImpl).getSources()).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
      requestId: "req-401",
    });
    expect(count).toBe(1);
  });

  test("계약에 명시된 JSON 오류 응답의 code와 requestId를 보존한다", async () => {
    for (const status of [401, 403, 409, 413, 429, 503]) {
      const fetchImpl: StudyLibraryFetch = async () => jsonResponse({
        error: {
          code: `CODE_${status}`,
          message: `server message ${status}`,
          requestId: `req-${status}`,
        },
      }, { status });

      await expect(client(fetchImpl).getSources()).rejects.toMatchObject({
        status,
        code: `CODE_${status}`,
        requestId: `req-${status}`,
      });
    }
  });

  test("429 응답의 유효한 Retry-After 초만 retryAfter로 보존한다", async () => {
    const validFetch: StudyLibraryFetch = async () => jsonResponse({
      error: {
        code: "RATE_LIMITED",
        message: "wait raw",
        requestId: "req-429-valid",
      },
    }, { status: 429, headers: { "Retry-After": "12" } });

    await expect(client(validFetch).getSources()).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      requestId: "req-429-valid",
      retryAfter: 12,
    });

    let invalidError: unknown;
    const invalidFetch: StudyLibraryFetch = async () => jsonResponse({
      error: {
        code: "RATE_LIMITED",
        message: "wait raw invalid",
        requestId: "req-429-invalid",
      },
    }, { status: 429, headers: { "Retry-After": "soon-private" } });
    try {
      await client(invalidFetch).getSources();
    } catch (error) {
      invalidError = error;
    }

    expect(invalidError).toBeInstanceOf(StudyLibraryApiError);
    expect((invalidError as StudyLibraryApiError).retryAfter).toBeUndefined();
    expect(String((invalidError as Error).message)).not.toContain("soon-private");
  });

  test("성공 응답은 schema를 통과해야 반환된다", async () => {
    const fetchImpl: StudyLibraryFetch = async () => jsonResponse({
      candidates: [{
        id: "content-1",
        contentKey: "content-1",
        canonicalUrl: "https://example.com/post",
        sourceKey: "source-a",
        sourceName: "Source A",
        category: "techBlog",
        title: "Title",
        url: "https://example.com/post",
        published: "",
        kind: "page-link",
        previouslyRecommended: false,
      }],
      recentStudyTopicKeys: [],
      nextCursor: null,
      historyVersion: 0,
      candidateContextVersion: "context-0",
    });

    const page = await client(fetchImpl).getCandidates();

    expect(page.candidates[0].id).toBe("content-1");
    expect(page.candidates[0].contentKey).toBe("content-1");
  });

  test("성공 응답 schema가 맞지 않으면 실패한다", async () => {
    const fetchImpl: StudyLibraryFetch = async () => jsonResponse({
      candidates: [{
        id: "candidate-id",
        contentKey: "content-1",
        canonicalUrl: "https://example.com/post",
        sourceKey: "source-a",
        sourceName: "Source A",
        category: "techBlog",
        title: "Title",
        url: "https://example.com/post",
        published: "",
        kind: "page-link",
        previouslyRecommended: false,
      }],
      recentStudyTopicKeys: [],
      nextCursor: null,
      historyVersion: 0,
    });

    await expect(client(fetchImpl).getCandidates()).rejects.toThrow("응답 검증 실패");
  });

  test("malformed JSON은 원문을 노출하지 않는 고정 오류로 실패한다", async () => {
    let count = 0;
    const fetchImpl: StudyLibraryFetch = async () => {
      count += 1;
      return new Response("not-json-private-token", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    let thrown: unknown;
    try {
      await client(fetchImpl).getSources();
    } catch (error) {
      thrown = error;
    }

    expect(count).toBe(1);
    expect(thrown).toBeInstanceOf(Error);
    expect(String((thrown as Error).message)).toBe("학습자료 API JSON 응답 파싱 실패");
    expect(String((thrown as Error).message)).not.toContain("not-json-private-token");
  });

  test("오류 메시지에 token과 요청 body 문자열과 서버 message를 넣지 않는다", async () => {
    const body = { idempotencyKey: "same-key", secretMemo: "private-note" };
    const fetchImpl: StudyLibraryFetch = async () => jsonResponse({
      error: {
        code: "VERSION_CONFLICT",
        message: "server message with private-note and test-token-123456789012345678901234567890",
        requestId: "req-409",
      },
    }, { status: 409 });

    let thrown: unknown;
    try {
      await client(fetchImpl).createIngestion(body);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(StudyLibraryApiError);
    expect(String((thrown as Error).message)).not.toContain("test-token");
    expect(String((thrown as Error).message)).not.toContain("private-note");
    expect(String((thrown as Error).message)).not.toContain("server message");
    expect(String((thrown as Error).message)).toContain("VERSION_CONFLICT");
    expect(String((thrown as Error).message)).toContain("req-409");
  });
});
