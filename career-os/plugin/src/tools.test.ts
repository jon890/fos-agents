import { describe, expect, test } from "bun:test";
import { formatBillions, renderUsageChart, selectUsageBars } from "../../scripts/agent-usage/chart.ts";
import { CareerBackend, type FetchLike } from "./backend.ts";
import { GithubProfileRepo } from "./github.ts";
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
    expected: { backend: "ok", github: "not_configured" },
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
    expect(result.structuredContent).toEqual({ backend: "ok", github: "not_configured" });
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

describe("저장 도구는 Backend 에 PUT 하나를 보내고 요약만 낸다", () => {
  const saves = [
    {
      name: "save_context_document",
      documentKey: "career-status",
      path: "/api/candidate-context/v1/documents/career-status",
      keyPrefix: "candidate-context:",
    },
    {
      name: "save_profile_document",
      documentKey: "github",
      path: "/api/profile/v1/documents/github",
      keyPrefix: "profile-document:",
    },
  ] as const;
  const secretBody = "# 저장할 본문 secret-body-text";
  const argsFor = (documentKey: string, overrides: Record<string, unknown> = {}) => ({
    documentKey,
    body: secretBody,
    note: "  경력 갱신  ",
    expectedVersion: 3,
    ...overrides,
  });
  const headerOf = (call: Call) => (call.init?.headers as Record<string, string>)["Idempotency-Key"];

  for (const s of saves) {
    describe(s.name, () => {
      test("PUT 경로와 본문 셋, 공백을 뗀 note 를 보내고 본문 없는 요약을 낸다", async () => {
        const { calls, tools } = harness(() => json({ document: summary(s.documentKey) }));
        const result = await tools.call(s.name, argsFor(s.documentKey));
        expect(result.isError).toBeUndefined();
        expect(parse(result)).toEqual({ document: summary(s.documentKey) });
        expect(result.content[0].text).not.toContain(secretBody);
        expect(calls).toHaveLength(1);
        const call = calls[0]!;
        expect(call.url).toBe(`https://career.example.com${s.path}`);
        expect(call.init?.method).toBe("PUT");
        expect(JSON.parse(String(call.init?.body))).toEqual({
          body: secretBody,
          note: "경력 갱신",
          expectedVersion: 3,
        });
        const headers = call.init?.headers as Record<string, string>;
        expect(headers["Content-Type"]).toBe("application/json");
        expect(headers["Idempotency-Key"]).toMatch(new RegExp(`^${s.keyPrefix}[0-9a-f]{64}$`));
      });

      test("Idempotency-Key 는 같은 인자면 같고 body 한 글자가 다르면 다르다", async () => {
        const { calls, tools } = harness(() => json({ document: summary(s.documentKey) }));
        await tools.call(s.name, argsFor(s.documentKey));
        await tools.call(s.name, argsFor(s.documentKey));
        await tools.call(s.name, argsFor(s.documentKey, { body: `${secretBody}!` }));
        expect(calls).toHaveLength(3);
        const [first, second, changed] = calls.map(headerOf);
        expect(second).toBe(first!);
        expect(changed).not.toBe(first!);
      });

      test("409 는 CAREER_VERSION_CONFLICT 이고 다시 보내지 않는다", async () => {
        const { calls, tools } = harness(() => json({ error: { code: "VERSION_CONFLICT" } }, 409));
        const result = await tools.call(s.name, argsFor(s.documentKey));
        expect(parse(result).error.code).toBe("CAREER_VERSION_CONFLICT");
        expect(calls).toHaveLength(1);
      });

      test("fetch 가 던지면 CAREER_NETWORK 이고 다시 보내지 않는다", async () => {
        const { calls, tools } = harness(() => {
          throw new Error("socket hang up");
        });
        const result = await tools.call(s.name, argsFor(s.documentKey));
        expect(parse(result).error.code).toBe("CAREER_NETWORK");
        expect(calls).toHaveLength(1);
        expect(result.content[0].text).not.toContain(secretBody);
      });

      const invalid = [
        ["body 가 공백뿐", { body: " \n\t " }],
        ["body 가 65,537바이트", { body: "a".repeat(65_537) }],
        ["note 가 501자", { note: "가".repeat(501) }],
        ["expectedVersion 이 -1", { expectedVersion: -1 }],
        ["expectedVersion 이 1.5", { expectedVersion: 1.5 }],
        ["모르는 키 version", { version: 3 }],
      ] as const;
      for (const [label, overrides] of invalid) {
        test(`${label} 이면 fetch 없이 CAREER_INVALID_INPUT 이다`, async () => {
          const { calls, tools } = harness(() => json({ document: summary(s.documentKey) }));
          const result = await tools.call(s.name, argsFor(s.documentKey, overrides));
          expect(parse(result).error.code).toBe("CAREER_INVALID_INPUT");
          expect(calls).toHaveLength(0);
        });
      }

      test("body 가 정확히 65,536바이트면 보낸다", async () => {
        const { calls, tools } = harness(() => json({ document: summary(s.documentKey) }));
        // "가" is 3 bytes in UTF-8: 21,845 * 3 + 1 = 65,536.
        const result = await tools.call(s.name, argsFor(s.documentKey, { body: `${"가".repeat(21_845)}a` }));
        expect(result.isError).toBeUndefined();
        expect(calls).toHaveLength(1);
      });
    });
  }

  test("save_context_document 에 프로필 키 github 를 주면 fetch 없이 CAREER_INVALID_INPUT 이다", async () => {
    const { calls, tools } = harness(() => json({ document: summary("github") }));
    const result = await tools.call("save_context_document", argsFor("github"));
    expect(parse(result).error.code).toBe("CAREER_INVALID_INPUT");
    expect(calls).toHaveLength(0);
  });
});

describe("GitHub 프로필 도구", () => {
  const githubToken = "g".repeat(40);
  const repo = "octo-example/octo-example";
  const gh = `https://api.github.com/repos/${repo}`;
  const usage = (month: string, claudeTokens: number, codexTokens: number) => ({
    ...snapshot,
    month,
    claudeTokens,
    codexTokens,
  });
  // 2031-01 is 5 + 3 tenths and 2031-02 is 30 + 10 tenths: 48 tenths, written 4.8B.
  const records = [usage("2031-02", 3_000_000_000, 1_049_999_999), usage("2031-01", 500_000_000, 260_000_000)];
  const badge = (value: string) => `# 프로필\n\n![Tokens](https://img.shields.io/badge/Tokens-${value}-26d0ce)\n`;
  const readme = badge("4.8B");
  // Fake SHAs only. headA is what get_github_profile returned when the draft was reviewed.
  const headA = "a".repeat(40);
  const headB = "b".repeat(40);
  const reviewed = { expectedBranch: "main", expectedHead: headA };

  type GhCall = { method: string; url: string; init: RequestInit | undefined; body: any };

  function connected(
    options: { github?: boolean; githubStatus?: number; snapshots?: unknown[]; head?: string } = {},
  ) {
    const head = options.head ?? headA;
    const calls: GhCall[] = [];
    const fetchImpl: FetchLike = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body === undefined ? undefined : JSON.parse(String(init.body));
      calls.push({ method, url, init, body });
      if (new URL(url).host === "career.example.com") {
        if (url.endsWith("/api/profile/v1/usage-snapshots")) return json({ snapshots: options.snapshots ?? records });
        return json({ documents: [summary("github")] });
      }
      if (options.githubStatus) return json({ message: "denied" }, options.githubStatus);
      const key = `${method} ${url.slice(gh.length)}`;
      switch (key) {
        case "GET ":
          return json({ default_branch: "main" });
        case `GET /contents/README.md?ref=${head}`:
          return json({ content: Buffer.from(readme, "utf8").toString("base64"), encoding: "base64" });
        case `GET /contents/agent-usage.svg?ref=${head}`:
          return json({ message: "Not Found" }, 404);
        case "GET /git/ref/heads/main":
          return json({ object: { sha: head } });
        case `GET /git/commits/${head}`:
          return json({ tree: { sha: "base-tree-sha" } });
        case "POST /git/blobs":
          return json({ sha: `blob-${calls.length}` }, 201);
        case "POST /git/trees":
          return json({ sha: "new-tree-sha" }, 201);
        case "POST /git/commits":
          return json({ sha: "new-commit-sha" }, 201);
        case "PATCH /git/refs/heads/main":
          return json({ object: { sha: "new-commit-sha" } });
      }
      throw new Error(`unexpected request ${method} ${url}`);
    };
    const backend = new CareerBackend({ baseUrl, token }, fetchImpl);
    const github = options.github === false ? undefined : new GithubProfileRepo({ token: githubToken, repo }, fetchImpl);
    return { calls, tools: new CareerTools(backend, github) };
  }

  const githubCalls = (calls: GhCall[]) => calls.filter((call) => new URL(call.url).host === "api.github.com");
  const authOf = (call: GhCall) => (call.init?.headers as Record<string, string>).Authorization;

  test("update_github_profile 은 기록에서 그린 차트와 받은 README 를 올리고 합계와 달을 낸다", async () => {
    const { calls, tools } = connected();
    const result = await tools.call("update_github_profile", { readme, months: ["2031-02", "2031-01"], ...reviewed });
    expect(result.isError).toBeUndefined();
    expect(parse(result)).toEqual({
      changed: true,
      commitSha: "new-commit-sha",
      branch: "main",
      months: ["2031-01", "2031-02"],
      total: "4.8B",
    });
    const blobs = githubCalls(calls).filter((call) => call.url.endsWith("/git/blobs"));
    expect(blobs).toHaveLength(2);
    const expectedChart = renderUsageChart(
      selectUsageBars(
        records.map(({ month, claudeTokens, codexTokens }) => ({ month, claudeTokens, codexTokens })),
        ["2031-01", "2031-02"],
      ).bars,
    );
    expect(blobs[0]!.body.content).toBe(readme);
    expect(blobs[1]!.body.content).toBe(expectedChart);
    const commit = githubCalls(calls).find((call) => call.method === "POST" && call.url.endsWith("/git/commits"));
    expect(commit!.body.message).toBe("docs: 프로필과 에이전트 사용량 차트를 갱신한다 (2031-01~2031-02)");
  });

  test("달이 하나면 커밋 문구에 그 달 하나만 쓴다", async () => {
    const { calls, tools } = connected();
    const result = await tools.call("update_github_profile", { readme: badge("0.8B"), months: ["2031-01"], ...reviewed });
    expect(parse(result).total).toBe("0.8B");
    const commit = githubCalls(calls).find((call) => call.method === "POST" && call.url.endsWith("/git/commits"));
    expect(commit!.body.message).toBe("docs: 프로필과 에이전트 사용량 차트를 갱신한다 (2031-01)");
  });

  const mismatches = [
    ["배지가 합계와 0.1B 다르면", badge("4.7B"), "4.7B"],
    ["배지가 없으면", "# 프로필\n", null],
    ["배지가 둘이면", `${badge("4.8B")}${badge("4.8B")}`, null],
    ["배지에 소수 자리가 없으면", badge("5B"), null],
  ] as const;
  for (const [label, text, found] of mismatches) {
    test(`${label} CAREER_BADGE_MISMATCH 이고 GitHub 에 아무것도 보내지 않는다`, async () => {
      const { calls, tools } = connected();
      const result = await tools.call("update_github_profile", { readme: text, months: ["2031-01", "2031-02"], ...reviewed });
      expect(result.isError).toBe(true);
      expect(parse(result)).toEqual({
        error: { code: "CAREER_BADGE_MISMATCH", message: expect.any(String) },
        expected: formatBillions(48),
        found,
      });
      expect(githubCalls(calls)).toHaveLength(0);
    });
  }

  test("기록에 없는 달이 있으면 CAREER_USAGE_MONTH_MISSING 이고 missing 에 그 달이 있다", async () => {
    const { calls, tools } = connected();
    const result = await tools.call("update_github_profile", { readme, months: ["2031-01", "2031-03"], ...reviewed });
    expect(parse(result)).toEqual({
      error: { code: "CAREER_USAGE_MONTH_MISSING", message: expect.any(String) },
      missing: ["2031-03"],
    });
    expect(githubCalls(calls)).toHaveLength(0);
  });

  test("고른 달의 막대가 모두 0 이면 CAREER_INVALID_INPUT 이고 GitHub 에 아무것도 보내지 않는다", async () => {
    const { calls, tools } = connected({ snapshots: [usage("2031-01", 49_999_999, 0)] });
    const result = await tools.call("update_github_profile", { readme: badge("0.0B"), months: ["2031-01"], ...reviewed });
    expect(parse(result).error.code).toBe("CAREER_INVALID_INPUT");
    expect(githubCalls(calls)).toHaveLength(0);
  });

  const rejected = [
    ["숫자 total 을 더하면", { readme, months: ["2031-01"], total: "97.9B", ...reviewed }],
    ["months 가 빈 배열", { readme, months: [], ...reviewed }],
    ["months 가 일곱 개", { readme, months: ["2031-01", "2031-02", "2031-03", "2031-04", "2031-05", "2031-06", "2031-07"], ...reviewed }],
    ["months 가 겹치면", { readme, months: ["2031-01", "2031-01"], ...reviewed }],
    ["months 에 2031-13", { readme, months: ["2031-13"], ...reviewed }],
    ["readme 가 공백뿐", { readme: "  \n", months: ["2031-01"], ...reviewed }],
    ["readme 가 65,537바이트", { readme: "a".repeat(65_537), months: ["2031-01"], ...reviewed }],
    // Approvals stored before expectedBranch and expectedHead existed are rejected, not run on the latest head.
    ["검토 기준이 없는 옛 형식이면", { readme, months: ["2031-01"] }],
    ["expectedHead 만 없으면", { readme, months: ["2031-01"], expectedBranch: "main" }],
    ["expectedBranch 가 비면", { readme, months: ["2031-01"], ...reviewed, expectedBranch: "" }],
    ["expectedHead 가 대문자면", { readme, months: ["2031-01"], ...reviewed, expectedHead: "A".repeat(40) }],
    ["expectedHead 가 짧으면", { readme, months: ["2031-01"], ...reviewed, expectedHead: "a".repeat(7) }],
  ] as const;
  for (const [label, args] of rejected) {
    test(`${label} fetch 없이 CAREER_INVALID_INPUT 이다`, async () => {
      const { calls, tools } = connected();
      const result = await tools.call("update_github_profile", args);
      expect(parse(result).error.code).toBe("CAREER_INVALID_INPUT");
      expect(calls).toHaveLength(0);
    });
  }

  test("months 가 여섯 개면 받는다", async () => {
    const six = ["2031-01", "2031-02", "2031-03", "2031-04", "2031-05", "2031-06"].map((month) =>
      usage(month, 1_000_000_000, 0),
    );
    const { tools } = connected({ snapshots: six });
    const result = await tools.call("update_github_profile", {
      readme: badge("6.0B"),
      months: six.map((record) => record.month),
      ...reviewed,
    });
    expect(result.isError).toBeUndefined();
    expect(parse(result).months).toEqual(six.map((record) => record.month));
  });

  test("GitHub token 이 없으면 GitHub 도구는 fetch 없이 CAREER_GITHUB_NOT_CONFIGURED 이고 다른 도구는 동작한다", async () => {
    const { calls, tools } = connected({ github: false });
    const update = await tools.call("update_github_profile", { readme, months: ["2031-01"], ...reviewed });
    expect(parse(update).error.code).toBe("CAREER_GITHUB_NOT_CONFIGURED");
    const read = await tools.call("get_github_profile", {});
    expect(parse(read).error.code).toBe("CAREER_GITHUB_NOT_CONFIGURED");
    expect(calls).toHaveLength(0);
    const list = await tools.call("list_profile_documents", {});
    expect(list.isError).toBeUndefined();
  });

  test("get_github_profile 은 저장소와 branch, 끝 커밋, 그 커밋의 README 와 차트 유무를 낸다", async () => {
    const { tools } = connected();
    const result = await tools.call("get_github_profile", {});
    expect(parse(result)).toEqual({ repo, branch: "main", head: headA, readme, chartExists: false });
  });

  test("A 를 읽고 만든 요청이 B 가 커밋된 뒤 실행되면 CAREER_GITHUB_STALE_REVIEW 이고 GitHub 에 쓰지 않는다", async () => {
    const before = connected();
    const read = parse(await before.tools.call("get_github_profile", {}));
    const args = { readme, months: ["2031-01", "2031-02"], expectedBranch: read.branch, expectedHead: read.head };
    const after = connected({ head: headB });
    const result = await after.tools.call("update_github_profile", args);
    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe("CAREER_GITHUB_STALE_REVIEW");
    expect(githubCalls(after.calls).filter((call) => call.method !== "GET")).toHaveLength(0);
  });

  test("승인 인자를 JSON 으로 저장했다가 새 인스턴스에서 실행해도 검토 기준이 그대로 쓰인다", async () => {
    // fos-assistant stores argsJson at approval time and executes it later, possibly in another process.
    const stored = JSON.stringify({ readme, months: ["2031-01", "2031-02"], ...reviewed });
    const later = connected();
    const result = await later.tools.call("update_github_profile", JSON.parse(stored));
    expect(result.isError).toBeUndefined();
    const commit = githubCalls(later.calls).find((call) => call.method === "POST" && call.url.endsWith("/git/commits"));
    expect(commit!.body.parents).toEqual([headA]);
    const moved = connected({ head: headB });
    const stale = await moved.tools.call("update_github_profile", JSON.parse(stored));
    expect(parse(stale).error.code).toBe("CAREER_GITHUB_STALE_REVIEW");
  });

  test("check_connection 은 GitHub 가 있으면 둘 다 확인하고 structuredContent 에도 싣는다", async () => {
    const { calls, tools } = connected();
    const result = await tools.call("check_connection", {});
    expect(parse(result)).toEqual({ backend: "ok", github: "ok" });
    expect(result.structuredContent).toEqual({ backend: "ok", github: "ok" });
    expect(githubCalls(calls).map((call) => call.url)).toEqual([gh]);
  });

  test("check_connection 은 GitHub 가 401 이면 CAREER_GITHUB_UNAUTHORIZED 다", async () => {
    const { tools } = connected({ githubStatus: 401 });
    const result = await tools.call("check_connection", {});
    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe("CAREER_GITHUB_UNAUTHORIZED");
  });

  test("두 token 은 서로 다른 host 로 가지 않고 오류 결과에도 실리지 않는다", async () => {
    const { calls, tools } = connected();
    await tools.call("update_github_profile", { readme, months: ["2031-01", "2031-02"], ...reviewed });
    await tools.call("check_connection", {});
    expect(githubCalls(calls).length).toBeGreaterThan(0);
    for (const call of calls) {
      const host = new URL(call.url).host;
      const auth = authOf(call);
      if (host === "api.github.com") {
        expect({ url: call.url, auth }).toEqual({ url: call.url, auth: `Bearer ${githubToken}` });
      } else {
        expect({ host, auth }).toEqual({ host: "career.example.com", auth: `Bearer ${token}` });
      }
    }
    const failures = [
      await connected({ githubStatus: 401 }).tools.call("check_connection", {}),
      await connected({ githubStatus: 502 }).tools.call("get_github_profile", {}),
      await connected().tools.call("update_github_profile", { readme: badge("1.0B"), months: ["2031-01"], ...reviewed }),
    ];
    for (const failure of failures) {
      expect(failure.isError).toBe(true);
      expect(failure.content[0].text).not.toContain(githubToken);
      expect(failure.content[0].text).not.toContain(token);
    }
  });
});
