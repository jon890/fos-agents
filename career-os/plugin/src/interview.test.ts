import { describe, expect, test } from "bun:test";
import {
  selectFromBank,
  toDrillProgress,
  type SelectableQuestion,
} from "../../scripts/interview-drill/question-selection.ts";
import { CareerBackend, type FetchLike } from "./backend.ts";
import { publicTechQuestions } from "./interview.ts";
import { CareerTools } from "./tools.ts";

const baseUrl = "https://career.example.com/";
const token = "x".repeat(40);
// 2026-09-30T16:30Z is already 2026-10-01 in Seoul.
const fixedNow = () => new Date("2026-09-30T16:30:00.000Z");
const seoulToday = "2026-10-01";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const allowedRequests = [
  /^GET \/api\/interview\/v1\/progress\?drillType=(tech|behavioral)$/,
  /^GET \/api\/interview\/v1\/personal-questions\?drillType=(tech|behavioral)$/,
  /^POST \/api\/interview\/v1\/attempts$/,
  /^PUT \/api\/interview\/v1\/personal-questions\/[^/]+$/,
];

type Call = { method: string; path: string; body: unknown; key: string | null };

function harness(respond: (call: Call) => Response) {
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

const personalQuestion = {
  id: "personal-retry-budget",
  topic: "personal-retry-budget",
  category: "operations",
  difficulty: "intermediate",
  question: "재시도 예산을 어떻게 정했나요?",
  intent: "재시도와 부하의 관계를 설명하는지 본다",
  answerSignals: ["재시도 상한", "백오프"],
} as const;

const progressRow = (topic: string, nextReviewDate: string | null, failCount = 0) => ({
  drillType: "tech",
  topic,
  passCount: 1,
  failCount,
  nextReviewDate,
  lastPassedDate: "2026-09-20",
});

describe("get_interview_questions", () => {
  const firstPublic = publicTechQuestions[0]!;
  const progressItems = [
    progressRow(firstPublic.topic, "2026-09-28", 1),
    progressRow(publicTechQuestions[1]!.topic, "2026-12-01"),
    progressRow(personalQuestion.topic, "2026-09-29", 1),
  ];

  function respond(call: Call) {
    if (call.path.startsWith("/api/interview/v1/progress")) return json({ items: progressItems });
    return json({ items: [personalQuestion] });
  }

  test("progress 와 개인 질문 두 GET 만 보내고 서울 날짜로 CLI 와 같은 질문을 고른다", async () => {
    const { calls, tools } = harness(respond);
    const result = await tools.call("get_interview_questions", { drillType: "tech", count: 10 });
    expect(result.isError).toBeUndefined();
    const value = parse(result);

    expect(calls.map((call) => `${call.method} ${call.path}`).sort()).toEqual([
      "GET /api/interview/v1/personal-questions?drillType=tech",
      "GET /api/interview/v1/progress?drillType=tech",
    ]);
    expectAllowed(calls);
    expect(value.drillType).toBe("tech");
    expect(value.today).toBe(seoulToday);

    const bank: SelectableQuestion[] = [
      ...publicTechQuestions.map((q) => ({ ...q, sourceScope: "public" as const })),
      { ...(personalQuestion as unknown as SelectableQuestion), sourceScope: "personal" },
    ];
    const expected = selectFromBank(bank, toDrillProgress(progressItems), { today: seoulToday, maxCount: 10 });
    expect(value.questions.map((q: { id: string }) => q.id)).toEqual(expected.map((q) => q.id));

    const personal = value.questions.find((q: { id: string }) => q.id === personalQuestion.id);
    expect(personal).toEqual({ ...personalQuestion, sourceScope: "personal", dueForReview: true });
    const due = value.questions.find((q: { id: string }) => q.id === firstPublic.id);
    expect(due?.sourceScope).toBe("public");
    expect(due?.dueForReview).toBe(true);
    for (const question of value.questions) {
      for (const key of ["normalizedFrom", "publicSafe", "source"])
        expect({ id: question.id, key, present: key in question }).toEqual({ id: question.id, key, present: false });
    }
  });

  test("count 를 주지 않으면 다섯 개까지 고른다", async () => {
    const { tools } = harness(respond);
    const value = parse(await tools.call("get_interview_questions", { drillType: "tech" }));
    expect(value.questions).toHaveLength(5);
  });
});

describe("save_interview_attempt", () => {
  const attempt = {
    drillType: "tech",
    questionId: "personal-retry-budget",
    topic: "personal-retry-budget",
    question: "재시도 예산을 어떻게 정했나요?",
    score: "shallow",
    feedback: "백오프 근거가 빠졌다",
  } as const;

  test("attemptId 없이 부르면 UUID 를 만들어 Idempotency-Key, 본문, 결과에 같은 값을 싣는다", async () => {
    const { calls, tools } = harness((call) =>
      json({
        attemptId: (call.body as { attemptId: string }).attemptId,
        evaluatedOn: seoulToday,
        progress: progressRow(attempt.topic, "2026-10-02", 1),
      }),
    );
    const result = await tools.call("save_interview_attempt", attempt);
    expect(result.isError).toBeUndefined();
    expect(calls).toHaveLength(1);
    expectAllowed(calls);
    const call = calls[0]!;
    expect(call.method).toBe("POST");
    const attemptId = (call.body as { attemptId: string }).attemptId;
    expect(attemptId).toMatch(uuidPattern);
    expect(call.key).toBe(attemptId);
    expect(call.body).toEqual({ ...attempt, attemptId });
    expect(parse(result).attemptId).toBe(attemptId);
  });

  test("fetch 가 던지면 CAREER_NETWORK 와 그때 쓴 attemptId 를 낸다", async () => {
    const { calls, tools } = harness(() => {
      throw new Error(`connect failed with ${token}`);
    });
    const result = await tools.call("save_interview_attempt", attempt);
    expect(result.isError).toBe(true);
    const value = parse(result);
    expect(value.error.code).toBe("CAREER_NETWORK");
    expect(value.attemptId).toBe(calls[0]!.key);
    expect(value.attemptId).toMatch(uuidPattern);
    expect(result.content[0].text).not.toContain(token);
    expect(result.content[0].text).not.toContain(attempt.question);
  });

  test("Backend 가 409 로 답하면 CAREER_ATTEMPT_PENDING 과 그때 쓴 attemptId 를 낸다", async () => {
    const attemptId = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
    const { calls, tools } = harness(() => json({ code: "VERSION_CONFLICT" }, 409));
    const result = await tools.call("save_interview_attempt", { ...attempt, attemptId });
    expect(result.isError).toBe(true);
    expect(parse(result)).toEqual({
      error: { code: "CAREER_ATTEMPT_PENDING", message: expect.any(String) },
      attemptId,
    });
    expect(calls.map((call) => call.key)).toEqual([attemptId]);
    expectAllowed(calls);
  });

  const brokenBody = () =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"attemptId":'));
        controller.error(new Error("stream reset"));
      },
    });
  const unreadableResponses: [string, () => Response][] = [
    ["잘린 JSON", () => new Response('{"attemptId":"', { status: 201 })],
    ["본문 스트림 실패", () => new Response(brokenBody(), { status: 201 })],
    ["스키마 불일치", () => json({ attemptId: 1, progress: null }, 201)],
  ];

  for (const [name, respond] of unreadableResponses) {
    test(`2xx 응답이 ${name}이면 CAREER_INVALID_RESPONSE 와 그때 쓴 attemptId 를 낸다`, async () => {
      const { calls, tools } = harness(respond);
      const result = await tools.call("save_interview_attempt", attempt);
      expect(result.isError).toBe(true);
      expect(calls).toHaveLength(1);
      expectAllowed(calls);
      const attemptId = calls[0]!.key;
      expect(attemptId).toMatch(uuidPattern);
      expect(parse(result)).toEqual({
        error: { code: "CAREER_INVALID_RESPONSE", message: expect.any(String) },
        attemptId,
      });
      const text = result.content[0].text;
      expect(text).not.toContain(token);
      expect(text).not.toContain(attempt.question);
      expect(text).not.toContain(attempt.feedback);
    });
  }

  test("응답을 읽지 못한 뒤 받은 attemptId 로 같은 인자를 다시 보내면 같은 Idempotency-Key 를 쓴다", async () => {
    let first = true;
    const { calls, tools } = harness((call) => {
      if (first) {
        first = false;
        return new Response('{"attemptId":"', { status: 201 });
      }
      return json({
        attemptId: (call.body as { attemptId: string }).attemptId,
        evaluatedOn: seoulToday,
        progress: progressRow(attempt.topic, "2026-10-02", 1),
      });
    });
    const failed = parse(await tools.call("save_interview_attempt", attempt));
    const retried = await tools.call("save_interview_attempt", { ...attempt, attemptId: failed.attemptId });
    expect(retried.isError).toBeUndefined();
    expect(calls.map((call) => call.key)).toEqual([failed.attemptId, failed.attemptId]);
    expect(calls[1]!.body).toEqual(calls[0]!.body);
    expect(parse(retried).attemptId).toBe(failed.attemptId);
  });
});

describe("save_personal_question", () => {
  test("question.id 경로로 PUT 하고 호출마다 새 personal-question 키를 쓴다", async () => {
    const { calls, tools } = harness(() =>
      json({
        questionId: personalQuestion.id,
        drillType: "tech",
        topic: personalQuestion.topic,
        enabled: false,
        updatedAt: "2026-10-01T00:00:00.000Z",
      }),
    );
    const args = { drillType: "tech", enabled: false, question: personalQuestion };
    const first = await tools.call("save_personal_question", args);
    await tools.call("save_personal_question", args);
    expect(first.isError).toBeUndefined();
    expect(parse(first).enabled).toBe(false);
    expect(calls).toHaveLength(2);
    expectAllowed(calls);
    for (const call of calls) {
      expect(call.method).toBe("PUT");
      expect(call.path).toBe(`/api/interview/v1/personal-questions/${personalQuestion.id}`);
      expect(call.body).toEqual(args);
      expect(call.key).toStartWith("personal-question:");
    }
    expect(calls[0]!.key).not.toBe(calls[1]!.key);
  });
});

describe("잘못된 입력은 fetch 없이 CAREER_INVALID_INPUT 이다", () => {
  const rejected = [
    ["get_interview_questions", { drillType: "tech", count: 11 }],
    ["get_interview_questions", { drillType: "tech", count: 0 }],
    ["get_interview_questions", { drillType: "tech", extra: true }],
    ["list_personal_questions", { drillType: "application" }],
    ["save_interview_attempt", { drillType: "tech", questionId: "q", topic: "t", question: "?", score: "pass", attemptId: "not-a-uuid" }],
    ["save_interview_attempt", { drillType: "tech", questionId: "q", topic: "t", question: "?", score: "pass", extra: 1 }],
    ["save_personal_question", { drillType: "tech", enabled: true, question: { ...personalQuestion, source: "x" } }],
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
});
