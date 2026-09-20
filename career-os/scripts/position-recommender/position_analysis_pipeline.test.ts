import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PostingCandidatePool } from "./live-postings/contracts.ts";
import {
  analysisQueueResponseSchema,
  analysisResultsRequestSchema,
  type AnalysisQueueResponse,
} from "../../services/recommendation-api/position/schema.ts";
import { MemoryPositionRepository } from "../../services/recommendation-api/position/memory-repository.ts";
import { PositionService } from "../../services/recommendation-api/position/service.ts";
import { commitPositionAnalysis } from "./commit_position_analysis.ts";

const directories: string[] = [];

afterEach(() => {
  while (directories.length > 0) {
    rmSync(directories.pop()!, { recursive: true, force: true });
  }
});

function workspace(): string {
  const directory = mkdtempSync(join(tmpdir(), "position-analysis-pipeline-"));
  directories.push(directory);
  return directory;
}

function writeJson(directory: string, name: string, value: unknown): string {
  const path = join(directory, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function pool(runId: string): PostingCandidatePool {
  return {
    schemaVersion: 1,
    collectionRunId: runId,
    collectedAt: "2026-09-17T00:00:00.000Z",
    requestedSource: "all",
    configuredSources: ["wanted"],
    policy: {
      selection: "llm",
      activeDirectOnly: true,
      fixedPreferenceKeywordsUsed: false,
      sourcePriorityUsed: false,
    },
    candidates: [1, 2].map((index) => ({
      id: `wanted:candidate-${index}`,
      source: "wanted",
      company: `회사 ${index}`,
      title: `Backend Engineer ${index}`,
      url: `https://example.com/jobs/${index}`,
      identityHash: `wanted:${index}`,
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
        collectedCount: 2,
        importedCount: 2,
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

function analysisResult(positionId: string) {
  return {
    positionId,
    decision: "recommend" as const,
    fitScore: 80,
    scoreBreakdown: { roleFit: 35, scopeUpside: 20, companyOpportunity: 15, constraints: 10 },
    reason: "현재 경험을 확장할 수 있다.",
    details: [],
    nextActions: [],
  };
}

async function backend() {
  const service = new PositionService(new MemoryPositionRepository());
  await service.configurePolicy({
    schemaVersion: 1,
    candidateContextVersion: "context-1",
    dailyAnalysisLimit: 20,
    prioritySlots: 16,
    agingSlots: 4,
    staleAfterDays: 30,
    defaultCompanyTier: 3,
  });
  const queue = await service.saveCollection(
    { schemaVersion: 2, analysisContractVersion: 1, pool: pool("collection-1") },
    "2026-09-17T01:00:00.000Z",
  );
  const idempotencyKeys: string[] = [];
  const createClient = () => ({
    async saveAnalysisResults(analysisRunId: string, body: unknown, idempotencyKey: string) {
      idempotencyKeys.push(idempotencyKey);
      return service.saveAnalysisResults(analysisRunId, body, "2026-09-17T02:00:00.000Z");
    },
  });
  const currentQueue = async (): Promise<AnalysisQueueResponse> =>
    analysisQueueResponseSchema.parse(await service.getRun(queue.analysisRunId));
  return { service, queue, idempotencyKeys, createClient, currentQueue };
}

test("fresh 반복 실행은 빈 분석 큐와 재사용 집계를 허용한다", () => {
  const queue = analysisQueueResponseSchema.parse({
    schemaVersion: 2,
    collectionRunId: "collection-2",
    analysisRunId: "analysis-2",
    generatedAt: "2026-09-18T00:00:00.000Z",
    candidates: [],
    summary: {
      activeCount: 10,
      reusedCount: 10,
      queuedCount: 0,
      pendingCount: 0,
      personalExcludedCount: 2,
      newCount: 0,
      changedCount: 0,
      staleCount: 0,
      completedCount: 0,
      failedCount: 0,
      warningSourceCount: 0,
    },
  });
  const updates = analysisResultsRequestSchema.parse({
    schemaVersion: 2,
    collectionRunId: queue.collectionRunId,
    results: [],
  });
  expect(queue.candidates).toHaveLength(0);
  expect(queue.summary.reusedCount).toBe(10);
  expect(updates.results).toHaveLength(0);
  expect(updates.failures).toHaveLength(0);
});

test("실패 한 건을 함께 보내면 실행이 partial로 남고 남은 건만 다시 보낸다", async () => {
  const { queue, idempotencyKeys, createClient, currentQueue } = await backend();
  const directory = workspace();
  const [analyzed, failed] = queue.candidates;

  const firstQueuePath = writeJson(directory, "analysis-queue.json", queue);
  const firstInputPath = writeJson(directory, "analysis-updates.json", {
    schemaVersion: 2,
    collectionRunId: queue.collectionRunId,
    analysisRunId: queue.analysisRunId,
    results: [analysisResult(analyzed.positionId)],
    failures: [{ positionId: failed.positionId, failureCode: "model_unavailable" }],
  });
  const first = await commitPositionAnalysis(firstQueuePath, firstInputPath, createClient);
  expect(first).toMatchObject({
    passed: true,
    status: "partial",
    createdCount: 1,
    failedCount: 1,
    remainingCount: 1,
    applied: true,
  });

  const retryQueue = await currentQueue();
  expect(retryQueue.summary.failedCount).toBe(1);
  const retryQueuePath = writeJson(directory, "analysis-queue-2.json", retryQueue);
  const retryInputPath = writeJson(directory, "analysis-updates-2.json", {
    schemaVersion: 2,
    collectionRunId: queue.collectionRunId,
    analysisRunId: queue.analysisRunId,
    results: [analysisResult(failed.positionId)],
    failures: [],
  });
  const retry = await commitPositionAnalysis(retryQueuePath, retryInputPath, createClient);
  expect(retry).toMatchObject({
    passed: true,
    status: "completed",
    createdCount: 2,
    failedCount: 0,
    remainingCount: 0,
    applied: true,
  });
  expect(idempotencyKeys).toHaveLength(2);
  expect(idempotencyKeys[0]).not.toBe(idempotencyKeys[1]);
  expect(
    idempotencyKeys.every((key) => key.startsWith(`analysis-results:${queue.analysisRunId}:`)),
  ).toBe(true);
});

test("큐에 남은 공고를 빠뜨리면 Backend를 부르기 전에 끝낸다", async () => {
  const { queue, idempotencyKeys, createClient } = await backend();
  const directory = workspace();
  const queuePath = writeJson(directory, "analysis-queue.json", queue);
  const inputPath = writeJson(directory, "analysis-updates.json", {
    schemaVersion: 2,
    collectionRunId: queue.collectionRunId,
    analysisRunId: queue.analysisRunId,
    results: [analysisResult(queue.candidates[0].positionId)],
    failures: [],
  });
  await expect(commitPositionAnalysis(queuePath, inputPath, createClient)).rejects.toThrow(
    queue.candidates[1].positionId,
  );
  expect(idempotencyKeys).toHaveLength(0);
});

test("같은 공고를 결과와 실패에 함께 담으면 제출하지 않는다", async () => {
  const { queue, idempotencyKeys, createClient } = await backend();
  const directory = workspace();
  const queuePath = writeJson(directory, "analysis-queue.json", queue);
  const inputPath = writeJson(directory, "analysis-updates.json", {
    schemaVersion: 2,
    collectionRunId: queue.collectionRunId,
    analysisRunId: queue.analysisRunId,
    results: queue.candidates.map((candidate) => analysisResult(candidate.positionId)),
    failures: [{ positionId: queue.candidates[0].positionId, failureCode: "internal_error" }],
  });
  await expect(commitPositionAnalysis(queuePath, inputPath, createClient)).rejects.toThrow(
    "분석 결과와 실패 보고에 같은 공고가 함께 있습니다",
  );
  expect(idempotencyKeys).toHaveLength(0);
});
