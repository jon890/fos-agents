import { afterEach, expect, test } from "bun:test";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { AnalysisQueueResponse } from "../../services/career-backend/src/positions/schema.ts";
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

test("cleanup은 임시 실행 디렉터리를 지우고 내부 symlink 대상은 보존한다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "position-recommendation-"));
  directories.push(directory);
  const preserved = workspace();
  writeFileSync(join(preserved, "keep.txt"), "보존");
  writeFileSync(join(directory, "report.html"), "보고서");
  symlinkSync(preserved, join(directory, "linked-directory"));
  const lines: string[] = [];

  expect(await runPositionCommand(["cleanup", "--run", directory], {
    writeLine: (line) => lines.push(line),
  })).toBe(0);
  expect(existsSync(directory)).toBe(false);
  expect(readFileSync(join(preserved, "keep.txt"), "utf8")).toBe("보존");
  expect(lines).toEqual([`정리 완료: ${basename(directory)}`]);
});

test.each(["outside", "wrong-prefix", "nested", "symlink", "file", "missing", "empty"])(
  "cleanup은 안전하지 않은 경로를 보존하고 코드 2로 거절한다: %s", (kind) => {
    const fixture = workspace();
    const tempRoot = join(fixture, "temp");
    mkdirSync(tempRoot);
    const preserved = join(tempRoot, "position-recommendation-preserved");
    mkdirSync(preserved);
    writeFileSync(join(preserved, "keep.txt"), "보존");
    let target = join(tempRoot, "position-recommendation-target");
    if (kind === "outside") target = join(fixture, "position-recommendation-outside");
    if (kind === "wrong-prefix") target = join(tempRoot, "unrelated");
    if (kind === "nested") target = join(preserved, "position-recommendation-nested");
    if (kind === "empty") target = "";
    if (kind === "symlink") symlinkSync(preserved, target);
    else if (kind === "file") writeFileSync(target, "보존");
    else if (kind !== "missing" && kind !== "empty") {
      mkdirSync(target);
      writeFileSync(join(target, "keep.txt"), "보존");
    }

    const result = Bun.spawnSync([
      process.execPath, join(import.meta.dir, "position_run.ts"), "cleanup", "--run", target,
    ], { env: { ...process.env, TMPDIR: tempRoot }, stdout: "pipe", stderr: "pipe" });

    expect(result.exitCode).toBe(2);
    expect(result.stdout.toString()).toBe("");
    expect(result.stderr.toString()).toContain("정리 경로");
    expect(readFileSync(join(preserved, "keep.txt"), "utf8")).toBe("보존");
    if (kind === "symlink") expect(lstatSync(target).isSymbolicLink()).toBe(true);
    else if (kind === "file") expect(readFileSync(target, "utf8")).toBe("보존");
    else if (kind !== "missing" && kind !== "empty") {
      expect(readFileSync(join(target, "keep.txt"), "utf8")).toBe("보존");
    }
  },
);

test("cleanup은 --run 생략을 코드 2로 거절한다", () => {
  const result = Bun.spawnSync([process.execPath, join(import.meta.dir, "position_run.ts"), "cleanup"]);
  expect(result.exitCode).toBe(2);
  expect(result.stderr.toString()).toContain("cleanup에는 --run <RUN_DIR>이 필요합니다.");
});

function analysisQueue(secret = "공개하지 않을 회사명과 공고 본문"): AnalysisQueueResponse {
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

function companyTierQueue() {
  return {
    schemaVersion: 1 as const,
    collectionRunId: "collection-1",
    companyTierRunId: "company-tier-1",
    generatedAt: "2026-09-23T00:00:00.000Z",
    status: "pending" as const,
    companies: [
      {
        companyKey: "example",
        companyName: "예시 회사",
        assessmentStatus: "new" as const,
        activePositionCount: 1,
        representativePostingUrls: ["https://example.com/jobs/1"],
        priorTier: null,
        priorReason: null,
        priorValidUntil: null,
      },
    ],
    summary: {
      activeCompanyCount: 1,
      manualCount: 0,
      modelCount: 0,
      defaultCount: 1,
      queuedCount: 1,
      newCount: 1,
      staleCount: 0,
      completedCount: 0,
      failedCount: 0,
      pendingCount: 1,
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
    async prepareCandidateContext() {
      return { candidateContextVersion: "position-preferences:v1" };
    },
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

test("collect는 후보자 맥락 확인이 실패하면 이유를 알리고 수집하지 않은 채 1로 끝난다", async () => {
  const directory = workspace();
  const lines: string[] = [];
  let collected = false;

  const exitCode = await runPositionCommand(["collect", "--run", directory], {
    operations: operations({
      async prepareCandidateContext() {
        throw new Error("기준 버전 position-preferences:v3 과 position-preferences:v4 가 다르다.");
      },
      async collect() {
        collected = true;
        return 0;
      },
    }),
    writeLine: (line) => lines.push(line),
  });

  expect(exitCode).toBe(1);
  expect(collected).toBe(false);
  expect(lines.join("\n")).toContain("position-preferences:v3 과 position-preferences:v4");
  expect(existsSync(runDirectoryPaths(directory).analysisUpdates)).toBe(false);
});

test("collect는 후보자 맥락 확인이 통과하면 수집한다", async () => {
  const directory = workspace();
  const lines: string[] = [];
  let preparedPath: string | undefined;
  let collected = false;

  const exitCode = await runPositionCommand(["collect", "--run", directory], {
    operations: operations({
      async prepareCandidateContext(paths) {
        preparedPath = paths.candidateContext;
        return { candidateContextVersion: "position-preferences:v4" };
      },
      async collect() {
        collected = true;
        return 0;
      },
    }),
    writeLine: (line) => lines.push(line),
  });

  expect(exitCode).toBe(0);
  expect(collected).toBe(true);
  expect(preparedPath).toBe(join(runDirectoryPaths(directory).directory, "candidate-context.json"));
  expect(lines).toContain("후보자 맥락 기준 버전: position-preferences:v4");
});

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
        writeJson(
          runPaths[current.expected],
          current.expected === "companyTierQueue" ? companyTierQueue() : analysisQueue(),
        );
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

test("collect는 회사 판정 큐의 실행 ID로 결과 틀을 만들고 대상 수를 알린다", async () => {
  const directory = workspace();
  const paths = runDirectoryPaths(directory);
  const lines: string[] = [];

  await runPositionCommand(["collect", "--run", directory], {
    operations: operations({
      async prepare(runPaths) {
        writeJson(runPaths.companyTierQueue, companyTierQueue());
        return {
          passed: true,
          collectionRunId: "collection-1",
          companyTierRunId: "company-tier-1",
          companyTierQueuedCount: 1,
          analysisRunId: null,
          candidatePoolBytes: 1,
          candidateCount: 1,
          queueBodyBytes: 1,
          ...analysisQueue().summary,
          output: runPaths.companyTierQueue,
        };
      },
    }),
    writeLine: (line) => lines.push(line),
  });

  expect(JSON.parse(readFileSync(paths.companyTierUpdates, "utf8"))).toEqual({
    schemaVersion: 1,
    collectionRunId: "collection-1",
    companyTierRunId: "company-tier-1",
    results: [],
    failures: [],
  });
  expect(lines).toContain("채울 항목: 회사 1곳. results 나 failures에 한 번씩 넣는다.");
});

test("collect는 공고 분석 큐의 실행 ID로 결과 틀을 만들고 대상 수를 알린다", async () => {
  const directory = workspace();
  const paths = runDirectoryPaths(directory);
  const lines: string[] = [];

  await runPositionCommand(["collect", "--run", directory], {
    operations: operations(),
    writeLine: (line) => lines.push(line),
  });

  expect(JSON.parse(readFileSync(paths.analysisUpdates, "utf8"))).toEqual({
    schemaVersion: 2,
    collectionRunId: "collection-1",
    analysisRunId: "analysis-1",
    results: [],
    failures: [],
  });
  expect(lines).toContain("채울 항목: 공고 1건. results 나 failures에 한 번씩 넣는다.");
});

test("commit-company-tiers는 분석 큐를 만든 뒤 공고 분석 결과 틀을 만든다", async () => {
  const directory = workspace();
  const paths = runDirectoryPaths(directory);
  const lines: string[] = [];
  writeJson(paths.companyTierQueue, companyTierQueue());
  writeJson(paths.companyTierUpdates, {
    schemaVersion: 1,
    collectionRunId: "collection-1",
    companyTierRunId: "company-tier-1",
    results: [],
    failures: [],
  });

  await runPositionCommand(["commit-company-tiers", "--run", directory], {
    operations: operations({
      async commitCompanyTiers(runPaths) {
        writeJson(runPaths.analysisQueue, analysisQueue());
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
          analysisQueueOutput: runPaths.analysisQueue,
        };
      },
    }),
    writeLine: (line) => lines.push(line),
  });

  expect(JSON.parse(readFileSync(paths.analysisUpdates, "utf8"))).toMatchObject({
    collectionRunId: "collection-1",
    analysisRunId: "analysis-1",
    results: [],
    failures: [],
  });
  expect(lines).toContain("채울 항목: 공고 1건. results 나 failures에 한 번씩 넣는다.");
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
  writeJson(paths.analysisUpdates, { stale: true });
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
  expect(JSON.parse(readFileSync(paths.analysisUpdates, "utf8"))).toMatchObject({
    collectionRunId: "collection-1",
    analysisRunId: "analysis-1",
    results: [],
    failures: [],
  });
  expect(lines).toContain("채울 항목: 공고 1건. results 나 failures에 한 번씩 넣는다.");
});

test("partial 분석 큐는 이미 처리한 공고를 채울 항목 수에서 뺀다", async () => {
  const directory = workspace();
  const paths = runDirectoryPaths(directory);
  const queue = analysisQueue();
  queue.candidates.push({
    ...structuredClone(queue.candidates[0]),
    positionId: "position-2",
    candidateId: "wanted:2",
    contentHash: "sha256:content-2",
    resultStatus: "created",
    posting: { ...structuredClone(queue.candidates[0].posting), id: "wanted:2" },
  });
  queue.candidates.push({
    ...structuredClone(queue.candidates[0]),
    positionId: "position-3",
    candidateId: "wanted:3",
    contentHash: "sha256:content-3",
    resultStatus: "reused",
    posting: { ...structuredClone(queue.candidates[0].posting), id: "wanted:3" },
  });
  writeJson(paths.analysisQueue, queue);
  writeJson(paths.analysisUpdates, { stale: true });
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
          reusedCount: 1,
          failedCount: 1,
          remainingCount: 1,
          applied: true,
        };
      },
    }),
    writeLine: (line) => lines.push(line),
  });

  expect(lines).toContain("채울 항목: 공고 1건. results 나 failures에 한 번씩 넣는다.");
});

test("빈 분석 결과 틀은 큐와 제출 목록이 달라 반영할 수 없다", async () => {
  const directory = workspace();
  const paths = runDirectoryPaths(directory);
  writeJson(paths.analysisQueue, analysisQueue());
  writeJson(paths.analysisUpdates, {
    schemaVersion: 2,
    collectionRunId: "collection-1",
    analysisRunId: "analysis-1",
    results: [],
    failures: [],
  });

  await expect(
    commitAnalysesForRun(paths, {
      async saveAnalysisResults() {
        throw new Error("호출하면 안 됩니다.");
      },
      async getRun() {
        return analysisQueue();
      },
    }),
  ).rejects.toThrow("큐와 제출 목록이 다릅니다");
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
