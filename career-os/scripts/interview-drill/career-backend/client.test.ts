import { expect, test } from "bun:test";
import { CareerBackendHttpError } from "../../lib/career-backend-http.ts";
import { InterviewBackendClient } from "./client.ts";

const body = {
  attemptId: "11111111-1111-4111-8111-111111111111",
  drillType: "tech" as const,
  questionId: "question-1",
  topic: "transaction",
  question: "트랜잭션을 설명해 주세요.",
  score: "pass" as const,
};
test("기록 요청은 경로와 인증, 멱등 헤더를 보낸다", async () => {
  let input: string | URL | Request | undefined;
  let init: RequestInit | undefined;
  const client = new InterviewBackendClient({
    baseUrl: "http://example.test/",
    token: "a".repeat(32),
    fetcher: async (value, request) => {
      input = value;
      init = request;
      return Response.json({
        attemptId: body.attemptId,
        evaluatedOn: "2026-08-13",
        progress: {
          drillType: "tech",
          topic: "transaction",
          passCount: 1,
          failCount: 0,
          nextReviewDate: "2026-08-14",
          lastPassedDate: "2026-08-13",
        },
      });
    },
  });
  await client.recordAttempt(body);
  expect(String(input)).toBe("http://example.test/api/interview/v1/attempts");
  expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${"a".repeat(32)}`);
  expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(body.attemptId);
});
test("네트워크 오류는 NETWORK_ERROR로 바꾼다", async () => {
  const client = new InterviewBackendClient({
    baseUrl: "http://example.test/",
    token: "a".repeat(32),
    fetcher: async () => {
      throw new Error("offline");
    },
  });
  await expect(client.recordAttempt(body)).rejects.toMatchObject({
    code: "NETWORK_ERROR",
  } satisfies Partial<CareerBackendHttpError>);
});

test("개인 질문 저장은 호출마다 새 멱등 키를 쓰고 재시도에는 같은 키를 쓴다", async () => {
  const keys: string[] = [];
  let calls = 0;
  const question = {
    id: "personal-1",
    topic: "ownership",
    category: "behavioral",
    difficulty: "basic" as const,
    question: "주도한 경험을 말씀해 주세요.",
    intent: "주도성 확인",
    answerSignals: ["본인 행동"],
  };
  const client = new InterviewBackendClient({
    baseUrl: "http://example.test/",
    token: "a".repeat(32),
    fetcher: async (_value, request) => {
      calls += 1;
      keys.push(new Headers(request?.headers).get("Idempotency-Key") ?? "");
      if (calls === 1) return Response.json({ error: { code: "DATABASE_UNAVAILABLE", message: "x" } }, { status: 503 });
      return Response.json({
        questionId: question.id,
        drillType: "behavioral",
        topic: question.topic,
        enabled: true,
        updatedAt: "2026-09-27T00:00:00.000Z",
      });
    },
  });
  const body = { enabled: true, drillType: "behavioral" as const, question };
  await client.upsertPersonalQuestion(question.id, body);
  await client.upsertPersonalQuestion(question.id, body);
  expect(keys).toHaveLength(3);
  expect(keys[0]).toBe(keys[1]);
  expect(keys[2]).not.toBe(keys[0]);
  for (const key of keys) expect(key.startsWith("personal-question:")).toBe(true);
});
