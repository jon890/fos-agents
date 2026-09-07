import { describe, expect, test } from "bun:test";
import { StudyLibraryApiError, StudyLibraryClient, type StudyLibraryFetch } from "./client.js";
import { buildSourceSyncRequests } from "./source-sync.js";

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

  test("환경값 누락과 HTTPS origin이 아닌 URL을 API 호출 전에 거부한다", () => {
    const fetchImpl: StudyLibraryFetch = async () => jsonResponse({ sources: [] });

    expect(() => new StudyLibraryClient({ origin: "", token: "token", fetchImpl }))
      .toThrow("STUDY_LIBRARY_URL 환경값이 필요하다");
    expect(() => new StudyLibraryClient({ origin: "https://study.example.com", token: "", fetchImpl }))
      .toThrow("STUDY_SERVICE_TOKEN 환경값이 필요하다");
    expect(() => new StudyLibraryClient({ origin: "http://study.example.com", token: "token", fetchImpl }))
      .toThrow("HTTPS origin");
    expect(() => new StudyLibraryClient({ origin: "https://user:pass@study.example.com", token: "token", fetchImpl }))
      .toThrow("credentials");
    expect(() => new StudyLibraryClient({ origin: "https://study.example.com?x=1", token: "token", fetchImpl }))
      .toThrow("query");
    expect(() => new StudyLibraryClient({ origin: "https://study.example.com#x", token: "token", fetchImpl }))
      .toThrow("hash");
    expect(() => new StudyLibraryClient({ origin: "https://study.example.com/admin", token: "token", fetchImpl }))
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

describe("source-sync", () => {
  test("누락 URL을 null로 보내고 새 소스 expectedVersion을 0으로 둔다", () => {
    const requests = buildSourceSyncRequests({
      config: {
        _meta: {
          purpose: "테스트",
          schemaVersion: 6,
        },
        sources: [{
          key: "page-only",
          title: "Page Only",
          category: "geek",
          url: "https://example.com",
          enabled: false,
          adapter: "page",
        }],
      },
      serverSources: [],
    });

    expect(requests).toEqual([{
      sourceKey: "page-only",
      body: {
        title: "Page Only",
        category: "geek",
        url: "https://example.com",
        feedUrl: null,
        adapter: "page",
        enabled: false,
        expectedVersion: 0,
      },
    }]);
  });

  test("기존 소스는 서버 version을 expectedVersion으로 사용한다", () => {
    const requests = buildSourceSyncRequests({
      config: {
        _meta: {
          purpose: "테스트",
          schemaVersion: 6,
        },
        sources: [{
          key: "feed-source",
          title: "Feed Source",
          category: "ai",
          feedUrl: "https://example.com/feed.xml",
          adapter: "feed",
        }],
      },
      serverSources: [{
        sourceKey: "feed-source",
        title: "Old",
        category: "ai",
        url: null,
        feedUrl: "https://example.com/feed.xml",
        adapter: "feed",
        enabled: true,
        version: 7,
      }],
    });

    expect(requests[0].body.expectedVersion).toBe(7);
    expect(requests[0].body.url).toBeNull();
    expect(requests[0].body.enabled).toBe(true);
  });

  test("알 수 없는 category, adapter, 중복 key는 기존 설정 검증 실패로 처리한다", () => {
    expect(() => buildSourceSyncRequests({
      config: {
        _meta: {
          purpose: "테스트",
          schemaVersion: 6,
        },
        sources: [
          { key: "dup", title: "A", category: "wrong", url: "https://example.com", adapter: "page" },
          { key: "dup", title: "B", category: "geek", url: "https://example.com", adapter: "unknown" },
        ],
      },
      serverSources: [],
    })).toThrow("외부 읽을거리 설정 오류");
  });
});
