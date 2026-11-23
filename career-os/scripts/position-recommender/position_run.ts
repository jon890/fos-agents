#!/usr/bin/env bun
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";
import { analysisQueueResponseSchema } from "../lib/career-store/positions/schema.ts";
import { DEFAULT_MAX_FAILED_SOURCES } from "./live-postings/collection_health.ts";
import { collectLivePostings } from "./collect_live_postings.ts";
import { preparePositionAnalysis } from "./prepare_position_analysis.ts";
import { completeCompanyTierAssessment } from "./complete_company_tier_assessment.ts";
import { collectEvidenceForRun } from "./collect_company_evidence.ts";
import { analysisUpdatesInputSchema, commitPositionAnalysis } from "./commit_position_analysis.ts";
import { companyTierUpdatesInputSchema } from "./company-tier-analysis/schema.ts";
import { finalizeRecommendation } from "./finalize_position_recommendation.ts";
import { createPositionStore } from "./position-store.ts";
import { resolveCareerStoreRoot } from "../lib/career-store/database.ts";
import { careerStoreFailureLine } from "../lib/career-store/errors.ts";
import { formatSeoulIsoDate } from "../lib/date-format.ts";
import { prepareCandidateContext } from "./candidate-context.ts";
import {
  isPositionSettingsCommand,
  POSITION_SETTINGS_HELP,
  PositionSettingsUsageError,
  runPositionSettingsCommand,
} from "./position_settings.ts";
import {
  runDirectoryPaths,
  validatePositionCleanupDirectory,
  writeAnalysisUpdatesTemplate,
  writeCompanyTierUpdatesTemplate,
  type RunDirectoryPaths,
} from "./run-dir.ts";

const COMMANDS = [
  "collect",
  "commit-company-tiers",
  "commit-analyses",
  "finalize",
  "cleanup",
  "schema",
] as const;
type PositionRunCommand = (typeof COMMANDS)[number];

/**
 * 모델이 채우는 결과 파일의 입력 계약이다. 실행기 번들만 받은 환경에는 스키마 소스가 없어
 * `schema` 하위 명령이 이 계약을 JSON Schema 로 내보낸다.
 */
const RESULT_SCHEMAS = {
  "company-tiers": companyTierUpdatesInputSchema,
  analyses: analysisUpdatesInputSchema,
} as const;
type ResultSchemaName = keyof typeof RESULT_SCHEMAS;

export function resultFileJsonSchema(name: ResultSchemaName): unknown {
  return z.toJSONSchema(RESULT_SCHEMAS[name], { io: "input" });
}

export type EvidenceCollectionSummary = {
  companyCount: number;
  evidenceCount: number;
  failedCollectorCount: number;
  /** 실패한 수집기의 진단 코드와 그 진단이 난 회사 수다. 외부 오류 원문은 넣지 않는다. */
  failedCollectors?: Array<{ diagnostic: string; companyCount: number }>;
};

type PreparationResult = Awaited<ReturnType<typeof preparePositionAnalysis>>;
type CompanyTierResult = Awaited<ReturnType<typeof completeCompanyTierAssessment>>;
type AnalysisResult = Awaited<ReturnType<typeof commitPositionAnalysis>>;
type FinalizationResult = Awaited<ReturnType<typeof finalizeRecommendation>>;
type AnalysisCommitClient = Pick<
  ReturnType<typeof createPositionStore>,
  "saveAnalysisResults" | "getRun"
>;

export type PositionRunOperations = {
  /** 후보자 맥락 문서를 읽어 실행 디렉터리에 둔다. 문서가 없으면 던진다. */
  prepareCandidateContext(paths: RunDirectoryPaths): Promise<{ candidateContextVersion: string }>;
  collect(paths: RunDirectoryPaths): Promise<number>;
  prepare(paths: RunDirectoryPaths): Promise<PreparationResult>;
  collectEvidence?(paths: RunDirectoryPaths): Promise<EvidenceCollectionSummary>;
  commitCompanyTiers(paths: RunDirectoryPaths): Promise<CompanyTierResult>;
  commitAnalyses(paths: RunDirectoryPaths): Promise<AnalysisResult>;
  finalize(paths: RunDirectoryPaths, analysisRunId: string): Promise<FinalizationResult>;
  /** 완성한 리포트를 작업 폴더 `reports/` 에 날짜가 든 이름으로 남기고 그 경로를 돌려준다. */
  saveReport?(paths: RunDirectoryPaths): string;
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
  position_run.ts cleanup --run <RUN_DIR>
  position_run.ts schema <company-tiers|analyses>
${POSITION_SETTINGS_HELP}

Commands:
  collect                 공고를 수집하고 다음 큐를 만든다
  commit-company-tiers    회사 판정을 반영하고 공고 분석 큐를 만든다
  commit-analyses         공고 분석을 반영한다
  finalize                추천 JSON과 HTML을 만든다
  cleanup                 검증과 전달이 끝난 임시 실행 디렉터리를 정리한다
  schema                  회사 판정이나 공고 분석 결과 파일의 JSON Schema 를 출력한다
  configure-policy        분석 정책을 저장한다. 새 저장소는 정책이 있어야 수집을 받는다
  configure-companies     회사별 tier 와 제외 여부를 저장한다
  exclusions              개인 공고 제외 규칙을 읽거나(get) 목록 전체를 바꾼다(put)

데이터는 CAREER_WORKSPACE_ROOT(없으면 /workspace/career) 아래 state/career.sqlite 에 있다.

Options:
  --run <RUN_DIR>  실행별 파일을 둘 디렉터리
  --help           이 도움말을 보여준다`;

export function positionRunHelp(): string {
  return HELP;
}

function parsePositionRunArgs(argv: string[]): {
  command: PositionRunCommand | "help";
  runDirectory?: string;
  schemaName?: ResultSchemaName;
} {
  if (argv.length === 0) throw new PositionRunUsageError("하위 명령이 필요합니다.");
  if (argv.includes("--help")) return { command: "help" };

  const command = argv[0];
  if (!COMMANDS.includes(command as PositionRunCommand)) {
    throw new PositionRunUsageError(`모르는 하위 명령입니다: ${command}`);
  }
  if (command === "schema") {
    const name = argv[1];
    if (argv.length !== 2 || !Object.hasOwn(RESULT_SCHEMAS, name)) {
      throw new PositionRunUsageError(
        `schema에는 ${Object.keys(RESULT_SCHEMAS).join(" 또는 ")} 하나가 필요합니다.`,
      );
    }
    return { command: "schema", schemaName: name as ResultSchemaName };
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

/** 실제 수집과 작업 폴더 저장소를 쓰는 기본 동작이다. 테스트는 수집만 대역으로 바꿔 쓴다. */
export const defaultOperations: PositionRunOperations = {
  async prepareCandidateContext(paths) {
    return prepareCandidateContext(paths, resolveCareerStoreRoot());
  },
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
      createPositionStore(),
      analysisRunId,
      paths.recommendation,
      paths.report,
    );
  },
  saveReport(paths) {
    return saveReportCopy(paths.report);
  },
};

/** 실행 폴더는 작업 폴더 `runs/` 아래에 만든다. 실행 공간의 임시 폴더는 작아 큰 수집에서 넘친다. */
function createRunDirectory(): string {
  const runs = join(resolveCareerStoreRoot(), "runs");
  mkdirSync(runs, { recursive: true });
  return mkdtempSync(join(runs, "position-recommendation-"));
}

/** 같은 날 다시 만들면 같은 이름을 덮어쓴다. 「내 파일」 에는 에이전트가 실행마다 따로 넣는다. */
export function saveReportCopy(
  reportPath: string,
  workspaceRoot: string = resolveCareerStoreRoot(),
  now: Date = new Date(),
): string {
  const reports = join(workspaceRoot, "reports");
  mkdirSync(reports, { recursive: true });
  const target = join(reports, `${formatSeoulIsoDate(now.toISOString())}-position.html`);
  copyFileSync(reportPath, target);
  return target;
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
  client: AnalysisCommitClient = createPositionStore(),
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
  const writeLine = options.writeLine ?? console.log;
  if (isPositionSettingsCommand(argv[0]) && !argv.includes("--help")) {
    try {
      return await runPositionSettingsCommand(argv, writeLine);
    } catch (error) {
      if (error instanceof PositionSettingsUsageError)
        throw new PositionRunUsageError(error.message);
      throw error;
    }
  }
  const parsed = parsePositionRunArgs(argv);
  if (parsed.command === "help") {
    writeLine(positionRunHelp());
    return 0;
  }
  if (parsed.command === "schema") {
    writeLine(JSON.stringify(resultFileJsonSchema(parsed.schemaName!), null, 2));
    return 0;
  }

  const operations = options.operations ?? defaultOperations;
  const directory = parsed.runDirectory ?? (options.createRunDirectory ?? createRunDirectory)();
  if (parsed.command === "cleanup") {
    let cleanupDirectory: string;
    try {
      cleanupDirectory = validatePositionCleanupDirectory(directory, resolveCareerStoreRoot());
    } catch (error) {
      throw new PositionRunUsageError((error as Error).message);
    }
    rmSync(cleanupDirectory, { recursive: true });
    writeLine(`정리 완료: ${basename(cleanupDirectory)}`);
    return 0;
  }
  const paths = runDirectoryPaths(directory);

  if (parsed.command === "collect") {
    mkdirSync(paths.directory, { recursive: true });
    rmSync(paths.companyTierQueue, { force: true });
    rmSync(paths.companyEvidence, { force: true });
    rmSync(paths.analysisQueue, { force: true });
    rmSync(paths.candidateContext, { force: true });
    writeLine(paths.directory);
    // 후보자 맥락 문서가 없으면 수집하지 않는다.
    try {
      const context = await operations.prepareCandidateContext(paths);
      writeLine(`후보자 맥락 기준 버전: ${context.candidateContextVersion}`);
    } catch (error) {
      writeLine(`수집 전 확인 실패: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
    const exitCode = await operations.collect(paths);
    if (exitCode !== 0) return exitCode;
    const result = await operations.prepare(paths);
    if (result.companyTierQueuedCount > 0) {
      if (operations.collectEvidence) {
        const evidence = await operations.collectEvidence(paths);
        writeLine(
          `회사 근거 수집: 회사 ${evidence.companyCount}곳, 근거 ${evidence.evidenceCount}건, 실패 수집기 ${evidence.failedCollectorCount}건`,
        );
        for (const failed of evidence.failedCollectors ?? [])
          writeLine(`실패한 수집기: ${failed.diagnostic} (회사 ${failed.companyCount}곳)`);
        if (evidence.failedCollectorCount > 0)
          writeLine(
            "수집기 실패는 그 출처의 근거만 빠진 것이다. 멈추지 않고 저장된 근거로 회사 판정을 이어 간다.",
          );
      }
      writeLine(
        `수집 완료: 후보 ${result.candidateCount}건, ${basename(paths.companyTierQueue)} 준비`,
      );
      const companyCount = writeCompanyTierUpdatesTemplate(paths);
      writeLine(`회사 판정 결과 작성: ${paths.companyTierUpdates}`);
      writeLine(`채울 항목: 회사 ${companyCount}곳. results 나 failures에 한 번씩 넣는다.`);
      writeLine("다음 명령: commit-company-tiers");
    } else {
      writeLine(
        `수집 완료: 후보 ${result.candidateCount}건, ${basename(paths.analysisQueue)} 준비`,
      );
      const postingCount = writeAnalysisUpdatesTemplate(paths);
      writeLine(`공고 분석 결과 작성: ${paths.analysisUpdates}`);
      writeLine(`채울 항목: 공고 ${postingCount}건. results 나 failures에 한 번씩 넣는다.`);
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
      const postingCount = writeAnalysisUpdatesTemplate(paths);
      writeLine(`공고 분석 결과 작성: ${paths.analysisUpdates}`);
      writeLine(`채울 항목: 공고 ${postingCount}건. results 나 failures에 한 번씩 넣는다.`);
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
      const postingCount = writeAnalysisUpdatesTemplate(paths);
      writeLine(`공고 분석 결과 작성: ${paths.analysisUpdates}`);
      writeLine(`채울 항목: 공고 ${postingCount}건. results 나 failures에 한 번씩 넣는다.`);
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
  if (operations.saveReport) {
    const reportCopy = operations.saveReport(paths);
    writeLine(`리포트 사본: ${reportCopy}`);
    writeLine(`다음 단계: file_space_put 으로 ${reportCopy} 를 「내 파일」 에 넣는다. 넣은 이름이나 넣지 못한 이유를 최종 답변의 「내 파일」 줄에 적는다`);
  }
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
      console.error(
        careerStoreFailureLine(error) ?? (error instanceof Error ? error.message : String(error)),
      );
      process.exit(1);
    });
}
