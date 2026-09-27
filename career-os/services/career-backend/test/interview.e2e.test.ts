import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { InterviewClock } from "../src/interview/interview.service.js";
import { startE2eHarness, type E2eHarness } from "./support/e2e-harness.js";

let harness: E2eHarness;

beforeAll(async () => {
  harness = await startE2eHarness();
  harness.app.get(InterviewClock).now = () => new Date("2026-09-27T15:30:00Z");
});

afterAll(async () => {
  await harness?.close();
});

beforeEach(async () => {
  await harness.clearAll();
});

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    attemptId: "00000000-0000-4000-8000-000000000001",
    drillType: "tech",
    questionId: "q1",
    topic: "transaction",
    question: "동시 기록을 어떻게 안전하게 처리합니까?",
    score: "pass",
    ...overrides,
  };
}

function question(overrides: Record<string, unknown> = {}) {
  return {
    id: "q1",
    topic: "decision",
    category: "behavioral",
    difficulty: "intermediate",
    question: "중요한 기술 결정을 어떻게 내렸습니까?",
    intent: "판단 근거를 확인한다.",
    answerSignals: ["제약", "대안"],
    ...overrides,
  };
}

describe("면접 연습 API", () => {
  it("빈 진행 상태를 빈 목록으로 돌려준다", async () => {
    const reply = await harness.send("GET", "/api/interview/v1/progress?drillType=tech");

    expect(reply.status).toBe(200);
    expect(reply.json).toEqual({ items: [] });
  });

  it("통과 기록과 주제 진행 상태를 같은 요청으로 저장한다", async () => {
    const reply = await harness.send("POST", "/api/interview/v1/attempts", {
      body: attempt(),
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    });

    expect(reply.status).toBe(201);
    expect(reply.json).toEqual({
      attemptId: "00000000-0000-4000-8000-000000000001",
      evaluatedOn: "2026-09-28",
      progress: {
        drillType: "tech",
        topic: "transaction",
        passCount: 1,
        failCount: 0,
        nextReviewDate: "2026-09-29",
        lastPassedDate: "2026-09-28",
      },
    });

    const progress = await harness.send("GET", "/api/interview/v1/progress?drillType=tech");
    expect(progress.json).toEqual({ items: [(reply.json as { progress: unknown }).progress] });
  });

  it("같은 멱등 키와 본문을 다시 보내도 진행 상태를 한 번만 반영한다", async () => {
    const body = attempt();
    const options = { body, idempotencyKey: "00000000-0000-4000-8000-000000000001" };
    const first = await harness.send("POST", "/api/interview/v1/attempts", options);
    const retry = await harness.send("POST", "/api/interview/v1/attempts", options);

    expect(retry.json).toEqual(first.json);
    const progress = await harness.send("GET", "/api/interview/v1/progress?drillType=tech");
    expect(progress.json).toMatchObject({ items: [{ passCount: 1 }] });
  });

  it("멱등 키와 attemptId가 다르면 400으로 거부한다", async () => {
    const reply = await harness.send("POST", "/api/interview/v1/attempts", {
      body: attempt(),
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
    });

    expect(reply.status).toBe(400);
    expect(reply.json).toMatchObject({ error: { code: "BAD_REQUEST" } });
  });

  it("서로 다른 기록을 같은 주제에 동시에 남겨도 모두 반영한다", async () => {
    const replies = await Promise.all([
      harness.send("POST", "/api/interview/v1/attempts", {
        body: attempt(), idempotencyKey: "00000000-0000-4000-8000-000000000001",
      }),
      harness.send("POST", "/api/interview/v1/attempts", {
        body: attempt({ attemptId: "00000000-0000-4000-8000-000000000002" }),
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
      }),
    ]);

    expect(replies.map((reply) => reply.status)).toEqual([201, 201]);
    const progress = await harness.send("GET", "/api/interview/v1/progress?drillType=tech");
    expect(progress.json).toMatchObject({ items: [{ passCount: 2 }] });
  });

  it("기존 주제에도 동시에 남긴 두 기록을 모두 반영한다", async () => {
    await harness.send("POST", "/api/interview/v1/attempts", {
      body: attempt(), idempotencyKey: "00000000-0000-4000-8000-000000000001",
    });

    const replies = await Promise.all([
      harness.send("POST", "/api/interview/v1/attempts", {
        body: attempt({ attemptId: "00000000-0000-4000-8000-000000000002" }),
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
      }),
      harness.send("POST", "/api/interview/v1/attempts", {
        body: attempt({ attemptId: "00000000-0000-4000-8000-000000000003" }),
        idempotencyKey: "00000000-0000-4000-8000-000000000003",
      }),
    ]);

    expect(replies.map((reply) => reply.status)).toEqual([201, 201]);
    const progress = await harness.send("GET", "/api/interview/v1/progress?drillType=tech");
    expect(progress.json).toMatchObject({ items: [{ passCount: 3 }] });
  });

  it("개인 질문을 켜고 끄며 목록은 켜진 질문만 돌려준다", async () => {
    const body = { enabled: true, drillType: "behavioral", question: question() };
    const saved = await harness.send("PUT", "/api/interview/v1/personal-questions/q1", {
      body,
      idempotencyKey: "personal-question-enabled",
    });
    expect(saved.status).toBe(200);
    const enabled = await harness.send("GET", "/api/interview/v1/personal-questions?drillType=behavioral");
    expect(enabled.json).toEqual({ items: [question()] });

    const disabled = await harness.send("PUT", "/api/interview/v1/personal-questions/q1", {
      body: { ...body, enabled: false },
      idempotencyKey: "personal-question-disabled",
    });
    expect(disabled.status).toBe(200);
    const listed = await harness.send("GET", "/api/interview/v1/personal-questions?drillType=behavioral");
    expect(listed.json).toEqual({ items: [] });
  });

  it("같은 개인 질문을 동시에 고쳐도 각 응답은 자기 요청 값을 돌려준다", async () => {
    const first = { enabled: true, drillType: "behavioral", question: question({ topic: "first" }) };
    const second = { enabled: false, drillType: "tech", question: question({ topic: "second" }) };
    const replies = await Promise.all([
      harness.send("PUT", "/api/interview/v1/personal-questions/q1", {
        body: first, idempotencyKey: "personal-question-first",
      }),
      harness.send("PUT", "/api/interview/v1/personal-questions/q1", {
        body: second, idempotencyKey: "personal-question-second",
      }),
    ]);

    expect(replies[0].json).toMatchObject({ drillType: first.drillType, topic: first.question.topic, enabled: first.enabled });
    expect(replies[1].json).toMatchObject({ drillType: second.drillType, topic: second.question.topic, enabled: second.enabled });
  });

  it("개인 질문의 경로 ID와 알 수 없는 칸을 거부한다", async () => {
    const idMismatch = await harness.send("PUT", "/api/interview/v1/personal-questions/q1", {
      body: { enabled: true, drillType: "behavioral", question: question({ id: "q2" }) },
      idempotencyKey: "personal-question-mismatch",
    });
    const unknownField = await harness.send("PUT", "/api/interview/v1/personal-questions/q1", {
      body: { enabled: true, drillType: "behavioral", question: question({ unexpected: true }) },
      idempotencyKey: "personal-question-unknown",
    });

    expect(idMismatch.status).toBe(400);
    expect(unknownField.status).toBe(400);
  });
});
