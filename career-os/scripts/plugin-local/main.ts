#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeRemoteError, TransportError } from "../career-workspace/transport.ts";
import { runDrillCli } from "../interview-drill/drill-engine.ts";
import { createInterviewPracticeStore } from "../interview-drill/store/index.ts";
import { runInterviewQuestionSources } from "../interview-question-sources/cli.ts";
import { PositionRunUsageError, positionRunHelp, runPositionCommand } from "../position-recommender/position_run.ts";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import { UsageError } from "../lib/cli.ts";
import { formatManageReadingSourcesError, manageReadingSources } from "../study-topic-recommender/manage_reading_sources.ts";
import { main as runMorningReading, reportMorningReadingError } from "../study-topic-recommender/morning_reading_cli.ts";
import { StudyRunPathError } from "../study-topic-recommender/runtime-paths.ts";
import { runValidateOutputs } from "../study-topic-recommender/validate_outputs.ts";
import { main as assessClaimReuse } from "../resume-preparer/assess_claim_reuse.ts";
import { main as buildSubmissionBundle } from "../resume-preparer/build_submission_bundle.ts";
import { main as checkResumeHtml } from "../resume-preparer/check_resume_html.ts";
import { main as exportResume } from "../resume-preparer/export_resume.ts";
import { main as promoteVerifiedClaims } from "../resume-preparer/promote_verified_claims.ts";
import { main as searchVerifiedClaims } from "../resume-preparer/search_verified_claims.ts";
import { main as validateClaimLedger } from "../resume-preparer/validate_claim_ledger.ts";
import { main as validateSubmissionBundle } from "../resume-preparer/validate_submission_bundle.ts";
import { PLUGIN_LOCAL_EXECUTORS } from "./executors.ts";
import { resolvePluginWorkspace, runPluginWorkspace } from "./workspace.ts";

type Executor = (typeof PLUGIN_LOCAL_EXECUTORS)[number];

const descriptions: Record<Executor, string> = {
  workspace: "작업본 위치를 알려 주고 스킬 세션을 열고 닫는다 (paths | begin <skill> | finish <skill>) --json",
  interview: "Backend 의 진행 기록으로 면접 질문을 고른다 (select <tech|behavioral>)",
  "interview-sources": "면접 질문 출처를 검증하거나 후보를 모은다",
  study: "아침 공부 주제를 수집, 선별하고 리포트를 만든다",
  "study-validate": "아침 공부 리포트 산출물을 검증한다 (--run-dir <dir>)",
  "study-sources": "공부 자료 출처를 조회하거나 바꾼다",
  position: "공고를 모아 판정과 분석을 반영하고 리포트를 만든다 (collect | commit-company-tiers | commit-analyses | finalize | cleanup) --run <dir>",
  resume: "이력서 HTML·PDF 변환, 주장 원장과 검증 완료 주장, 제출 묶음을 다룬다 (export | check-html | validate-ledger | assess-reuse | search-claims | promote-claims | build-bundle | validate-bundle)",
};

/**
 * resume 하위 명령과 원본 진입점이다. 원본은 process.argv 를 읽고 process.exit 으로 끝난다.
 * defaults 는 사용자가 그 옵션을 주지 않았을 때만 작업본 root 기준으로 붙인다.
 */
const RESUME_COMMANDS: Record<string, { run: () => unknown; defaults?: Record<string, string> }> = {
  export: { run: exportResume, defaults: { "--logo-dir": "library/resume-logos" } },
  "check-html": { run: checkResumeHtml },
  "validate-ledger": { run: validateClaimLedger },
  "assess-reuse": { run: assessClaimReuse, defaults: { "--state-dir": "state/verified-claims" } },
  "search-claims": { run: searchVerifiedClaims, defaults: { "--state-dir": "state/verified-claims" } },
  "promote-claims": { run: promoteVerifiedClaims, defaults: { "--state-dir": "state/verified-claims" } },
  "build-bundle": { run: buildSubmissionBundle },
  "validate-bundle": { run: validateSubmissionBundle },
};

const RESUME_USAGE = `사용법: resume <${Object.keys(RESUME_COMMANDS).join(" | ")}> [인자...]`;

const INTERVIEW_USAGE = "사용법: interview select <tech|behavioral> [--application-dir <dir>] [--target-bar <bar>] [--count <n>]";

function usage(): string {
  return [
    "사용법: career-local.js <실행기> [인자...]",
    "",
    ...PLUGIN_LOCAL_EXECUTORS.map((name) => `  ${name.padEnd(18)} ${descriptions[name]}`),
  ].join("\n");
}

function isExecutor(name: string): name is Executor {
  return (PLUGIN_LOCAL_EXECUTORS as readonly string[]).includes(name);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runPluginLocal(argv: string[]): Promise<number> {
  const [executor, ...rest] = argv;
  if (!executor || executor === "help" || executor === "--help" || executor === "-h") {
    console.log(usage());
    return 0;
  }
  if (!isExecutor(executor)) {
    console.error(`모르는 실행기: ${executor}`);
    console.error(usage());
    return 2;
  }
  // study, study-validate 원본은 옵션을 process.argv 에서 직접 찾는다.
  process.argv = [process.argv[0]!, process.argv[1]!, ...rest];

  switch (executor) {
    case "workspace":
      return runWorkspace(rest);
    case "interview":
      return runInterview(rest);
    case "interview-sources":
      try {
        const result = await runInterviewQuestionSources(rest[0] ?? "validate", process.argv);
        console.log(JSON.stringify(result, null, 2));
        return 0;
      } catch (error) {
        console.error(messageOf(error));
        return 1;
      }
    case "study":
      try {
        await runMorningReading();
      } catch (error) {
        reportMorningReadingError(error);
      }
      return typeof process.exitCode === "number" ? process.exitCode : 0;
    case "study-validate":
      try {
        console.log(JSON.stringify(runValidateOutputs(process.argv), null, 2));
        return 0;
      } catch (error) {
        console.error(messageOf(error));
        return error instanceof StudyRunPathError ? error.exitCode : 1;
      }
    case "study-sources":
      try {
        const result = await manageReadingSources(rest);
        console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
        return 0;
      } catch (error) {
        console.error(formatManageReadingSourcesError(error));
        return 1;
      }
    case "position":
      return runPosition(rest);
    case "resume":
      return runResume(rest);
  }
}

async function runResume(args: string[]): Promise<number> {
  const [command, ...commandArgs] = args;
  const entry = command && Object.hasOwn(RESUME_COMMANDS, command) ? RESUME_COMMANDS[command] : undefined;
  if (!entry) {
    if (command) console.error(`모르는 하위 명령입니다: ${command}`);
    console.error(RESUME_USAGE);
    return 2;
  }
  const { root } = resolvePluginWorkspace(process.env, os.homedir());
  const injected = Object.entries(entry.defaults ?? {})
    .filter(([option]) => !commandArgs.includes(option))
    .flatMap(([option, relative]) => [option, path.join(root, relative)]);
  process.argv = [process.argv[0]!, process.argv[1]!, ...commandArgs, ...injected];
  // 원본 진입점은 process.exit 으로 끝나므로 여기로 돌아오지 않는다.
  await entry.run();
  return typeof process.exitCode === "number" ? process.exitCode : 0;
}

// position_run.ts 의 메인 블록과 같은 출력과 종료 코드를 낸다.
async function runPosition(args: string[]): Promise<number> {
  try {
    return await runPositionCommand(args);
  } catch (error) {
    if (error instanceof PositionRunUsageError) {
      console.error(positionRunHelp());
      console.error(error.message);
      return 2;
    }
    console.error(messageOf(error));
    return 1;
  }
}

async function runWorkspace(args: string[]): Promise<number> {
  try {
    const result = await runPluginWorkspace(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    const result = error instanceof TransportError ? error.result : makeRemoteError("check", "TRANSPORT_UNAVAILABLE");
    process.stderr.write(`${JSON.stringify(result)}\n`);
    return 1;
  }
}

async function runInterview(args: string[]): Promise<number> {
  if (args[0] !== "select") {
    console.error("plugin 실행기는 select 만 받는다. 기록과 개인 질문은 save_interview_attempt, save_personal_question 도구로 한다.");
    return 2;
  }
  // plugin 에는 파일 저장소를 두지 않는다. 저장소는 늘 Backend 다(ADR-137).
  const environment = { ...process.env, CAREER_STORE: "backend" };
  try {
    const result = await runDrillCli(args, {
      environment,
      createStore: () => createInterviewPracticeStore(environment),
      readFile: (filePath) => readFileSync(filePath, "utf8"),
    });
    console.log(JSON.stringify(result));
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(INTERVIEW_USAGE);
      console.error(error.message);
      return 2;
    }
    const message = messageOf(error);
    console.error(
      error instanceof CareerBackendHttpError && error.code === "NETWORK_ERROR"
        ? `커리어 Backend에 연결하지 못했습니다. 연습 결과는 기록되지 않았습니다. ${message}`
        : message,
    );
    return 1;
  }
}

if (import.meta.main) process.exitCode = await runPluginLocal(process.argv.slice(2));
