#!/usr/bin/env bun
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { analysisQueueResponseSchema } from "../../services/recommendation-api/src/positions/schema.ts";
import { DEFAULT_MAX_FAILED_SOURCES } from "./live-postings/collection_health.ts";
import { collectLivePostings } from "./collect_live_postings.ts";
import { preparePositionAnalysis } from "./prepare_position_analysis.ts";
import { completeCompanyTierAssessment } from "./complete_company_tier_assessment.ts";
import { collectEvidenceForRun } from "./collect_company_evidence.ts";
import { commitPositionAnalysis } from "./commit_position_analysis.ts";
import { finalizeRecommendation } from "./finalize_position_recommendation.ts";
import { createRecommendationApiClient } from "./recommendation-api/client.ts";
import { runDirectoryPaths, type RunDirectoryPaths } from "./run-dir.ts";

const COMMANDS = ["collect", "commit-company-tiers", "commit-analyses", "finalize"] as const;
type PositionRunCommand = (typeof COMMANDS)[number];

type PreparationResult = Awaited<ReturnType<typeof preparePositionAnalysis>>;
type CompanyTierResult = Awaited<ReturnType<typeof completeCompanyTierAssessment>>;
type AnalysisResult = Awaited<ReturnType<typeof commitPositionAnalysis>>;
type FinalizationResult = Awaited<ReturnType<typeof finalizeRecommendation>>;
type AnalysisCommitClient = Pick<
  ReturnType<typeof createRecommendationApiClient>,
  "saveAnalysisResults" | "getRun"
>;

export type PositionRunOperations = {
  collect(paths: RunDirectoryPaths): Promise<number>;
  prepare(paths: RunDirectoryPaths): Promise<PreparationResult>;
  collectEvidence?(
    paths: RunDirectoryPaths,
  ): Promise<{ companyCount: number; evidenceCount: number; failedCollectorCount: number }>;
  commitCompanyTiers(paths: RunDirectoryPaths): Promise<CompanyTierResult>;
  commitAnalyses(paths: RunDirectoryPaths): Promise<AnalysisResult>;
  finalize(paths: RunDirectoryPaths, analysisRunId: string): Promise<FinalizationResult>;
};

export type PositionRunOptions = {
  operations?: PositionRunOperations;
  createRunDirectory?: () => string;
  writeLine?: (line: string) => void;
};

export class PositionRunUsageError extends Error {}

const HELP = `position_run.ts

포지션 추천 일일 실행을 실행 디렉터리 하나로 이어 간다.

Usage:
  position_run.ts collect [--run <RUN_DIR>]
  position_run.ts commit-company-tiers --run <RUN_DIR>
  position_run.ts commit-analyses --run <RUN_DIR>
  position_run.ts finalize --run <RUN_DIR>

Commands:
  collect                 공고를 수집하고 다음 큐를 만든다
  commit-company-tiers    회사 판정을 반영하고 공고 분석 큐를 만든다
  commit-analyses         공고 분석을 반영한다
  finalize                추천 JSON과 HTML을 만든다

Options:
  --run <RUN_DIR>  실행별 파일을 둘 디렉터리
  --help           이 도움말을 보여준다`;

export function positionRunHelp(): string {
  return HELP;
}

function parsePositionRunArgs(argv: string[]): {
  command: PositionRunCommand | "help";
  runDirectory?: string;
} {
  if (argv.length === 0) throw new PositionRunUsageError("하위 명령이 필요합니다.");
  if (argv.includes("--help")) return { command: "help" };

  const command = argv[0];
  if (!COMMANDS.includes(command as PositionRunCommand)) {
    throw new PositionRunUsageError(`모르는 하위 명령입니다: ${command}`);
  }

  let runDirectory: string | undefined;
  for (let index = 1; index < argv.length; index++) {
    const argument = argv[index];
    if (argument !== "--run") {
      throw new PositionRunUsageError(`모르는 옵션입니다: ${argument}`);
    }
    if (runDirectory !== undefined) {
      throw new PositionRunUsageError("--run은 한 번만 지정할 수 있습니다.");
    }
    const value = argv[++index];
    if (value === undefined || value.startsWith("--")) {
      throw new PositionRunUsageError("--run에 RUN_DIR 값이 필요합니다.");
    }
    runDirectory = value;
  }

  if (command !== "collect" && runDirectory === undefined) {
    throw new PositionRunUsageError(`${command}에는 --run <RUN_DIR>이 필요합니다.`);
  }
  return { command: command as PositionRunCommand, runDirectory };
}

const defaultOperations: PositionRunOperations = {
  async collect(paths) {
    return collectLivePostings({
      jsonOut: paths.postingCandidates,
      source: "all",
      targetRoleOnly: true,
      wantedLimit: 120,
      includeTossArticles: false,
      maxFailedSources: DEFAULT_MAX_FAILED_SOURCES,
    });
  },
  async prepare(paths) {
    return preparePositionAnalysis(
      paths.postingCandidates,
      paths.companyTierQueue,
      paths.analysisQueue,
    );
  },
  collectEvidence: collectEvidenceForRun,
  async commitCompanyTiers(paths) {
    return completeCompanyTierAssessment(
      paths.companyTierQueue,
      paths.companyTierUpdates,
      paths.analysisQueue,
    );
  },
  async commitAnalyses(paths) {
    return commitAnalysesForRun(paths);
  },
  async finalize(paths, analysisRunId) {
    return finalizeRecommendation(
      createRecommendationApiClient(),
      analysisRunId,
      paths.recommendation,
      paths.report,
    );
  },
};

function createRunDirectory(): string {
  return mkdtempSync(join(tmpdir(), "position-recommendation-"));
}

function requireInput(path: string, description: string): void {
  if (existsSync(path)) return;
  throw new Error(`${path} 파일이 없습니다. ${description}을 이 경로에 작성한 뒤 다시 실행하세요.`);
}

function queueAnalysisRunId(path: string): string {
  const queue = analysisQueueResponseSchema.parse(
    JSON.parse(readFileSync(path, "utf8")) as unknown,
  );
  return queue.analysisRunId;
}

export async function commitAnalysesForRun(
  paths: RunDirectoryPaths,
  client: AnalysisCommitClient = createRecommendationApiClient(),
): Promise<AnalysisResult> {
  const result = await commitPositionAnalysis(
    paths.analysisQueue,
    paths.analysisUpdates,
    () => client,
  );
  if (result.status !== "partial") return result;

  const latestQueue = analysisQueueResponseSchema.parse(await client.getRun(result.analysisRunId));
  writeFileSync(paths.analysisQueue, `${JSON.stringify(latestQueue, null, 2)}\n`, "utf8");
  return result;
}

export async function runPositionCommand(
  argv: string[],
  options: PositionRunOptions = {},
): Promise<number> {
  const parsed = parsePositionRunArgs(argv);
  const writeLine = options.writeLine ?? console.log;
  if (parsed.command === "help") {
    writeLine(positionRunHelp());
    return 0;
  }

  const operations = options.operations ?? defaultOperations;
  const directory = parsed.runDirectory ?? (options.createRunDirectory ?? createRunDirectory)();
  const paths = runDirectoryPaths(directory);

  if (parsed.command === "collect") {
    mkdirSync(paths.directory, { recursive: true });
    rmSync(paths.companyTierQueue, { force: true });
    rmSync(paths.companyEvidence, { force: true });
    rmSync(paths.analysisQueue, { force: true });
    writeLine(paths.directory);
    const exitCode = await operations.collect(paths);
    if (exitCode !== 0) return exitCode;
    const result = await operations.prepare(paths);
    if (result.companyTierQueuedCount > 0) {
      if (operations.collectEvidence) {
        const evidence = await operations.collectEvidence(paths);
        writeLine(
          `회사 근거 수집: 회사 ${evidence.companyCount}곳, 근거 ${evidence.evidenceCount}건, 실패 수집기 ${evidence.failedCollectorCount}건`,
        );
      }
      writeLine(
        `수집 완료: 후보 ${result.candidateCount}건, ${basename(paths.companyTierQueue)} 준비`,
      );
      writeLine(`회사 판정 결과 작성: ${paths.companyTierUpdates}`);
      writeLine("다음 명령: commit-company-tiers");
    } else {
      writeLine(
        `수집 완료: 후보 ${result.candidateCount}건, ${basename(paths.analysisQueue)} 준비`,
      );
      writeLine(`공고 분석 결과 작성: ${paths.analysisUpdates}`);
      writeLine("다음 명령: commit-analyses");
    }
    return 0;
  }

  if (parsed.command === "commit-company-tiers") {
    requireInput(paths.companyTierUpdates, "회사 판정 결과");
    requireInput(paths.companyTierQueue, "collect가 만든 회사 판정 큐");
    const result = await operations.commitCompanyTiers(paths);
    writeLine(
      `회사 판정 반영: 생성 ${result.createdCount}건, 재사용 ${result.reusedCount}건, 실패 ${result.failedCount}건, 남음 ${result.remainingCount}건`,
    );
    if (result.analysisQueueOutput) {
      writeLine(`공고 분석 결과 작성: ${paths.analysisUpdates}`);
      writeLine("다음 명령: commit-analyses");
    } else {
      writeLine("다음 명령: commit-company-tiers");
    }
    return 0;
  }

  if (parsed.command === "commit-analyses") {
    requireInput(paths.analysisUpdates, "공고 분석 결과");
    requireInput(paths.analysisQueue, "앞 단계가 만든 공고 분석 큐");
    const result = await operations.commitAnalyses(paths);
    writeLine(
      `공고 분석 반영: 생성 ${result.createdCount}건, 재사용 ${result.reusedCount}건, 실패 ${result.failedCount}건, 남음 ${result.remainingCount}건`,
    );
    if (result.status === "partial") {
      writeLine(
        `남은 ${result.remainingCount}건의 분석 결과를 ${paths.analysisUpdates}에 작성하고 같은 명령을 다시 실행하세요.`,
      );
    } else {
      writeLine("다음 명령: finalize");
    }
    return 0;
  }

  requireInput(paths.analysisQueue, "앞 단계가 만든 공고 분석 큐");
  const result = await operations.finalize(paths, queueAnalysisRunId(paths.analysisQueue));
  writeLine(
    `최종화 완료: 순위 ${result.rankingCount}건, 이번 실행 분석 ${result.analyzedNowCount}건, 재사용 ${result.reusedCount}건, 대기 ${result.pendingCount}건`,
  );
  for (const warning of result.collectionWarnings) writeLine(warning);
  writeLine(`산출물: ${basename(paths.recommendation)}, ${basename(paths.report)}`);
  return 0;
}

if (import.meta.main) {
  runPositionCommand(process.argv.slice(2))
    .then(process.exit)
    .catch((error) => {
      if (error instanceof PositionRunUsageError) {
        console.error(positionRunHelp());
        console.error(error.message);
        process.exit(2);
      }
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
