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

async function prepared() {
  await harness.replayGiven("ok-08-post-company-tier-results");
  const runs = await harness.prisma.$queryRaw<
    Array<{
      company_tier_run_id: string;
      collection_run_id: string;
    }>
  >`SELECT company_tier_run_id, collection_run_id FROM company_tier_assessment_runs`;
  const run = runs[0]!;
  const companies = await harness.prisma.$queryRaw<Array<{ company_key: string }>>`
    SELECT company_key FROM company_tier_assessment_run_items
    WHERE company_tier_run_id = ${run.company_tier_run_id} ORDER BY selection_order
  `;
  return {
    runId: run.company_tier_run_id,
    collectionRunId: run.collection_run_id,
    keys: companies.map((row) => row.company_key),
  };
}

function unknown(companyKey: string) {
  return {
    companyKey,
    recommendedTier: null,
    confidence: null,
    reason: "확인 가능한 회사 근거가 없다.",
    assessment: "추가 자료가 필요하다.",
    signals: ["growth-scope", "compensation-upside", "team-growth"].map((axis) => ({
      axis,
      level: "unknown",
      evidenceIds: [] as string[],
    })),
    evidence: [],
    assumptions: [],
  };
}

async function submit(runId: string, collectionRunId: string, results: unknown[], key: string) {
  return harness.send("POST", `/api/positions/v1/company-tier-runs/${runId}/results`, {
    idempotencyKey: key,
    body: { schemaVersion: 1, collectionRunId, results, failures: [] },
  });
}

describe("근거가 없는 회사 tier 평가", () => {
  it("빈 근거와 null 평가를 저장하고 공고에는 기본 tier를 쓴다", async () => {
    const { runId, collectionRunId, keys } = await prepared();
    const saved = await submit(runId, collectionRunId, keys.map(unknown), "unknown-all");
    expect(saved.status).toBe(200);
    const rows = await harness.prisma.$queryRaw<
      Array<{
        recommended_tier: number | null;
        confidence: string | null;
        assessment: string | null;
      }>
    >`SELECT recommended_tier, confidence, assessment FROM company_tier_assessments`;
    expect(rows).toHaveLength(keys.length);
    for (const row of rows)
      expect(row).toMatchObject({
        recommended_tier: null,
        confidence: null,
        assessment: "추가 자료가 필요하다.",
      });
    const queued = await harness.send(
      "POST",
      `/api/positions/v1/collection-runs/${collectionRunId}/analysis-runs`,
      {
        idempotencyKey: "unknown-analysis",
        body: { schemaVersion: 1 },
      },
    );
    expect(queued.status).toBe(201);
    const candidates = (queued.json as { candidates: Array<Record<string, unknown>> }).candidates;
    expect(candidates.length).toBeGreaterThan(0);
    const items = await harness.prisma.$queryRaw<
      Array<{
        company_tier_source: string;
        company_tier_assessment_id: string | null;
      }>
    >`SELECT company_tier_source, company_tier_assessment_id FROM position_analysis_run_items`;
    for (const item of items) {
      expect(item.company_tier_source).toBe("default");
      expect(item.company_tier_assessment_id).toBeNull();
    }
  });

  it("근거 ID 없이 등급을 매기면 거절한다", async () => {
    const { runId, collectionRunId, keys } = await prepared();
    const result = unknown(keys[0]!);
    result.signals[0]!.level = "high";
    expect((await submit(runId, collectionRunId, [result], "unknown-no-id")).status).toBe(400);
  });

  it("제출한 근거에 없는 ID를 연결하면 거절한다", async () => {
    const { runId, collectionRunId, keys } = await prepared();
    const result = unknown(keys[0]!);
    result.signals[0]!.level = "high";
    result.signals[0]!.evidenceIds = ["missing"];
    expect((await submit(runId, collectionRunId, [result], "unknown-bad-id")).status).toBe(400);
  });

  it("비공개 평가가 2000자를 넘으면 거절한다", async () => {
    const { runId, collectionRunId, keys } = await prepared();
    const result = { ...unknown(keys[0]!), assessment: "가".repeat(2001) };
    expect((await submit(runId, collectionRunId, [result], "unknown-long-assessment")).status).toBe(
      400,
    );
  });
});
