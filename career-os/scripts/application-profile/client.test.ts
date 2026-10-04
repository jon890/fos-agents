import { describe, expect, test } from "bun:test";
import {
  ApplicationProfileHttpError,
  readApplicationProfile,
  resolveFosAssistantConnection,
  type ApplicationProfileFetch,
} from "./client.ts";

const token = "test-service-token-0001";
const connection = { baseUrl: "https://assistant.example.com", token };
const content = "이름: 예시 사람\n연락처: 010-0000-0000";
const profile = {
  collection: "identity" as const,
  documentKey: "career-application-profile" as const,
  title: "예시 지원서 프로필",
  content,
  revision: 7,
  updatedAt: "2026-09-01T00:00:00Z",
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

/** 응답을 차례로 돌려주는 fetch 대역이다. 받은 요청을 기록한다. */
function sequence(...steps: Array<() => Response | Promise<Response>>) {
  const calls: Array<{ url: URL; init: RequestInit }> = [];
  const fetchImpl: ApplicationProfileFetch = async (url, init) => {
    calls.push({ url, init });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    return step();
  };
  return { calls, fetchImpl };
}

async function failure(fetchImpl: ApplicationProfileFetch, maxRetries = 0): Promise<ApplicationProfileHttpError> {
  try {
    await readApplicationProfile({ connection, fetchImpl, maxRetries });
  } catch (error) {
    expect(error).toBeInstanceOf(ApplicationProfileHttpError);
    const httpError = error as ApplicationProfileHttpError;
    // 어떤 실패든 오류 메시지에 토큰과 문서 본문이 새지 않아야 한다.
    expect(httpError.message).not.toContain(token);
    expect(httpError.message).not.toContain(content);
    expect(httpError.message).not.toContain("010-0000-0000");
    return httpError;
  }
  throw new Error("readApplicationProfile 이 실패해야 한다.");
}

describe("readApplicationProfile", () => {
  test("서비스 읽기 경로에 Bearer 토큰만 붙여 GET 하고 문서와 토큰 만료 시각을 돌려준다", async () => {
    const { calls, fetchImpl } = sequence(() =>
      jsonResponse({ ...profile, extra: "버리는 칸" }, 200, { "X-Service-Token-Expires-At": "2027-01-01T00:00:00Z" }),
    );

    const result = await readApplicationProfile({ connection, fetchImpl });

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    const headers = init.headers as Headers;
    expect(url.origin).toBe("https://assistant.example.com");
    expect(url.pathname).toBe("/api/v1/service/memory-documents/identity/career-application-profile");
    expect(init.method).toBe("GET");
    expect(headers.get("Authorization")).toBe(`Bearer ${token}`);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.has("Origin")).toBe(false);
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(result.document).toEqual(profile);
    expect(result.document.revision).toBe(7);
    expect(result.tokenExpiresAt).toBe("2027-01-01T00:00:00Z");
  });

  test("만료 머리말이 없으면 tokenExpiresAt 은 null 이다", async () => {
    const { fetchImpl } = sequence(() => jsonResponse(profile));

    expect((await readApplicationProfile({ connection, fetchImpl })).tokenExpiresAt).toBeNull();
  });

  test("401 은 다시 시도하지 않고 UNAUTHORIZED 로 던진다", async () => {
    const { calls, fetchImpl } = sequence(() => new Response(null, { status: 401 }));

    const error = await failure(fetchImpl, 2);

    expect(error).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(error.message).toContain("FOS_ASSISTANT_SERVICE_TOKEN");
    expect(calls).toHaveLength(1);
  });

  test("403 은 FORBIDDEN 으로 던진다", async () => {
    const { fetchImpl } = sequence(() => new Response(null, { status: 403 }));

    expect(await failure(fetchImpl)).toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  test("404 는 응답 code 를 쓰고 서버 message 를 오류에 담지 않는다", async () => {
    const serverMessage = "지어낸 서버 문구 identity 비공개 안내";
    const { fetchImpl } = sequence(() => jsonResponse({ code: "MEMORY_NOT_FOUND", message: serverMessage }, 404));

    const error = await failure(fetchImpl);

    expect(error).toMatchObject({ status: 404, code: "MEMORY_NOT_FOUND" });
    expect(error.message).not.toContain(serverMessage);
  });

  test("404 본문이 없으면 MEMORY_NOT_FOUND 로 둔다", async () => {
    const { fetchImpl } = sequence(() => new Response(null, { status: 404 }));

    expect(await failure(fetchImpl)).toMatchObject({ status: 404, code: "MEMORY_NOT_FOUND" });
  });

  test("409 MEMORY_ENCRYPTION_UNAVAILABLE 은 그 code 로 던진다", async () => {
    const { fetchImpl } = sequence(() => jsonResponse({ code: "MEMORY_ENCRYPTION_UNAVAILABLE", message: "지어낸 문구" }, 409));

    const error = await failure(fetchImpl);

    expect(error).toMatchObject({ status: 409, code: "MEMORY_ENCRYPTION_UNAVAILABLE" });
    expect(error.message).toContain("운영자");
  });

  test("그 밖의 4xx 는 응답 code 가 없으면 HTTP_ERROR 다", async () => {
    const { calls, fetchImpl } = sequence(() => new Response("<html>오류</html>", { status: 400 }));

    const error = await failure(fetchImpl, 2);

    expect(error).toMatchObject({ status: 400, code: "HTTP_ERROR", message: "fos-assistant 요청이 실패했다." });
    expect(calls).toHaveLength(1);
  });

  test("503 두 번 뒤 200 이면 maxRetries 2 안에서 성공한다", async () => {
    const { calls, fetchImpl } = sequence(
      () => new Response("일시 오류", { status: 503 }),
      () => new Response("일시 오류", { status: 503 }),
      () => jsonResponse(profile),
    );

    const result = await readApplicationProfile({ connection, fetchImpl, maxRetries: 2 });

    expect(result.document.content).toBe(content);
    expect(calls).toHaveLength(3);
  });

  test("503 이 maxRetries 를 넘기면 HTTP_ERROR 로 던진다", async () => {
    const { calls, fetchImpl } = sequence(() => new Response("일시 오류", { status: 503 }));

    expect(await failure(fetchImpl, 2)).toMatchObject({ status: 503, code: "HTTP_ERROR" });
    expect(calls).toHaveLength(3);
  });

  test("연결 실패는 NETWORK_ERROR 이고 status 는 null 이다", async () => {
    const { calls, fetchImpl } = sequence(() => {
      throw new TypeError(`fetch failed for ${token}`);
    });

    expect(await failure(fetchImpl, 0)).toMatchObject({ status: null, code: "NETWORK_ERROR" });
    expect(calls).toHaveLength(1);
  });

  test("첫 시도가 timeout 이고 두 번째가 200 이면 성공한다", async () => {
    const { calls, fetchImpl } = sequence(
      () => {
        throw new DOMException("지어낸 시간 초과", "TimeoutError");
      },
      () => jsonResponse(profile),
    );

    const result = await readApplicationProfile({ connection, fetchImpl, maxRetries: 2 });

    expect(result.document.revision).toBe(7);
    expect(calls).toHaveLength(2);
  });

  test("200 본문 스트림이 끊기면 연결 실패로 보고 다시 시도한다", async () => {
    const brokenBody = () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error("지어낸 스트림 끊김"));
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const { calls, fetchImpl } = sequence(brokenBody, () => jsonResponse(profile));

    const result = await readApplicationProfile({ connection, fetchImpl, maxRetries: 2 });

    expect(result.document.documentKey).toBe("career-application-profile");
    expect(calls).toHaveLength(2);
  });

  test("200 인데 documentKey 가 다르면 다시 시도하지 않고 INVALID_RESPONSE 다", async () => {
    const { calls, fetchImpl } = sequence(() => jsonResponse({ ...profile, documentKey: "other-doc" }));

    expect(await failure(fetchImpl, 2)).toMatchObject({ status: 200, code: "INVALID_RESPONSE" });
    expect(calls).toHaveLength(1);
  });

  test("200 인데 본문이 JSON 이 아니면 INVALID_RESPONSE 다", async () => {
    const { calls, fetchImpl } = sequence(() => new Response(content, { status: 200 }));

    expect(await failure(fetchImpl, 2)).toMatchObject({ status: 200, code: "INVALID_RESPONSE" });
    expect(calls).toHaveLength(1);
  });
});

describe("resolveFosAssistantConnection", () => {
  test("URL 과 토큰을 읽어 origin 과 trim 한 토큰을 돌려준다", () => {
    expect(
      resolveFosAssistantConnection({ FOS_ASSISTANT_URL: "https://assistant.example.com", FOS_ASSISTANT_SERVICE_TOKEN: ` ${token} ` }),
    ).toEqual({ baseUrl: "https://assistant.example.com", token });
  });

  test("URL 이 없으면 FOS_ASSISTANT_URL 을 말한다", () => {
    expect(() => resolveFosAssistantConnection({})).toThrow("FOS_ASSISTANT_URL 환경값이 필요하다");
  });

  test("path 가 있는 URL 은 origin 규칙으로 거절한다", () => {
    expect(() =>
      resolveFosAssistantConnection({ FOS_ASSISTANT_URL: "https://assistant.example.com/api", FOS_ASSISTANT_SERVICE_TOKEN: token }),
    ).toThrow("FOS_ASSISTANT_URL은 credentials, query, hash, path 없는 HTTP 또는 HTTPS origin이어야 한다.");
  });

  test("토큰이 공백뿐이면 FOS_ASSISTANT_SERVICE_TOKEN 을 말한다", () => {
    expect(() =>
      resolveFosAssistantConnection({ FOS_ASSISTANT_URL: "https://assistant.example.com", FOS_ASSISTANT_SERVICE_TOKEN: "  " }),
    ).toThrow("FOS_ASSISTANT_SERVICE_TOKEN 환경값이 필요하다");
  });
});
