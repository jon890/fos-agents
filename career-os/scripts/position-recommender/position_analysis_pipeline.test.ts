import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  analysisQueueResponseSchema,
  type AnalysisQueueResponse,
} from "../../services/recommendation-api/src/positions/schema.ts";
import { commitPositionAnalysis } from "./commit_position_analysis.ts";

/**
 * script 쪽 방어만 확인한다.
 *
 * 아래 둘은 Backend 를 부르기 전에 판정하므로 서비스 인스턴스가 필요 없다.
 * 서비스 동작은 `services/recommendation-api/test/` 의 e2e 검사가 실제 MySQL 위에서 확인한다.
 * client 와 응답 사이의 계약은 그쪽 `test/contract.e2e.test.ts` 가 확인한다.
 */

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

function posting(index: number) {
  return {
    id: `wanted:candidate-${index}`,
    source: "wanted",
    company: `회사 ${index}`,
    title: `Backend Engineer ${index}`,
    url: `https://example.com/jobs/${index}`,
    identityHash: `wanted:${index}`,
    linkType: "direct_posting" as const,
    postingStatus: "active" as const,
    activeEvidence: "active",
    openedAt: "",
    closesAt: "",
    daysUntilClose: "",
    closeUrgency: "normal" as const,
    category: "개발",
    summary: "서버 개발",
    tags: [],
    skills: ["Java"],
    dueTime: "",
    mainTasks: "서버 개발",
    requirements: "Java",
    preferred: "",
  };
}

/** Backend 가 내는 분석 대기열. 계약 schema 로 parse 해 형태를 보장한다. */
function queue(): AnalysisQueueResponse {
  return analysisQueueResponseSchema.parse({
    schemaVersion: 2,
    collectionRunId: "collection-1",
    analysisRunId: "analysis-1",
    generatedAt: "2026-09-17T01:00:00.000Z",
    candidates: [1, 2].map((index) => ({
      positionId: `position-${index}`,
      candidateId: `wanted:candidate-${index}`,
      contentHash: `sha256:content-${index}`,
      analysisStatus: "new",
      companyTier: index,
      resultStatus: "pending",
      posting: posting(index),
    })),
    summary: {
      activeCount: 2,
      reusedCount: 0,
      queuedCount: 2,
      pendingCount: 2,
      personalExcludedCount: 0,
      newCount: 2,
      changedCount: 0,
      staleCount: 0,
      completedCount: 0,
      failedCount: 0,
      warningSourceCount: 0,
    },
  });
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

/**
 * Backend 를 부르면 그 자리에서 드러나게 만든 stub 이다.
 *
 * 호출이 일어나면 `calls` 에 남고, 두 검사는 그 배열이 비어 있는 것을 단언한다.
 */
function stubClient() {
  const calls: string[] = [];
  return {
    calls,
    createClient: () => ({
      async saveAnalysisResults(analysisRunId: string): Promise<never> {
        calls.push(analysisRunId);
        throw new Error("Backend 를 부르기 전에 끝냈어야 한다.");
      },
    }),
  };
}

test("큐에 남은 공고를 빠뜨리면 Backend를 부르기 전에 끝낸다", async () => {
  const current = queue();
  const { calls, createClient } = stubClient();
  const directory = workspace();
  const queuePath = writeJson(directory, "analysis-queue.json", current);
  const inputPath = writeJson(directory, "analysis-updates.json", {
    schemaVersion: 2,
    collectionRunId: current.collectionRunId,
    analysisRunId: current.analysisRunId,
    results: [analysisResult(current.candidates[0].positionId)],
    failures: [],
  });
  await expect(commitPositionAnalysis(queuePath, inputPath, createClient)).rejects.toThrow(
    current.candidates[1].positionId,
  );
  expect(calls, "Backend 호출 기록").toHaveLength(0);
});

test("같은 공고를 결과와 실패에 함께 담으면 제출하지 않는다", async () => {
  const current = queue();
  const { calls, createClient } = stubClient();
  const directory = workspace();
  const queuePath = writeJson(directory, "analysis-queue.json", current);
  const inputPath = writeJson(directory, "analysis-updates.json", {
    schemaVersion: 2,
    collectionRunId: current.collectionRunId,
    analysisRunId: current.analysisRunId,
    results: current.candidates.map((candidate) => analysisResult(candidate.positionId)),
    failures: [{ positionId: current.candidates[0].positionId, failureCode: "internal_error" }],
  });
  await expect(commitPositionAnalysis(queuePath, inputPath, createClient)).rejects.toThrow(
    "분석 결과와 실패 보고에 같은 공고가 함께 있습니다",
  );
  expect(calls, "Backend 호출 기록").toHaveLength(0);
});
