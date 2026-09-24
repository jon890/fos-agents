import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AnalysisQueueResponse } from "../../services/recommendation-api/src/positions/schema.ts";
import {
  commitAnalysesForRun,
  runPositionCommand,
  type PositionRunOperations,
} from "./position_run.ts";
import { runDirectoryPaths, type RunDirectoryPaths } from "./run-dir.ts";

const directories: string[] = [];

afterEach(() => {
  while (directories.length > 0) {
    rmSync(directories.pop()!, { recursive: true, force: true });
  }
});

function workspace(): string {
  const directory = mkdtempSync(join(tmpdir(), "position-run-test-"));
  directories.push(directory);
  return directory;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function analysisQueue(secret = "공개하지 않을 회사명과 공고 본문") {
  return {
    schemaVersion: 2 as const,
    collectionRunId: "collection-1",
    analysisRunId: "analysis-1",
    generatedAt: "2026-09-23T00:00:00.000Z",
    candidates: [
      {
        positionId: "position-1",
        candidateId: "wanted:1",
        contentHash: "sha256:content-1",
        analysisStatus: "new" as const,
        companyTier: 1,
        resultStatus: "pending" as const,
        posting: {
          id: "wanted:1",
          source: "wanted" as const,
          company: secret,
          title: "Backend Engineer",
          url: "https://example.com/jobs/1",
          identityHash: "wanted:1",
          linkType: "direct_posting" as const,
          postingStatus: "active" as const,
          activeEvidence: "active",
          openedAt: "",
          closesAt: "",
          daysUntilClose: "",
          closeUrgency: "normal" as const,
          category: "개발",
          summary: secret,
          tags: [],
          skills: ["Java"],
          dueTime: "",
          mainTasks: secret,
          requirements: "Java",
          preferred: "",
        },
      },
    ],
    summary: {
      activeCount: 1,
      reusedCount: 0,
      queuedCount: 1,
      pendingCount: 1,
      personalExcludedCount: 0,
      newCount: 1,
      changedCount: 0,
      staleCount: 0,
      completedCount: 0,
      failedCount: 0,
      warningSourceCount: 0,
    },
  };
}

function analysisResult(positionId: string) {
  return {
    positionId,
    decision: "recommend" as const,
    fitScore: 80,
    scoreBreakdown: {
      roleFit: 35,
      scopeUpside: 20,
      companyOpportunity: 15,
      constraints: 10,
    },
    reason: "확인된 경험과 역할이 맞는다.",
    details: [],
    nextActions: [],
  };
}

function operations(overrides: Partial<PositionRunOperations> = {}): PositionRunOperations {
  return {
    async collect() {
      return 0;
    },
    async prepare(paths) {
      writeJson(paths.analysisQueue, analysisQueue());
      return {
        passed: true,
        collectionRunId: "collection-1",
        companyTierRunId: "company-tier-1",
        companyTierQueuedCount: 0,
        analysisRunId: "analysis-1",
        candidatePoolBytes: 1,
        candidateCount: 1,
        queueBodyBytes: 1,
        ...analysisQueue().summary,
        output: paths.analysisQueue,
      };
    },
    async commitCompanyTiers(paths) {
      writeJson(paths.analysisQueue, analysisQueue());
      return {
        passed: true,
        companyTierRunId: "company-tier-1",
        status: "completed",
        createdCount: 1,
        reusedCount: 0,
        failedCount: 0,
        remainingCount: 0,
        applied: true,
        analysisRunId: "analysis-1",
        analysisQueueOutput: paths.analysisQueue,
      };
    },
    async commitAnalyses() {
      return {
        passed: true,
        idempotencyKey: "analysis-results:key",
        analysisRunId: "analysis-1",
        status: "completed",
        createdCount: 1,
        reusedCount: 0,
        failedCount: 0,
        remainingCount: 0,
        applied: true,
      };
    },
    async finalize() {
      return {
        recommendationRunId: "recommendation-1",
        rankingCount: 1,
        activeCount: 1,
        analyzedNowCount: 1,
        reusedCount: 0,
        pendingCount: 0,
        personalExcludedCount: 0,
        failedCount: 0,
        warningSourceCount: 0,
        unknownCompanyCounts: { "growth-scope": 0, "team-growth": 0, "compensation-upside": 0 },
        collectionWarnings: [],
        outputJson: "recommendation",
        outputHtml: "report",
      };
    },
    ...overrides,
  };
}

test("collect는 --run이 없으면 임시 디렉터리를 만들고 첫 줄에 경로를 낸다", async () => {
  const lines: string[] = [];
  const exitCode = await runPositionCommand(["collect"], {
    operations: operations(),
    createRunDirectory: () => workspace(),
    writeLine: (line) => lines.push(line),
  });

  expect(exitCode).toBe(0);
  expect(existsSync(lines[0])).toBe(true);
  expect(lines[0]).toStartWith(tmpdir());
  expect(lines.join("\n")).toContain(runDirectoryPaths(lines[0]).analysisUpdates);
});

test.each([
  { companyCount: 1, expected: "companyTierQueue", absent: "analysisQueue" },
  { companyCount: 0, expected: "analysisQueue", absent: "companyTierQueue" },
] as const)("collect는 다음 단계 큐 하나만 남긴다: $expected", async (current) => {
  const directory = workspace();
  const paths = runDirectoryPaths(directory);
  writeJson(paths[current.absent], { stale: true });

  await runPositionCommand(["collect", "--run", directory], {
    operations: operations({
      async prepare(runPaths) {
        writeJson(runPaths[current.expected], { prepared: true });
        return {
          passed: true,
          collectionRunId: "collection-1",
          companyTierRunId: "company-tier-1",
          companyTierQueuedCount: current.companyCount,
          analysisRunId: current.companyCount === 0 ? "analysis-1" : null,
          candidatePoolBytes: 1,
          candidateCount: 1,
          queueBodyBytes: 1,
          activeCount: 1,
          reusedCount: 0,
          queuedCount: 1,
          pendingCount: 1,
          personalExcludedCount: 0,
          newCount: 1,
          changedCount: 0,
          staleCount: 0,
          completedCount: 0,
          failedCount: 0,
          warningSourceCount: 0,
          output: runPaths[current.expected],
        };
      },
    }),
    writeLine: () => undefined,
  });

  expect(existsSync(paths[current.expected])).toBe(true);
  expect(existsSync(paths[current.absent])).toBe(false);
});

test("commit-company-tiers는 갱신 파일이 없으면 경로와 작성할 내용을 알리고 1로 끝난다", async () => {
  const directory = workspace();
  const child = Bun.spawn(
    [
      process.execPath,
      join(import.meta.dir, "position_run.ts"),
      "commit-company-tiers",
      "--run",
      directory,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);

  expect(exitCode).toBe(1);
  expect(stderr).toContain(runDirectoryPaths(directory).companyTierUpdates);
  expect(stderr).toContain("회사 판정 결과");
});

test("commit-analyses가 partial이면 남은 건수와 같은 명령 재실행을 알린다", async () => {
  const directory = workspace();
  const paths = runDirectoryPaths(directory);
  writeJson(paths.analysisUpdates, {});
  writeJson(paths.analysisQueue, analysisQueue());
  const lines: string[] = [];

  await runPositionCommand(["commit-analyses", "--run", directory], {
    operations: operations({
      async commitAnalyses() {
        return {
          passed: true,
          idempotencyKey: "analysis-results:key",
          analysisRunId: "analysis-1",
          status: "partial",
          createdCount: 1,
          reusedCount: 0,
          failedCount: 1,
          remainingCount: 2,
          applied: true,
        };
      },
    }),
    writeLine: (line) => lines.push(line),
  });

  expect(lines.join("\n")).toContain("남은 2건");
  expect(lines.join("\n")).toContain("같은 명령을 다시 실행");
  expect(lines.join("\n")).toContain(paths.analysisUpdates);
});

test("commit-analyses는 partial 뒤 최신 큐를 저장해 남은 항목만 다시 받는다", async () => {
  const directory = workspace();
  const paths = runDirectoryPaths(directory);
  const initial = analysisQueue();
  const secondCandidate = {
    ...structuredClone(initial.candidates[0]),
    positionId: "position-2",
    candidateId: "wanted:2",
    contentHash: "sha256:content-2",
    posting: {
      ...structuredClone(initial.candidates[0].posting),
      id: "wanted:2",
      url: "https://example.com/jobs/2",
      identityHash: "wanted:2",
    },
  };
  initial.candidates.push(secondCandidate);
  initial.summary.activeCount = 2;
  initial.summary.queuedCount = 2;
  initial.summary.pendingCount = 2;
  initial.summary.newCount = 2;
  writeJson(paths.analysisQueue, initial);
  writeJson(paths.analysisUpdates, {
    schemaVersion: 2,
    collectionRunId: initial.collectionRunId,
    analysisRunId: initial.analysisRunId,
    results: [analysisResult("position-1")],
    failures: [{ positionId: "position-2", failureCode: "model_unavailable" }],
  });

  const bodies: unknown[] = [];
  let attempt = 0;
  const latest: AnalysisQueueResponse = structuredClone(initial);
  latest.candidates[0].resultStatus = "created";
  latest.candidates[1].resultStatus = "failed";
  const client = {
    async saveAnalysisResults(_analysisRunId: string, body: unknown) {
      bodies.push(body);
      attempt += 1;
      return {
        analysisRunId: "analysis-1",
        status: attempt === 1 ? ("partial" as const) : ("completed" as const),
        createdCount: attempt,
        reusedCount: 0,
        failedCount: attempt === 1 ? 1 : 0,
        remainingCount: attempt === 1 ? 1 : 0,
        applied: true,
      };
    },
    async getRun() {
      return latest;
    },
  };

  await commitAnalysesForRun(paths, client);
  expect(JSON.parse(readFileSync(paths.analysisQueue, "utf8"))).toEqual(latest);

  writeJson(paths.analysisUpdates, {
    schemaVersion: 2,
    collectionRunId: initial.collectionRunId,
    analysisRunId: initial.analysisRunId,
    results: [analysisResult("position-2")],
    failures: [],
  });
  await commitAnalysesForRun(paths, client);

  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toMatchObject({ results: [{ positionId: "position-2" }] });
});

test("네 하위 명령의 stdout은 회사명과 공고 본문을 내지 않는다", async () => {
  const secret = "공개하지 않을 회사명과 공고 본문";
  const directory = workspace();
  const paths = runDirectoryPaths(directory);
  writeJson(paths.companyTierQueue, { secret });
  writeJson(paths.companyTierUpdates, { secret });
  writeJson(paths.analysisQueue, analysisQueue(secret));
  writeJson(paths.analysisUpdates, { secret });
  const lines: string[] = [];
  const options = { operations: operations(), writeLine: (line: string) => lines.push(line) };

  await runPositionCommand(["collect", "--run", directory], options);
  writeJson(paths.companyTierQueue, { secret });
  writeJson(paths.companyTierUpdates, { secret });
  await runPositionCommand(["commit-company-tiers", "--run", directory], options);
  writeJson(paths.analysisUpdates, { secret });
  await runPositionCommand(["commit-analyses", "--run", directory], options);
  await runPositionCommand(["finalize", "--run", directory], options);

  expect(lines.join("\n")).not.toContain(secret);
  expect(readFileSync(paths.analysisQueue, "utf8")).toContain(secret);
});
