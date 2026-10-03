import { describe, expect, test } from "bun:test";
import { CareerBackend, type FetchLike } from "./backend.ts";
import { CareerTools } from "./tools.ts";

const baseUrl = "https://career.example.com/";
const token = "x".repeat(40);

type Call = { url: string; init: RequestInit | undefined };

function harness(respond: (url: string) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push({ url: String(input), init });
    return respond(String(input));
  };
  return { calls, tools: new CareerTools(new CareerBackend({ baseUrl, token }, fetchImpl)) };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const parse = (result: { content: [{ text: string }] }) => JSON.parse(result.content[0].text);

const summary = (documentKey: string) => ({ documentKey, version: 3, updatedAt: "2026-09-01T00:00:00.000Z" });
const document = (documentKey: string) => ({ ...summary(documentKey), body: "# 본문", note: "메모" });
const snapshot = {
  month: "2026-08",
  claudeTokens: 1_000,
  codexTokens: 2_000,
  claudeCostUsd: 1.5,
  codexCostUsd: null,
  sessions: 4,
  unpricedTokens: 0,
  measuredOn: "2026-09-01",
  source: "MEASURED",
  note: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const cases = [
  {
    name: "check_connection",
    args: {},
    path: "/api/profile/v1/documents",
    body: { documents: [summary("wanted")] },
    expected: { backend: "ok" },
  },
  {
    name: "list_context_documents",
    args: {},
    path: "/api/candidate-context/v1/documents",
    body: { documents: [summary("career-status")] },
    expected: { documents: [summary("career-status")] },
  },
  {
    name: "get_context_document",
    args: { documentKey: "career-status" },
    path: "/api/candidate-context/v1/documents/career-status",
    body: { document: document("career-status") },
    expected: { document: document("career-status") },
  },
  {
    name: "list_profile_documents",
    args: {},
    path: "/api/profile/v1/documents",
    body: { documents: [summary("linkedin")] },
    expected: { documents: [summary("linkedin")] },
  },
  {
    name: "get_profile_document",
    args: { documentKey: "wanted" },
    path: "/api/profile/v1/documents/wanted",
    body: { document: document("wanted") },
    expected: { document: document("wanted") },
  },
  {
    name: "list_usage_snapshots",
    args: {},
    path: "/api/profile/v1/usage-snapshots",
    body: { snapshots: [snapshot] },
    expected: { snapshots: [snapshot] },
  },
];

describe("읽기 도구는 Backend 에 GET 하나를 보내고 응답을 그대로 낸다", () => {
  for (const c of cases) {
    test(c.name, async () => {
      const { calls, tools } = harness(() => json(c.body));
      const result = await tools.call(c.name, c.args);
      expect(result.isError).toBeUndefined();
      expect(parse(result)).toEqual(c.expected);
      expect(calls).toHaveLength(1);
      const call = calls[0]!;
      expect(call.url).toBe(`https://career.example.com${c.path}`);
      expect(call.init?.method).toBe("GET");
      expect(call.init?.redirect).toBe("error");
      const headers = call.init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${token}`);
      expect(headers.Accept).toBe("application/json");
      expect(headers["Content-Type"]).toBeUndefined();
    });
  }

  test("check_connection 은 같은 값을 structuredContent 에도 싣는다", async () => {
    const { tools } = harness(() => json({ documents: [] }));
    const result = await tools.call("check_connection", {});
    expect(result.structuredContent).toEqual({ backend: "ok" });
  });
});

describe("입력 검증은 fetch 를 부르기 전에 막는다", () => {
  const rejected = [
    ["get_context_document", { documentKey: "wanted" }],
    ["get_profile_document", { documentKey: "career-status" }],
    ["get_profile_document", {}],
    ["list_profile_documents", { extra: true }],
    ["get_context_document", { documentKey: "career-status", extra: 1 }],
  ] as const;
  for (const [name, args] of rejected) {
    test(`${name} ${JSON.stringify(args)}`, async () => {
      const { calls, tools } = harness(() => json({}));
      const result = await tools.call(name, args);
      expect(result.isError).toBe(true);
      expect(parse(result).error.code).toBe("CAREER_INVALID_INPUT");
      expect(calls).toHaveLength(0);
    });
  }

  test("모르는 도구는 CAREER_UNKNOWN_TOOL 이다", async () => {
    const { calls, tools } = harness(() => json({}));
    const result = await tools.call("delete_everything", {});
    expect(parse(result).error.code).toBe("CAREER_UNKNOWN_TOOL");
    expect(calls).toHaveLength(0);
  });
});

describe("Backend 실패를 고정 오류 코드로 바꾼다", () => {
  const backendError = (status: number) =>
    json({ error: { code: "SECRET_CODE", message: "backend-said-secret", requestId: "r-1" } }, status);
  const statuses = [
    [401, "CAREER_UNAUTHORIZED"],
    [403, "CAREER_UNAUTHORIZED"],
    [404, "CAREER_NOT_FOUND"],
    [409, "CAREER_VERSION_CONFLICT"],
    [400, "CAREER_BAD_REQUEST"],
    [500, "CAREER_UNAVAILABLE"],
    [503, "CAREER_UNAVAILABLE"],
  ] as const;
  for (const [status, code] of statuses) {
    test(`${status} 은 ${code} 이고 다시 보내지 않는다`, async () => {
      const { calls, tools } = harness(() => backendError(status));
      const result = await tools.call("get_profile_document", { documentKey: "github" });
      expect(result.isError).toBe(true);
      expect(parse(result).error.code).toBe(code);
      expect(calls).toHaveLength(1);
      expect(result.content[0].text).not.toContain(token);
      expect(result.content[0].text).not.toContain("backend-said-secret");
      expect(result.content[0].text).not.toContain("SECRET_CODE");
    });
  }

  test("fetch 가 던지면 CAREER_NETWORK 이고 원래 예외를 싣지 않는다", async () => {
    const { tools } = harness(() => {
      throw new Error(`connect failed with ${token}`);
    });
    const result = await tools.call("list_context_documents", {});
    expect(parse(result).error.code).toBe("CAREER_NETWORK");
    expect(result.content[0].text).not.toContain(token);
  });

  const malformed = [
    ["빈 객체", () => json({})],
    ["documents 가 문자열", () => json({ documents: "x" })],
    ["JSON 이 아닌 본문", () => new Response("not json", { status: 200 })],
    ["모르는 문서 키", () => json({ documents: [summary("resume")] })],
  ] as const;
  for (const [label, respond] of malformed) {
    test(`성공 상태의 ${label} 는 CAREER_INVALID_RESPONSE 다`, async () => {
      const { tools } = harness(respond);
      const result = await tools.call("list_profile_documents", {});
      expect(parse(result).error.code).toBe("CAREER_INVALID_RESPONSE");
    });
  }
});
