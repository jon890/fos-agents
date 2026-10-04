import { describe, expect, test } from "bun:test";
import { CareerBackend, type FetchLike } from "./backend.ts";
import { urlKey, worstCaseRecommendation } from "./study-fixtures.ts";
import { CareerTools } from "./tools.ts";

const baseUrl = "https://career.example.com/";
const token = "x".repeat(40);
// 2026-10-03T16:00Z is already 2026-10-04 in Seoul.
const fixedNow = () => new Date("2026-10-03T16:00:00.000Z");

const allowedRequests = [
  /^GET \/api\/study\/v1\/candidates\?limit=\d+(&category=(techBlog|geek|ai|video))?$/,
  /^POST \/api\/study\/v1\/recommendation-runs$/,
  /^GET \/api\/study\/v1\/recommendation-runs\/[^/]+\/status$/,
];

type Call = { method: string; path: string; body: unknown; key: string | null };

function harness(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(String(input));
    const call: Call = {
      method: String(init?.method),
      path: `${url.pathname}${url.search}`,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      key: new Headers(init?.headers).get("Idempotency-Key"),
    };
    calls.push(call);
    return respond(call);
  };
  const tools = new CareerTools(new CareerBackend({ baseUrl, token }, fetchImpl), undefined, fixedNow);
  return { calls, tools };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const parse = (result: { content: [{ text: string }] }) => JSON.parse(result.content[0].text);

function expectAllowed(calls: Call[]) {
  for (const call of calls) {
    const line = `${call.method} ${call.path}`;
    expect({ line, allowed: allowedRequests.some((pattern) => pattern.test(line)) }).toEqual({
      line,
      allowed: true,
    });
  }
}

describe("get_study_candidates", () => {
  const candidate = {
    id: urlKey(1),
    contentKey: urlKey(1),
    canonicalUrl: "https://blog.example.com/posts/retry-budget",
    sourceKey: "example-blog",
    sourceName: "예시 기술 블로그",
    category: "techBlog",
    title: "재시도 예산으로 장애 전파를 막은 이야기",
    url: "https://blog.example.com/posts/retry-budget",
    published: "2026-10-01",
    excerpt: "가".repeat(2_000),
    kind: "feed-article",
    previouslyRecommended: false,
  };
  const page = {
    candidates: [candidate, { ...candidate, id: urlKey(2), contentKey: urlKey(2), excerpt: undefined }],
    recentStudyTopicKeys: ["retry-budget"],
    nextCursor: null,
    historyVersion: 3,
    candidateContextVersion: "learning-interests:v2",
    learningInterests: { version: 2, body: "# 관심사\n- 운영 안정성\n" },
  };

  test("limit 기본값 20 으로 후보 GET 하나만 보내고 결과의 excerpt 를 500자에서 자른다", async () => {
    const { calls, tools } = harness(() => json(page));
    const result = await tools.call("get_study_candidates", {});
    expect(result.isError).toBeUndefined();
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(["GET /api/study/v1/candidates?limit=20"]);
    expectAllowed(calls);

    const value = parse(result);
    expect(value.candidateContextVersion).toBe("learning-interests:v2");
    expect(value.historyVersion).toBe(3);
    expect(value.learningInterests).toEqual(page.learningInterests);
    expect(value.recentStudyTopicKeys).toEqual(["retry-budget"]);
    expect(value.nextCursor).toBeNull();
    expect(value.candidates).toHaveLength(2);
    expect(value.candidates[0].excerpt).toBe("가".repeat(500));
    expect("excerpt" in value.candidates[1]).toBe(false);
    for (const row of value.candidates) {
      for (const key of ["id", "canonicalUrl", "sourceKey", "previouslyRecommended"])
        expect({ key, present: key in row }).toEqual({ key, present: false });
    }
    expect(Object.keys(value.candidates[0]).sort()).toEqual(
      ["category", "contentKey", "excerpt", "kind", "published", "sourceName", "title", "url"],
    );
  });

  test("limit 과 category 를 query 에 싣는다", async () => {
    const { calls, tools } = harness(() => json(page));
    await tools.call("get_study_candidates", { limit: 5, category: "video" });
    expect(calls.map((call) => call.path)).toEqual(["/api/study/v1/candidates?limit=5&category=video"]);
    expectAllowed(calls);
  });

  test("limit 21 은 fetch 없이 CAREER_INVALID_INPUT 이다", async () => {
    const { calls, tools } = harness(() => json(page));
    const result = await tools.call("get_study_candidates", { limit: 21 });
    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe("CAREER_INVALID_INPUT");
    expect(calls).toHaveLength(0);
  });

  test("409 는 learning-interests 문서가 없다는 CAREER_LEARNING_INTERESTS_MISSING 이다", async () => {
    const { calls, tools } = harness(() => json({ code: "CANDIDATE_CONTEXT_MISSING" }, 409));
    const result = await tools.call("get_study_candidates", {});
    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe("CAREER_LEARNING_INTERESTS_MISSING");
    expectAllowed(calls);
  });
});

const recommendation = {
  candidateContextVersion: "learning-interests:v2",
  topics: [
    {
      topicKey: "retry-budget",
      title: "재시도 예산",
      careerQuestion: "우리 서비스의 재시도 상한은 어떻게 정할까",
      items: [
        {
          contentKey: urlKey(1),
          summary: "재시도 예산으로 장애 전파를 막았다",
          reason: "재시도 상한을 정하는 근거를 얻는다",
          careerValue: "current-work",
        },
      ],
    },
  ],
  rejections: [{ contentKey: "youtube:abcDEF_123-x", reason: "제품 발표만 다룬다" }],
} as const;

describe("save_study_recommendation", () => {
  const created = (call: Call) => json({ reportId: (call.body as { reportId: string }).reportId, historyVersion: 4 }, 201);

  test("서울 날짜로 reportId 를 만들고 입력 그대로 POST 하나를 recommendation 키로 보낸다", async () => {
    const { calls, tools } = harness(created);
    const result = await tools.call("save_study_recommendation", recommendation);
    expect(result.isError).toBeUndefined();
    expect(parse(result)).toEqual({
      reportId: "morning-2026-10-04",
      generatedAt: "2026-10-03T16:00:00.000Z",
      historyVersion: 4,
    });
    expect(calls).toHaveLength(1);
    expectAllowed(calls);
    expect(calls[0]!.body).toEqual({
      reportId: "morning-2026-10-04",
      generatedAt: "2026-10-03T16:00:00.000Z",
      ...recommendation,
    });
    expect(calls[0]!.key).toMatch(/^recommendation:[0-9a-f]{64}$/);
  });

  test("generatedAt 을 넘기면 now 대신 그 값을 쓰고 같은 값이면 같은 키를 쓴다", async () => {
    const first = harness(created);
    const second = harness(created);
    const args = { ...recommendation, generatedAt: "2026-10-04T00:30:00.000Z" };
    await first.tools.call("save_study_recommendation", args);
    await second.tools.call("save_study_recommendation", args);
    expect((first.calls[0]!.body as { generatedAt: string }).generatedAt).toBe(args.generatedAt);
    expect(first.calls[0]!.key).toBe(second.calls[0]!.key);
  });

  test("UTC ISO 가 아닌 generatedAt 은 fetch 없이 거절한다", async () => {
    const { calls, tools } = harness(created);
    for (const generatedAt of ["2026-10-04T09:30:00+09:00", "2026-10-04", "not-a-date"]) {
      const result = await tools.call("save_study_recommendation", { ...recommendation, generatedAt });
      expect({ generatedAt, code: parse(result).error?.code }).toEqual({ generatedAt, code: "CAREER_INVALID_INPUT" });
    }
    expect(calls).toHaveLength(0);
  });

  function conflictThenStatus(status: () => Response) {
    return (call: Call) => (call.method === "POST" ? json({ code: "VERSION_CONFLICT" }, 409) : status());
  }

  test("409 뒤 status 가 exists: true 면 CAREER_STUDY_ALREADY_SAVED 에 reportId 를 싣는다", async () => {
    const { calls, tools } = harness(
      conflictThenStatus(() => json({ reportId: "morning-2026-10-04", exists: true })),
    );
    const result = await tools.call("save_study_recommendation", recommendation);
    expect(result.isError).toBe(true);
    expect(parse(result)).toMatchObject({
      error: { code: "CAREER_STUDY_ALREADY_SAVED" },
      reportId: "morning-2026-10-04",
    });
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "POST /api/study/v1/recommendation-runs",
      "GET /api/study/v1/recommendation-runs/morning-2026-10-04/status",
    ]);
    expectAllowed(calls);
  });

  test("409 뒤 status 가 exists: false 면 CAREER_STUDY_CONFLICT 다", async () => {
    const { calls, tools } = harness(
      conflictThenStatus(() => json({ reportId: "morning-2026-10-04", exists: false })),
    );
    const result = await tools.call("save_study_recommendation", recommendation);
    expect(parse(result).error.code).toBe("CAREER_STUDY_CONFLICT");
    expectAllowed(calls);
  });

  test("409 뒤 status 조회가 실패해도 CAREER_STUDY_CONFLICT 다", async () => {
    const { calls, tools } = harness(conflictThenStatus(() => json({}, 503)));
    const result = await tools.call("save_study_recommendation", recommendation);
    expect(parse(result).error.code).toBe("CAREER_STUDY_CONFLICT");
    expect(calls).toHaveLength(2);
    expectAllowed(calls);
  });

  test("fetch 가 던지면 CAREER_NETWORK 에 reportId 와 generatedAt 을 싣는다", async () => {
    const { calls, tools } = harness(() => {
      throw new Error("connection reset");
    });
    const result = await tools.call("save_study_recommendation", recommendation);
    expect(result.isError).toBe(true);
    expect(parse(result)).toEqual({
      error: { code: "CAREER_NETWORK", message: expect.any(String) },
      reportId: "morning-2026-10-04",
      generatedAt: "2026-10-03T16:00:00.000Z",
    });
    expect(calls).toHaveLength(1);
    expectAllowed(calls);
  });
});

// fos-assistant rejects an approval-bound call whose serialized arguments exceed 16KB of UTF-8.
const approvalArgumentLimit = 16_384;

describe("최악의 인자 크기", () => {
  test("모든 칸을 상한까지 채운 인자가 스키마를 통과하고 16KB 안에 든다", async () => {
    const args = worstCaseRecommendation();
    const bytes = Buffer.byteLength(JSON.stringify(args), "utf8");
    expect(bytes).toBeLessThanOrEqual(approvalArgumentLimit);
    const { calls, tools } = harness((call) => json({ reportId: (call.body as { reportId: string }).reportId, historyVersion: 1 }, 201));
    const result = await tools.call("save_study_recommendation", args);
    expect({ bytes, isError: result.isError }).toEqual({ bytes, isError: undefined });
    expect(calls).toHaveLength(1);
  });

  type Args = ReturnType<typeof worstCaseRecommendation>;
  const overflows: Array<[string, (args: Args) => void]> = [
    ["candidateContextVersion 101자", (a) => void (a.candidateContextVersion += "가")],
    // The fifth topic takes an item from the first, so the item total stays at 8.
    ["주제 5개", (a) => void a.topics.push({ ...a.topics[0]!, topicKey: "extra", items: [a.topics[0]!.items.pop()!] })],
    ["자료 합계 9개", (a) => void a.topics[0]!.items.push({ ...a.topics[0]!.items[0]!, contentKey: urlKey(200) })],
    ["topicKey 81자", (a) => void (a.topics[0]!.topicKey += "k")],
    ["title 61자", (a) => void (a.topics[0]!.title += "가")],
    ["careerQuestion 101자", (a) => void (a.topics[0]!.careerQuestion += "가")],
    ["summary 101자", (a) => void (a.topics[0]!.items[0]!.summary += "가")],
    ["reason 101자", (a) => void (a.topics[0]!.items[0]!.reason += "가")],
    ["제외 21개", (a) => void a.rejections.push({ contentKey: urlKey(201), reason: "가" })],
    ["제외 reason 51자", (a) => void (a.rejections[0]!.reason += "가")],
    ["contentKey hex 65자", (a) => void (a.rejections[0]!.contentKey += "0")],
  ];

  for (const [name, overflow] of overflows) {
    test(`${name} 은 fetch 없이 CAREER_INVALID_INPUT 이다`, async () => {
      const args = worstCaseRecommendation();
      overflow(args);
      const { calls, tools } = harness(() => json({}, 500));
      const result = await tools.call("save_study_recommendation", args);
      expect({ name, code: parse(result).error?.code }).toEqual({ name, code: "CAREER_INVALID_INPUT" });
      expect(calls).toHaveLength(0);
    });
  }
});
