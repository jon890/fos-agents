// list_study_candidates and get_position_research_constraints: the read-only starting points of
// autonomous career research. All data here is synthetic.
import { describe, expect, test } from "bun:test";
import { CareerBackend, type FetchLike } from "./backend.ts";
import { urlKey } from "./study-fixtures.ts";
import { CareerTools } from "./tools.ts";

const baseUrl = "https://career.example.com/";
const token = "x".repeat(40);

// The only requests either tool may send. No recommendation run, collection, document save or publication.
const allowedRequests = [
  /^GET \/api\/study\/v1\/candidates\?limit=\d+(&[A-Za-z]+=[^&]+)*$/,
  /^GET \/api\/positions\/v1\/exclusions$/,
  /^GET \/api\/positions\/v1\/company-preferences$/,
];

type Call = { method: string; path: string; body: unknown };

function harness(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(String(input));
    const call: Call = { method: String(init?.method), path: `${url.pathname}${url.search}`, body: init?.body };
    calls.push(call);
    return respond(call);
  };
  return { calls, tools: new CareerTools(new CareerBackend({ baseUrl, token }, fetchImpl)) };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const parse = (result: { content: [{ text: string }] }) => JSON.parse(result.content[0].text);

function expectReadOnly(calls: Call[]) {
  for (const call of calls) {
    const line = `${call.method} ${call.path}`;
    expect({ line, allowed: allowedRequests.some((pattern) => pattern.test(line)), body: call.body }).toEqual({
      line,
      allowed: true,
      body: undefined,
    });
  }
}

describe("list_study_candidates", () => {
  const candidate = {
    id: urlKey(1),
    contentKey: urlKey(1),
    canonicalUrl: "https://blog.example.com/posts/retry-budget",
    sourceKey: "example-blog",
    sourceName: "예시 기술 블로그",
    category: "techBlog",
    title: "재시도 예산으로 장애 전파를 막은 이야기",
    url: "https://blog.example.com/posts/retry-budget?utm_source=feed",
    published: "2026-10-01",
    excerpt: "가".repeat(2_000),
    kind: "feed-article",
    previouslyRecommended: false,
  };
  const page = (overrides: Record<string, unknown> = {}) => ({
    candidates: [candidate, { ...candidate, id: urlKey(2), contentKey: urlKey(2), excerpt: undefined }],
    recentStudyTopicKeys: ["retry-budget", "outbox-pattern"],
    nextCursor: "eyJjb250ZW50S2V5IjoieCJ9",
    historyVersion: 3,
    candidateContextVersion: "learning-interests:v2",
    learningInterests: { version: 2, body: "# 관심사\n- 운영 안정성\n" },
    ...overrides,
  });

  test("필터를 모두 query 에 싣고 자료 출처와 관심사 버전, 최근 주제, 다음 쪽 cursor 를 보존한다", async () => {
    const { calls, tools } = harness(() => json(page()));
    const result = await tools.call("list_study_candidates", {
      limit: 2,
      category: "techBlog",
      sourceKey: "example-blog",
      publishedFrom: "2026-09-01T00:00:00Z",
      publishedTo: "2026-10-01T00:00:00.000Z",
      cursor: "eyJjb250ZW50S2V5IjoidyJ9",
    });
    expect(result.isError).toBeUndefined();
    expect(calls.map((call) => call.path)).toEqual([
      "/api/study/v1/candidates?limit=2&category=techBlog&sourceKey=example-blog" +
        "&publishedFrom=2026-09-01T00%3A00%3A00Z&publishedTo=2026-10-01T00%3A00%3A00.000Z" +
        "&cursor=eyJjb250ZW50S2V5IjoidyJ9",
    ]);
    expectReadOnly(calls);

    const value = parse(result);
    expect(value).toMatchObject({
      status: "ok",
      candidateContextVersion: "learning-interests:v2",
      learningInterestsVersion: 2,
      historyVersion: 3,
      recentStudyTopicKeys: ["retry-budget", "outbox-pattern"],
      nextCursor: "eyJjb250ZW50S2V5IjoieCJ9",
      hasMore: true,
    });
    // The interests body belongs to get_context_document.
    expect("learningInterests" in value).toBe(false);
    expect(value.candidates[0]).toEqual({
      contentKey: urlKey(1),
      canonicalUrl: "https://blog.example.com/posts/retry-budget",
      url: "https://blog.example.com/posts/retry-budget?utm_source=feed",
      sourceKey: "example-blog",
      sourceName: "예시 기술 블로그",
      title: "재시도 예산으로 장애 전파를 막은 이야기",
      category: "techBlog",
      kind: "feed-article",
      published: "2026-10-01",
      excerpt: "가".repeat(500),
    });
    expect("excerpt" in value.candidates[1]).toBe(false);
  });

  test("limit 기본값은 20 이다", async () => {
    const { calls, tools } = harness(() => json(page()));
    await tools.call("list_study_candidates", {});
    expect(calls.map((call) => call.path)).toEqual(["/api/study/v1/candidates?limit=20"]);
  });

  test("마지막 쪽은 nextCursor 가 null 이고 hasMore 가 false 다", async () => {
    const { tools } = harness(() => json(page({ nextCursor: null })));
    const value = parse(await tools.call("list_study_candidates", { cursor: "eyJjb250ZW50S2V5IjoieCJ9" }));
    expect(value).toMatchObject({ status: "ok", nextCursor: null, hasMore: false });
    expect(value.candidates).toHaveLength(2);
  });

  test("후보가 없으면 오류가 아닌 status empty 이고 버전과 최근 주제는 그대로 낸다", async () => {
    const { tools } = harness(() => json(page({ candidates: [], nextCursor: null })));
    const result = await tools.call("list_study_candidates", {});
    expect(result.isError).toBeUndefined();
    expect(parse(result)).toEqual({
      status: "empty",
      candidateContextVersion: "learning-interests:v2",
      learningInterestsVersion: 2,
      historyVersion: 3,
      recentStudyTopicKeys: ["retry-budget", "outbox-pattern"],
      nextCursor: null,
      hasMore: false,
      candidates: [],
    });
  });

  test("409 는 오류가 아닌 status learning_interests_missing 이다", async () => {
    const { calls, tools } = harness(() => json({ code: "CANDIDATE_CONTEXT_MISSING" }, 409));
    const result = await tools.call("list_study_candidates", {});
    expect(result.isError).toBeUndefined();
    expect(parse(result)).toEqual({ status: "learning_interests_missing" });
    expect(calls).toHaveLength(1);
  });

  const failures = [
    { label: "401", respond: () => json({}, 401), code: "CAREER_UNAUTHORIZED" },
    { label: "403", respond: () => json({}, 403), code: "CAREER_UNAUTHORIZED" },
    { label: "잘못된 cursor 의 400", respond: () => json({}, 400), code: "CAREER_BAD_REQUEST" },
    { label: "503", respond: () => json({}, 503), code: "CAREER_UNAVAILABLE" },
    { label: "다른 모양의 응답", respond: () => json({ candidates: "x" }), code: "CAREER_INVALID_RESPONSE" },
    {
      label: "연결 실패",
      respond: () => {
        throw new Error(`connect ECONNREFUSED ${token}`);
      },
      code: "CAREER_NETWORK",
    },
  ];
  for (const f of failures) {
    test(`${f.label} 는 ${f.code} 오류이고 다시 보내지 않는다`, async () => {
      const { calls, tools } = harness(f.respond);
      const result = await tools.call("list_study_candidates", {});
      expect(result.isError).toBe(true);
      expect(parse(result).error.code).toBe(f.code);
      expect(result.content[0].text).not.toContain(token);
      expect(calls).toHaveLength(1);
    });
  }

  const invalid = [
    { limit: 51 },
    { limit: 0 },
    { category: "news" },
    { publishedFrom: "2026-09-01" },
    { cursor: "" },
    { sourceKey: "a\nb" },
    { candidateContextVersion: "learning-interests:v2" },
  ];
  for (const args of invalid) {
    test(`${JSON.stringify(args)} 는 fetch 없이 CAREER_INVALID_INPUT 이다`, async () => {
      const { calls, tools } = harness(() => json(page()));
      const result = await tools.call("list_study_candidates", args);
      expect(parse(result).error.code).toBe("CAREER_INVALID_INPUT");
      expect(calls).toHaveLength(0);
    });
  }
});

describe("get_position_research_constraints", () => {
  const exclusions = [
    {
      scope: "posting",
      source: "example-jobs",
      identityHash: "a".repeat(64),
      url: "https://jobs.example.com/postings/101",
      decisionKind: "manual",
      reason: "같은 공고에 이미 지원했다",
      evidenceUrls: ["https://jobs.example.com/postings/101"],
      decidedAt: "2026-09-01",
      expiresAt: "2026-12-31",
    },
    {
      scope: "company",
      company: "example-corp",
      decisionKind: "career-downside",
      reason: "최근 공개 근거 두 건에서 개발 조직 축소가 확인됐다",
      evidenceUrls: ["https://news.example.com/a", "https://news.example.com/b"],
      confidence: "high",
      decidedAt: "2026-08-15",
    },
    {
      scope: "company-role",
      company: "sample-labs",
      titleKeywords: ["QA", "SDET"],
      decisionKind: "manual",
      reason: "지원 대상 역할이 아니다",
      evidenceUrls: ["https://jobs.example.com/companies/sample-labs"],
      decidedAt: "2026-07-01",
      expiresAt: "2027-01-01",
    },
  ];
  const companyPreferences = [
    {
      companyKey: "example-corp",
      companyName: "예시 주식회사",
      tier: 1,
      disposition: "analyze",
      techBlogFeedUrl: "https://tech.example.com/feed.xml",
      githubOrg: "example-corp",
      updatedAt: "2026-09-20T01:00:00.000Z",
    },
    {
      companyKey: "sample-labs",
      companyName: "샘플 랩스",
      tier: null,
      disposition: "exclude",
      updatedAt: "2026-09-21T01:00:00.000Z",
    },
  ];

  const backend =
    (overrides: { exclusions?: () => Response; companyPreferences?: () => Response } = {}) =>
    (call: Call) => {
      if (call.path === "/api/positions/v1/exclusions")
        return overrides.exclusions?.() ?? json(exclusions);
      if (call.path === "/api/positions/v1/company-preferences")
        return overrides.companyPreferences?.() ?? json(companyPreferences);
      return json({}, 404);
    };

  test("두 GET 만 보내고 세 범위의 제외 규칙과 기간, 수동 선호를 그대로 내며 ready 다", async () => {
    const { calls, tools } = harness(backend());
    const result = await tools.call("get_position_research_constraints", {});
    expect(result.isError).toBeUndefined();
    expect(calls.map((call) => `${call.method} ${call.path}`).sort()).toEqual([
      "GET /api/positions/v1/company-preferences",
      "GET /api/positions/v1/exclusions",
    ]);
    expectReadOnly(calls);
    expect(parse(result)).toEqual({ readiness: "ready", missing: [], exclusions, companyPreferences });
  });

  test("만료일 없는 규칙은 expiresAt 칸 없이 내고 만료일이 있는 규칙은 그 날짜를 낸다", async () => {
    const { tools } = harness(backend());
    const value = parse(await tools.call("get_position_research_constraints", {}));
    expect(value.exclusions.map((rule: { expiresAt?: string }) => rule.expiresAt ?? null)).toEqual([
      "2026-12-31",
      null,
      "2027-01-01",
    ]);
  });

  test("규칙과 선호가 비어 있어도 읽었으면 ready 다", async () => {
    const { tools } = harness(backend({ exclusions: () => json([]), companyPreferences: () => json([]) }));
    expect(parse(await tools.call("get_position_research_constraints", {}))).toEqual({
      readiness: "ready",
      missing: [],
      exclusions: [],
      companyPreferences: [],
    });
  });

  const holds = [
    { label: "제외 규칙이 503", overrides: { exclusions: () => json({}, 503) }, missing: { exclusions: "CAREER_UNAVAILABLE" } },
    {
      label: "제외 규칙이 다른 모양",
      overrides: { exclusions: () => json([{ scope: "everything" }]) },
      missing: { exclusions: "CAREER_INVALID_RESPONSE" },
    },
    {
      label: "회사 선호가 500",
      overrides: { companyPreferences: () => json({}, 500) },
      missing: { companyPreferences: "CAREER_UNAVAILABLE" },
    },
    {
      label: "둘 다 연결 실패",
      overrides: {
        exclusions: () => {
          throw new Error("down");
        },
        companyPreferences: () => {
          throw new Error("down");
        },
      },
      missing: { exclusions: "CAREER_NETWORK", companyPreferences: "CAREER_NETWORK" },
    },
  ];
  for (const h of holds) {
    test(`${h.label} 이면 오류가 아닌 hold 이고 읽은 쪽만 낸다`, async () => {
      const { tools } = harness(backend(h.overrides));
      const result = await tools.call("get_position_research_constraints", {});
      expect(result.isError).toBeUndefined();
      const value = parse(result);
      expect(value.readiness).toBe("hold");
      expect(
        Object.fromEntries(value.missing.map((m: { source: string; code: string }) => [m.source, m.code])),
      ).toEqual(h.missing);
      expect(value.exclusions).toEqual("exclusions" in h.missing ? null : exclusions);
      expect(value.companyPreferences).toEqual("companyPreferences" in h.missing ? null : companyPreferences);
    });
  }

  const rejections = [
    { label: "제외 규칙이 401", overrides: { exclusions: () => json({}, 401) } },
    { label: "제외 규칙이 403", overrides: { exclusions: () => json({}, 403) } },
    { label: "회사 선호가 401", overrides: { companyPreferences: () => json({}, 401) } },
    { label: "회사 선호가 403", overrides: { companyPreferences: () => json({}, 403) } },
  ];
  for (const r of rejections) {
    test(`${r.label} 이면 hold 가 아닌 CAREER_UNAUTHORIZED 오류다`, async () => {
      const { tools } = harness(backend(r.overrides));
      const result = await tools.call("get_position_research_constraints", {});
      expect(result.isError).toBe(true);
      expect(parse(result).error.code).toBe("CAREER_UNAUTHORIZED");
    });
  }

  test("입력에 키가 있으면 fetch 없이 CAREER_INVALID_INPUT 이다", async () => {
    const { calls, tools } = harness(backend());
    const result = await tools.call("get_position_research_constraints", { company: "example-corp" });
    expect(parse(result).error.code).toBe("CAREER_INVALID_INPUT");
    expect(calls).toHaveLength(0);
  });
});
