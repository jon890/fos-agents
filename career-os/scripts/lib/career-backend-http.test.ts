import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { CareerBackendHttpError, careerBackendRequest } from "./career-backend-http.ts";

const token = "test-token-123456789012345678901234567890";
const schema = z.object({ ok: z.literal(true) });

function request(fetcher: (input: URL, init: RequestInit) => Promise<Response>) {
  return careerBackendRequest(
    { baseUrl: "https://career.example.com", token, fetcher },
    "POST",
    "/api/test",
    { private: "request-body" },
    "test-key",
    schema,
  );
}

describe("careerBackendRequest", () => {
  test("5xx 재시도 전 응답 본문을 취소하고 redirect를 거절한다", async () => {
    let calls = 0;
    let cancelled = 0;
    await expect(request(async (_url, init) => {
      calls += 1;
      expect(init.redirect).toBe("error");
      if (calls === 1) {
        return new Response(new ReadableStream({ cancel: () => { cancelled += 1; } }), { status: 503 });
      }
      return Response.json({ ok: true });
    })).resolves.toEqual({ ok: true });
    expect(calls).toBe(2);
    expect(cancelled).toBe(1);
  });

  test("실제 3xx 응답을 따라가지 않고 요청을 실패로 처리한다", async () => {
    let redirectRequests = 0;
    let successRequests = 0;
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname === "/redirect") {
          redirectRequests += 1;
          return new Response(null, { status: 302, headers: { Location: "/success" } });
        }
        successRequests += 1;
        return Response.json({ ok: true });
      },
    });
    try {
      await expect(careerBackendRequest(
        { baseUrl: `http://127.0.0.1:${server.port}`, token },
        "GET",
        "/redirect",
        undefined,
        undefined,
        schema,
      )).rejects.toMatchObject({ code: "NETWORK_ERROR", status: null });
      expect(redirectRequests).toBe(3);
      expect(successRequests).toBe(0);
    } finally {
      await server.stop(true);
    }
  });

  test("오류 응답의 requestId와 유효한 Retry-After만 보존한다", async () => {
    const fetcher = async (_url: URL, _init: RequestInit) => Response.json(
      { error: { code: "RATE_LIMITED", message: "server secret", requestId: "req-429" } },
      { status: 429, headers: { "Retry-After": "12" } },
    );
    await expect(request(fetcher)).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      requestId: "req-429",
      retryAfter: 12,
    });

    try {
      await request(async () => Response.json(
        { error: { code: "RATE_LIMITED", message: "server secret" } },
        { status: 429, headers: { "Retry-After": "invalid" } },
      ));
      throw new Error("expected request failure");
    } catch (error) {
      expect(error).toBeInstanceOf(CareerBackendHttpError);
      expect((error as CareerBackendHttpError).retryAfter).toBeUndefined();
    }
  });

  test("오류 메시지에 token, 요청 본문, 서버 message를 넣지 않는다", async () => {
    let thrown: unknown;
    try {
      await request(async () => Response.json(
        { error: { code: "CONFLICT", message: `${token}:request-body:server secret` } },
        { status: 409 },
      ));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CareerBackendHttpError);
    expect(String((thrown as Error).message)).not.toContain(token);
    expect(String((thrown as Error).message)).not.toContain("request-body");
    expect(String((thrown as Error).message)).not.toContain("server secret");
  });
});
