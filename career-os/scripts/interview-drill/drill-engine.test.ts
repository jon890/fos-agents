import { describe, expect, test } from "bun:test";
import { type DrillQuestion, updateDrillProgressState } from "./drill-engine.ts";

const question: DrillQuestion = {
  id: "test-1",
  topic: "transaction",
  category: "database",
  difficulty: "basic",
  question: "트랜잭션을 설명해 주세요.",
  intent: "기본 이해 확인",
  answerSignals: ["원자성"],
};

describe("답변 연습 복습 상태", () => {
  test("첫 통과는 하루 뒤, 두 번째 통과는 사흘 뒤에 복습한다", () => {
    const first = updateDrillProgressState({}, question, "pass", "2026-08-13");
    expect(first.transaction?.next_review_date).toBe("2026-08-14");

    const second = updateDrillProgressState(first, question, "pass", "2026-08-14");
    expect(second.transaction?.next_review_date).toBe("2026-08-17");
  });

  test("실패한 질문은 다음 날 다시 복습한다", () => {
    const progress = updateDrillProgressState({}, question, "fail", "2026-08-13");
    expect(progress.transaction).toMatchObject({ fail_count: 1, next_review_date: "2026-08-14" });
  });
});
