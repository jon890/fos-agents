import { expect, test } from "bun:test";
import { analysisPolicySchema } from "../../services/career-backend/src/positions/schema.ts";
import { analysisPolicyIdempotencyKey } from "./configure_position_analysis_policy.ts";

const policy = (overrides: Record<string, unknown> = {}) =>
  analysisPolicySchema.parse({
    schemaVersion: 2,
    dailyAnalysisLimit: 7,
    prioritySlots: 4,
    agingSlots: 3,
    staleAfterDays: 30,
    defaultCompanyTier: 2,
    dailyCompanyTierLimit: 5,
    companyTierStaleAfterDays: 90,
    ...overrides,
  });

test("같은 정책은 같은 멱등 키를 낸다", () => {
  expect(analysisPolicyIdempotencyKey(policy())).toBe(analysisPolicyIdempotencyKey(policy()));
});

test("staleAfterDays 만 다른 정책은 다른 멱등 키를 낸다", () => {
  expect(analysisPolicyIdempotencyKey(policy())).not.toBe(analysisPolicyIdempotencyKey(policy({ staleAfterDays: 14 })));
});

test("멱등 키는 analysis-policy: 뒤에 64자리 hex 가 온다", () => {
  expect(analysisPolicyIdempotencyKey(policy())).toMatch(/^analysis-policy:[0-9a-f]{64}$/);
});
