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

    const changed = { ...policy, staleAfterDays: 7 };
    await harness.send("PUT", "/api/positions/v1/analysis-policy", {
      body: changed,
      idempotencyKey: "policy-read-2",
    });
    const reread = await harness.send("GET", "/api/positions/v1/analysis-policy", {});
    expect(reread.json).toEqual(changed);
  });
});

/** 기준 버전은 position-preferences 문서 version 에서 계산하므로 정책이 받지도 저장하지도 않는다(ADR-134). */
describe("분석 정책은 기준 버전을 다루지 않는다", () => {
  it("저장한 정책에 candidateContextVersion 이 없다", async () => {
    const saved = await harness.send("PUT", "/api/positions/v1/analysis-policy", {
      body: policy,
      idempotencyKey: "policy-no-context-1",
    });
    expect(saved.status, "정책 저장 status").toBe(200);

    const read = await harness.send("GET", "/api/positions/v1/analysis-policy", {});
    expect(read.status, "정책 조회 status").toBe(200);
    expect(read.json, "조회한 정책 본문").toEqual(policy);
    expect(read.json, "조회한 정책 본문의 키").not.toHaveProperty("candidateContextVersion");

    const rows = await harness.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      "SELECT * FROM position_analysis_policy",
    );
    expect(rows, "저장된 정책 행 수").toHaveLength(1);
    expect(rows[0], "저장된 정책 행의 열").not.toHaveProperty("candidate_context_version");
  });

  it("candidateContextVersion 을 보낸 정책 요청은 400 이다", async () => {
    const reply = await harness.send("PUT", "/api/positions/v1/analysis-policy", {
      body: { ...policy, candidateContextVersion: "position-preferences:v1" },
      idempotencyKey: "policy-no-context-2",
    });
    expect(reply.status, "기준 버전을 담은 정책 요청 status").toBe(400);
    expect(reply.json, "기준 버전을 담은 정책 요청의 오류 코드").toMatchObject({
      error: { code: "BAD_REQUEST" },
    });

    const rows = await harness.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      "SELECT singleton_id FROM position_analysis_policy",
    );
    expect(rows, "거절한 요청 뒤의 정책 행").toEqual([]);
  });
});
