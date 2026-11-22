import { expect, test } from "bun:test";
import { analysisPolicyIdempotencyKey } from "./configure_position_analysis_policy.ts";

test("멱등 키는 호출마다 달라 같은 정책을 다시 넣어도 저장소가 반영한다", () => {
  const first = analysisPolicyIdempotencyKey();
  expect(first).toMatch(/^analysis-policy:[0-9a-f-]{36}$/);
  expect(analysisPolicyIdempotencyKey()).not.toBe(first);
});
