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
