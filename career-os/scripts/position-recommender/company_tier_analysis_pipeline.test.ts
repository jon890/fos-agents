import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PostingCandidatePool } from "./live-postings/contracts.ts";
import { MemoryPositionRepository } from "../../services/recommendation-api/position/memory-repository.ts";
import { PositionService } from "../../services/recommendation-api/position/service.ts";
import {
  analysisQueueResponseSchema,
  companyTierQueueResponseSchema,
} from "../../services/recommendation-api/position/schema.ts";
import { preparePositionAnalysis } from "./prepare_position_analysis.ts";
import { completeCompanyTierAssessment } from "./complete_company_tier_assessment.ts";

const directories: string[] = [];

afterEach(() => {
  while (directories.length > 0) {
    rmSync(directories.pop()!, { recursive: true, force: true });
  }
});

function workspace(): string {
  const directory = mkdtempSync(join(tmpdir(), "company-tier-pipeline-"));
  directories.push(directory);
  return directory;
}

function writeJson(directory: string, name: string, value: unknown): string {
  const path = join(directory, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function pool(runId: string, companies: string[], collectedAt: string): PostingCandidatePool {
  return {
    schemaVersion: 1,
    collectionRunId: runId,
    collectedAt,
    requestedSource: "all",
    configuredSources: ["wanted"],
    policy: {
      selection: "llm",
      activeDirectOnly: true,
      fixedPreferenceKeywordsUsed: false,
      sourcePriorityUsed: false,
    },
    candidates: companies.map((company, index) => ({
      id: `wanted:${runId}-${index}`,
      source: "wanted",
      company,
      title: "Backend Engineer",
      url: `https://example.com/jobs/${runId}-${index}`,
      identityHash: `wanted:${runId}-${index}`,
      linkType: "direct_posting",
      postingStatus: "active",
      activeEvidence: "active",
      openedAt: "",
      closesAt: "",
      daysUntilClose: "",
      closeUrgency: "normal",
      category: "개발",
      summary: "서버 개발",
      tags: [],
      skills: ["Java"],
      dueTime: "",
      mainTasks: "서버 개발",
      requirements: "Java",
      preferred: "",
    })),
    sourceDiagnostics: [
      {
        source: "wanted",
        status: "ok",
        collectedCount: companies.length,
        importedCount: companies.length,
        skippedCount: 0,
        failedCount: 0,
        discoveryModes: ["broad"],
        message: "ok",
      },
    ],
    filterSummary: { personalExcludedCount: 0 },
    errors: [],
  };
}

async function backend(overrides: Partial<Record<string, number>> = {}) {
  const service = new PositionService(new MemoryPositionRepository());
  await service.configurePolicy({
    schemaVersion: 2,
    candidateContextVersion: "context-1",
    dailyAnalysisLimit: 20,
    prioritySlots: 16,
    agingSlots: 4,
    staleAfterDays: 30,
    defaultCompanyTier: 3,
    dailyCompanyTierLimit: overrides.dailyCompanyTierLimit ?? 1,
    companyTierStaleAfterDays: overrides.companyTierStaleAfterDays ?? 90,
  });
  const createClient = () => ({
    saveCollection: (body: unknown) => service.saveCollection(body, "2026-09-20T00:00:00.000Z"),
    createPositionAnalysisRun: (collectionRunId: string) =>
      service.createPositionAnalysisRun(collectionRunId, "2026-09-20T01:00:00.000Z"),
    saveCompanyTierResults: (companyTierRunId: string, body: unknown) =>
      service.saveCompanyTierResults(companyTierRunId, body, "2026-09-20T00:30:00.000Z"),
  });
  return { service, createClient };
}

function tierResult(companyKey: string, tier: number) {
  return {
    companyKey,
    recommendedTier: tier,
    confidence: "medium" as const,
    reason: "성장 신호를 확인했다.",
    signals: [
      { axis: "growth-scope" as const, level: "medium" as const },
      { axis: "compensation-upside" as const, level: "unknown" as const },
      { axis: "team-growth" as const, level: "unknown" as const },
    ],
    evidence: [
      {
        url: "https://example.com/news/1",
        checkedAt: "2026-09-20",
      },
    ],
  };
}

test("첫 실행은 상한만큼만 평가하고 나머지 회사를 기본 tier로 둔다", async () => {
  const { service, createClient } = await backend({ dailyCompanyTierLimit: 1 });
  const directory = workspace();
  const candidatesPath = writeJson(
    directory,
    "posting-candidates.json",
    pool("collection-1", ["회사 1", "회사 2", "회사 3"], "2026-09-20T00:00:00.000Z"),
  );
  const prepared = await preparePositionAnalysis(
    candidatesPath,
    join(directory, "company-tier-queue.json"),
    join(directory, "analysis-queue.json"),
    1,
    1,
    createClient,
  );
  expect(prepared.companyTierQueuedCount).toBe(1);
  expect(prepared.analysisRunId).toBeNull();
  const queue = companyTierQueueResponseSchema.parse(
    JSON.parse(readFileSync(join(directory, "company-tier-queue.json"), "utf8")),
  );
  expect(queue.companies).toHaveLength(1);
  expect(queue.companies[0].companyKey).toBe("회사 1");

  const updatesPath = writeJson(directory, "company-tier-updates.json", {
    schemaVersion: 1,
    collectionRunId: queue.collectionRunId,
    companyTierRunId: queue.companyTierRunId,
    results: [tierResult("회사 1", 1)],
    failures: [],
  });
  const completed = await completeCompanyTierAssessment(
    join(directory, "company-tier-queue.json"),
    updatesPath,
    join(directory, "analysis-queue.json"),
    createClient,
  );
  expect(completed.status).toBe("completed");
  expect(completed.analysisRunId).not.toBeNull();
  const analysisQueue = analysisQueueResponseSchema.parse(
    JSON.parse(readFileSync(join(directory, "analysis-queue.json"), "utf8")),
  );
  const byCompany = new Map(analysisQueue.candidates.map((c) => [c.posting.company, c]));
  expect(byCompany.get("회사 1")?.companyTier).toBe(1);
  expect(byCompany.get("회사 2")?.companyTier).toBe(3);
  expect(byCompany.get("회사 3")?.companyTier).toBe(3);
  void service;
});

test("둘째 실행은 전날 유효 평가를 다시 모델에 넘기지 않고 다른 신규 회사를 고른다", async () => {
  const { createClient } = await backend({ dailyCompanyTierLimit: 1 });
  const directory = workspace();
  const firstCandidates = writeJson(
    directory,
    "posting-candidates-1.json",
    pool("collection-1", ["회사 1", "회사 2"], "2026-09-20T00:00:00.000Z"),
  );
  await preparePositionAnalysis(
    firstCandidates,
    join(directory, "company-tier-queue-1.json"),
    join(directory, "analysis-queue-1.json"),
    1,
    1,
    createClient,
  );
  const queue1 = companyTierQueueResponseSchema.parse(
    JSON.parse(readFileSync(join(directory, "company-tier-queue-1.json"), "utf8")),
  );
  expect(queue1.companies.map((c) => c.companyKey)).toEqual(["회사 1"]);
  const updates1 = writeJson(directory, "company-tier-updates-1.json", {
    schemaVersion: 1,
    collectionRunId: queue1.collectionRunId,
    companyTierRunId: queue1.companyTierRunId,
    results: [tierResult("회사 1", 1)],
    failures: [],
  });
  await completeCompanyTierAssessment(
    join(directory, "company-tier-queue-1.json"),
    updates1,
    join(directory, "analysis-queue-1.json"),
    createClient,
  );

  const secondCandidates = writeJson(
    directory,
    "posting-candidates-2.json",
    pool("collection-2", ["회사 1", "회사 2"], "2026-09-21T00:00:00.000Z"),
  );
  await preparePositionAnalysis(
    secondCandidates,
    join(directory, "company-tier-queue-2.json"),
    join(directory, "analysis-queue-2.json"),
    1,
    1,
    createClient,
  );
  const queue2 = companyTierQueueResponseSchema.parse(
    JSON.parse(readFileSync(join(directory, "company-tier-queue-2.json"), "utf8")),
  );
  expect(queue2.companies.map((c) => c.companyKey)).toEqual(["회사 2"]);
});

test("모든 회사 평가가 유효하면 회사 모델 분석을 전혀 실행하지 않는다", async () => {
  const { createClient } = await backend({ dailyCompanyTierLimit: 5 });
  const directory = workspace();
  const candidatesPath = writeJson(
    directory,
    "posting-candidates-1.json",
    pool("collection-1", ["회사 1", "회사 2"], "2026-09-20T00:00:00.000Z"),
  );
  const prepared1 = await preparePositionAnalysis(
    candidatesPath,
    join(directory, "company-tier-queue-1.json"),
    join(directory, "analysis-queue-1.json"),
    1,
    1,
    createClient,
  );
  expect(prepared1.companyTierQueuedCount).toBe(2);
  const queue1 = companyTierQueueResponseSchema.parse(
    JSON.parse(readFileSync(join(directory, "company-tier-queue-1.json"), "utf8")),
  );
  const updates1 = writeJson(directory, "company-tier-updates-1.json", {
    schemaVersion: 1,
    collectionRunId: queue1.collectionRunId,
    companyTierRunId: queue1.companyTierRunId,
    results: [tierResult("회사 1", 1), tierResult("회사 2", 2)],
    failures: [],
  });
  await completeCompanyTierAssessment(
    join(directory, "company-tier-queue-1.json"),
    updates1,
    join(directory, "analysis-queue-1.json"),
    createClient,
  );

  const secondCandidates = writeJson(
    directory,
    "posting-candidates-2.json",
    pool("collection-2", ["회사 1", "회사 2"], "2026-09-21T00:00:00.000Z"),
  );
  const prepared2 = await preparePositionAnalysis(
    secondCandidates,
    join(directory, "company-tier-queue-2.json"),
    join(directory, "analysis-queue-2.json"),
    1,
    1,
    createClient,
  );
  expect(prepared2.companyTierQueuedCount).toBe(0);
  expect(prepared2.analysisRunId).not.toBeNull();
});

test("사람 override를 추가하면 기존 모델 tier가 있어도 다음 공고 큐와 추천에서 즉시 우선한다", async () => {
  const { service, createClient } = await backend({ dailyCompanyTierLimit: 5 });
  const directory = workspace();
  const candidatesPath = writeJson(
    directory,
    "posting-candidates-1.json",
    pool("collection-1", ["회사 1"], "2026-09-20T00:00:00.000Z"),
  );
  await preparePositionAnalysis(
    candidatesPath,
    join(directory, "company-tier-queue-1.json"),
    join(directory, "analysis-queue-1.json"),
    1,
    1,
    createClient,
  );
  const queue1 = companyTierQueueResponseSchema.parse(
    JSON.parse(readFileSync(join(directory, "company-tier-queue-1.json"), "utf8")),
  );
  const updates1 = writeJson(directory, "company-tier-updates-1.json", {
    schemaVersion: 1,
    collectionRunId: queue1.collectionRunId,
    companyTierRunId: queue1.companyTierRunId,
    results: [tierResult("회사 1", 2)],
    failures: [],
  });
  await completeCompanyTierAssessment(
    join(directory, "company-tier-queue-1.json"),
    updates1,
    join(directory, "analysis-queue-1.json"),
    createClient,
  );

  await service.updateCompanyPreference("회사 1", {
    companyKey: "회사 1",
    companyName: "회사 1",
    tier: 1,
    disposition: "analyze",
  });

  const secondCandidates = writeJson(
    directory,
    "posting-candidates-2.json",
    pool("collection-2", ["회사 1"], "2026-09-21T00:00:00.000Z"),
  );
  const prepared2 = await preparePositionAnalysis(
    secondCandidates,
    join(directory, "company-tier-queue-2.json"),
    join(directory, "analysis-queue-2.json"),
    1,
    1,
    createClient,
  );
  expect(prepared2.companyTierQueuedCount).toBe(0);
  const analysisQueue2 = analysisQueueResponseSchema.parse(
    JSON.parse(readFileSync(join(directory, "analysis-queue-2.json"), "utf8")),
  );
  expect(analysisQueue2.candidates[0].companyTier).toBe(1);
});

test("평가 전체 실패는 partial로 남고 기본 tier로 공고 큐를 만든다", async () => {
  const { createClient } = await backend({ dailyCompanyTierLimit: 5 });
  const directory = workspace();
  const candidatesPath = writeJson(
    directory,
    "posting-candidates.json",
    pool("collection-1", ["회사 1", "회사 2"], "2026-09-20T00:00:00.000Z"),
  );
  await preparePositionAnalysis(
    candidatesPath,
    join(directory, "company-tier-queue.json"),
    join(directory, "analysis-queue.json"),
    1,
    1,
    createClient,
  );
  const queue = companyTierQueueResponseSchema.parse(
    JSON.parse(readFileSync(join(directory, "company-tier-queue.json"), "utf8")),
  );
  const updates = writeJson(directory, "company-tier-updates.json", {
    schemaVersion: 1,
    collectionRunId: queue.collectionRunId,
    companyTierRunId: queue.companyTierRunId,
    results: [],
    failures: queue.companies.map((company) => ({
      companyKey: company.companyKey,
      failureCode: "research_unavailable" as const,
    })),
  });
  const completed = await completeCompanyTierAssessment(
    join(directory, "company-tier-queue.json"),
    updates,
    join(directory, "analysis-queue.json"),
    createClient,
  );
  expect(completed.status).toBe("partial");
  expect(completed.analysisRunId).not.toBeNull();
  const analysisQueue = analysisQueueResponseSchema.parse(
    JSON.parse(readFileSync(join(directory, "analysis-queue.json"), "utf8")),
  );
  for (const candidate of analysisQueue.candidates) {
    expect(candidate.companyTier).toBe(3);
  }
});
