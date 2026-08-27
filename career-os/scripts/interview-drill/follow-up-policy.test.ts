import { describe, expect, test } from "bun:test";
import { MAX_FOLLOW_UP_DEPTH, nextFollowUpAxis } from "./follow-up-policy.ts";

describe("꼬리질문 깊이 정책", () => {
  test("충분한 답변은 판단, 반례, 운영과 근거 경계까지 깊어진다", () => {
    expect(Array.from({ length: MAX_FOLLOW_UP_DEPTH }, (_, depth) => {
      return nextFollowUpAxis("pass", depth);
    })).toEqual(["decision", "counterexample", "operations", "evidence-boundary"]);
    expect(nextFollowUpAxis("pass", MAX_FOLLOW_UP_DEPTH)).toBeNull();
  });

  test("얕은 답변은 명확화와 판단까지만 확인한다", () => {
    expect(nextFollowUpAxis("shallow", 0)).toBe("clarification");
    expect(nextFollowUpAxis("shallow", 1)).toBe("decision");
    expect(nextFollowUpAxis("shallow", 2)).toBeNull();
  });

  test("틀린 답변은 한 번 좁혀 묻고 학습 항목으로 전환한다", () => {
    expect(nextFollowUpAxis("fail", 0)).toBe("clarification");
    expect(nextFollowUpAxis("fail", 1)).toBeNull();
  });
});

