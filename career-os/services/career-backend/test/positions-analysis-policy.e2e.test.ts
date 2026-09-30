import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startE2eHarness, type E2eHarness } from "./support/e2e-harness.js";

let harness: E2eHarness;

beforeAll(async () => {
  harness = await startE2eHarness();
});

afterAll(async () => {
  await harness?.close();
});

beforeEach(async () => {
  await harness.clearAll();
});

const policy = {
  schemaVersion: 2,
  candidateContextVersion: "synthetic-context-1",
  dailyAnalysisLimit: 5,
  prioritySlots: 3,
  agingSlots: 2,
  staleAfterDays: 30,
  defaultCompanyTier: 2,
  dailyCompanyTierLimit: 5,
  companyTierStaleAfterDays: 90,
};

describe("포지션 분석 정책 조회", () => {
  it("정책이 없으면 409 POLICY_NOT_CONFIGURED 를 돌려준다", async () => {
    const reply = await harness.send("GET", "/api/positions/v1/analysis-policy", {});
    expect(reply.status).toBe(409);
    expect(reply.json).toMatchObject({ error: { code: "POLICY_NOT_CONFIGURED" } });
  });

  it("저장한 정책을 같은 값으로 돌려주고 다시 저장하면 새 값을 돌려준다", async () => {
    const saved = await harness.send("PUT", "/api/positions/v1/analysis-policy", {
      body: policy,
      idempotencyKey: "policy-read-1",
    });
    expect(saved.status).toBe(200);

    const read = await harness.send("GET", "/api/positions/v1/analysis-policy", {});
    expect(read.status).toBe(200);
    expect(read.json).toEqual(policy);

    const changed = { ...policy, candidateContextVersion: "synthetic-context-2", staleAfterDays: 7 };
    await harness.send("PUT", "/api/positions/v1/analysis-policy", {
      body: changed,
      idempotencyKey: "policy-read-2",
    });
    const reread = await harness.send("GET", "/api/positions/v1/analysis-policy", {});
    expect(reread.json).toEqual(changed);
  });
});
