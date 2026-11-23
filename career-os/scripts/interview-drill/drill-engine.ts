#!/usr/bin/env bun

import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { readContextDocument } from "../lib/career-store/context.ts";
import { openCareerStore, resolveCareerStoreRoot } from "../lib/career-store/database.ts";
import { CareerStoreError, careerStoreFailureLine } from "../lib/career-store/errors.ts";
import { seoulDate } from "../lib/career-store/interview/review-schedule.ts";
import {
  attemptBodySchema,
  interviewQuestionSchema,
  type AttemptBody,
  type InterviewQuestion,
} from "../lib/career-store/interview/schema.ts";
import { InterviewStore } from "../lib/career-store/interview/store.ts";
import { UsageError } from "../lib/cli.ts";
import {
  loadApplicationInterviewQuestions,
  type ApplicationInterviewQuestion,
} from "./application_question_schema.ts";
import { INTERVIEW_BARS, type FollowUpAxis, type InterviewBar } from "./follow-up-policy.ts";
import {
  dueForReview,
  selectFromBank,
  toDrillProgress,
  type DrillProgress,
} from "./question-selection.ts";
import { publicBehavioralQuestions, publicTechQuestions } from "./public-question-bank.ts";
import {
  loadCandidateMemory,
  type CandidateMemoryDocument,
  type ReadCandidateMemoryDocuments,
} from "./memory.ts";

export type DrillType = "tech" | "behavioral";
export type ScoreResult = "pass" | "shallow" | "fail" | "unknown";
export { toDrillProgress };
export type { DrillProgress, DrillProgressEntry } from "./question-selection.ts";
export type DrillQuestion = InterviewQuestion & {
  origin?: ApplicationInterviewQuestion["origin"];
  evidenceBoundary?: string;
  sourceScope?: "public" | "personal" | "application";
};

type Environment = Record<string, string | undefined>;

/** 작업 폴더의 SQLite 를 여는 면접 저장소다. 저장 자리는 이것 하나다(ADR-146). */
export function createInterviewStore(environment: Environment = process.env): InterviewStore {
  return new InterviewStore(openCareerStore(environment));
}
function loadApplicationQuestions(
  directory: string | undefined,
  drillType: DrillType,
): DrillQuestion[] {
  return directory
    ? loadApplicationInterviewQuestions(directory)
        .questions.filter((item) => item.drillType === drillType)
        .map((item) => ({ ...item, sourceScope: "application" }))
    : [];
}
export function loadQuestionBank(
  drillType: DrillType,
  directory?: string,
  personal: DrillQuestion[] = [],
): DrillQuestion[] {
  return [
    ...((drillType === "tech" ? publicTechQuestions : publicBehavioralQuestions) as unknown as DrillQuestion[]),
    ...personal.map((question) => ({ ...question, sourceScope: "personal" as const })),
    ...loadApplicationQuestions(directory, drillType),
  ];
}
function today(now: Date = new Date()): string {
  return seoulDate(now);
}
export function selectQuestions(
  drillType: DrillType,
  progress: DrillProgress,
  maxCount = 5,
  directory?: string,
  target?: InterviewBar,
  personal: DrillQuestion[] = [],
  currentDay: string = today(),
): DrillQuestion[] {
  return selectFromBank(loadQuestionBank(drillType, directory, personal), progress, {
    today: currentDay,
    maxCount,
    target,
    mixApplication: Boolean(directory),
  });
}
export function scoreAnswer(answer: string, question: DrillQuestion): ScoreResult {
  if (!answer.trim()) return "unknown";
  const ratio =
    question.answerSignals.filter((signal) => answer.toLowerCase().includes(signal.toLowerCase()))
      .length / question.answerSignals.length;
  return ratio >= 0.7 ? "pass" : ratio >= 0.3 ? "shallow" : "fail";
}
/** 작업 폴더 `context/` 에 에이전트가 옮겨 쓴 맥락 문서를 읽는다. 없는 문서는 `undefined` 다. */
function contextDocumentReader(environment: Environment): ReadCandidateMemoryDocuments {
  return async (keys) => {
    const root = resolveCareerStoreRoot(environment);
    const found: Awaited<ReturnType<ReadCandidateMemoryDocuments>> = {};
    for (const key of keys) {
      try {
        const { version, body } = readContextDocument(root, key);
        const document: CandidateMemoryDocument = { documentKey: key, version, body };
        found[key] = document;
      } catch (error) {
        if (!(error instanceof CareerStoreError && error.code === "CANDIDATE_CONTEXT_MISSING")) throw error;
      }
    }
    return found;
  };
}

function option(argv: string[], name: string, required = false): string | undefined {
  const index = argv.indexOf(name);
  const value = index < 0 ? undefined : argv[index + 1];
  if ((index >= 0 && (!value || value.startsWith("--"))) || (required && !value))
    throw new UsageError(`${name} 에 값이 필요합니다.`);
  return value;
}
function checkOptions(argv: string[], start: number, allowed: readonly string[]): void {
  for (let index = start; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new UsageError(`예상하지 않은 인자입니다: ${token}`);
    if (!allowed.includes(token)) throw new UsageError(`모르는 옵션입니다: ${token}`);
    index += 1;
  }
}
function type(value: string | undefined): DrillType {
  if (value !== "tech" && value !== "behavioral")
    throw new UsageError("drillType은 tech 또는 behavioral 이어야 합니다.");
  return value;
}
function usage(): string {
  return "Usage: drill-engine.ts memory | doctor | select <tech|behavioral> | progress <tech|behavioral> | record --input <json> | record --drill-type ... | personal list <tech|behavioral> | personal add --file <path> | personal disable --question-id <id>";
}
function parsePersonal(
  content: string,
  path: string,
): Array<{ drillType: DrillType; question: DrillQuestion }> {
  const entries = path.endsWith(".jsonl")
    ? content
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : (() => {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : [parsed];
      })();
  return entries.map((entry) => {
    const { drillType, ...question } = entry as Record<string, unknown>;
    const parsed = interviewQuestionSchema.safeParse(question);
    if (!parsed.success) throw new UsageError(parsed.error.message);
    return { drillType: type(drillType as string), question: parsed.data };
  });
}

export async function runDrillCli(
  argv: string[],
  deps: {
    createStore: () => InterviewStore;
    readFile: (path: string) => string;
    readContextDocuments?: ReadCandidateMemoryDocuments;
    environment?: Record<string, string | undefined>;
    /** `record --input` 이 만든 `attemptId` 를 입력 파일에 되쓴다. 없으면 되쓰지 않는다. */
    writeFile?: (path: string, content: string) => void;
    /** 오늘 날짜를 정하는 시계다. 테스트가 고정한다. */
    now?: () => Date;
  },
): Promise<unknown> {
  const environment = deps.environment ?? process.env;
  const readDocuments = deps.readContextDocuments ?? contextDocumentReader(environment);
  const currentDate = () => today(deps.now?.());
  if (argv[0] === "memory") {
    checkOptions(argv, 1, []);
    return loadCandidateMemory(environment, deps.readFile, readDocuments);
  }
  if (argv[0] === "doctor") {
    checkOptions(argv, 1, []);
    const checks: Array<{ name: string; ok: boolean; message: string }> = [];
    try {
      await deps.createStore().listProgress("tech");
      checks.push({ name: "CAREER_WORKSPACE", ok: true, message: "작업 폴더의 커리어 데이터 파일을 사용할 수 있습니다." });
    } catch (error) {
      checks.push({
        name: "CAREER_WORKSPACE",
        ok: false,
        message: `커리어 데이터 파일을 확인하지 못했습니다. CAREER_WORKSPACE_ROOT 가 쓸 수 있는 폴더인지 확인합니다: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    try {
      await loadCandidateMemory(environment, deps.readFile, readDocuments);
      checks.push({ name: "CAREER_MEMORY", ok: true, message: "후보자 맥락을 사용할 수 있습니다." });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const provider = environment.CAREER_MEMORY?.trim();
      const guide =
        provider === "file"
          ? "템플릿을 career-os/library/candidate-memory.json 으로 복사해 값을 채웁니다"
          : provider === "context"
            ? "작업 폴더의 context/career-status.md 와 context/application-state.md 에 맥락 문서 본문을 씁니다"
            : "CAREER_MEMORY 에 context 또는 file 을 설정합니다";
      checks.push({
        name: "CAREER_MEMORY",
        ok: false,
        message: `후보자 맥락을 확인하지 못했습니다. ${guide}: ${reason}`,
      });
    }
    return { passed: checks.every((check) => check.ok), checks };
  }
  if (argv[0] === "select") {
    checkOptions(argv, 2, ["--application-dir", "--target-bar", "--count"]);
    const drillType = type(argv[1]);
    const directory = option(argv, "--application-dir");
    const targetValue = option(argv, "--target-bar");
    const target =
      targetValue === undefined
        ? undefined
        : INTERVIEW_BARS.includes(targetValue as InterviewBar)
          ? (targetValue as InterviewBar)
          : (() => {
              throw new UsageError("--target-bar 값이 올바르지 않습니다.");
            })();
    const count = Number(option(argv, "--count") ?? "5");
    if (!Number.isInteger(count) || count < 1 || count > 10)
      throw new UsageError("--count 는 1 이상 10 이하여야 합니다.");
    const store = deps.createStore();
    const progress = toDrillProgress((await store.listProgress(drillType)).items);
    const personal = (await store.listEnabledPersonalQuestions(drillType)).items;
    const currentDay = currentDate();
    return {
      drillType,
      today: currentDay,
      questions: selectQuestions(drillType, progress, count, directory, target, personal, currentDay).map(
        (question) => ({
          ...question,
          dueForReview: dueForReview(progress, question.topic, currentDay),
        }),
      ),
    };
  }
  if (argv[0] === "progress") {
    checkOptions(argv, 2, []);
    const drillType = type(argv[1]);
    const currentDay = currentDate();
    const { items } = await deps.createStore().listProgress(drillType);
    return {
      drillType,
      today: currentDay,
      items: items.map((item) => ({
        ...item,
        dueForReview: item.nextReviewDate !== null && item.nextReviewDate <= currentDay,
      })),
    };
  }
  if (argv[0] === "record" && argv.includes("--input")) {
    // 질문과 피드백에 따옴표나 줄바꿈이 있어도 셸 인자로 깨지지 않게 JSON 파일로 받는다.
    checkOptions(argv, 1, ["--input"]);
    const inputPath = option(argv, "--input", true)!;
    let input: unknown;
    try {
      input = JSON.parse(deps.readFile(inputPath));
    } catch (error) {
      throw new UsageError(`--input 파일을 JSON 으로 읽지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
    }
    const record = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
    const body = attemptBodySchema.safeParse({ ...record, attemptId: record.attemptId ?? randomUUID() });
    if (!body.success) throw new UsageError(body.error.message);
    // 만든 attemptId 를 저장 전에 입력 파일에 되쓴다. 저장은 됐는데 출력을 받기 전에 셸이 끊겨
    // 같은 파일로 다시 실행해도 같은 attemptId 라 처음 응답을 돌려주고 한 번 더 쌓지 않는다.
    if (record.attemptId === undefined)
      deps.writeFile?.(inputPath, `${JSON.stringify({ ...record, attemptId: body.data.attemptId }, null, 2)}\n`);
    return deps.createStore().createAttempt(body.data);
  }
  if (argv[0] === "record") {
    checkOptions(argv, 1, [
      "--attempt-id",
      "--drill-type",
      "--question-id",
      "--topic",
      "--question",
      "--score",
      "--feedback",
      "--target-company",
      "--target-role",
      "--target-value-axis",
      "--root-question-id",
      "--parent-question",
      "--follow-up-depth",
      "--follow-up-axis",
      "--stop-reason",
    ]);
    const body = attemptBodySchema.safeParse({
      // 같은 기록을 다시 보낼 때만 넘긴다. 없으면 새 기록이다.
      attemptId: option(argv, "--attempt-id") ?? randomUUID(),
      drillType: type(option(argv, "--drill-type", true)),
      questionId: option(argv, "--question-id", true),
      topic: option(argv, "--topic", true),
      question: option(argv, "--question", true),
      score: option(argv, "--score", true),
      feedback: option(argv, "--feedback"),
      targetCompany: option(argv, "--target-company"),
      targetRole: option(argv, "--target-role"),
      targetValueAxis: option(argv, "--target-value-axis"),
      rootQuestionId: option(argv, "--root-question-id"),
      parentQuestion: option(argv, "--parent-question"),
      followUpDepth:
        option(argv, "--follow-up-depth") === undefined
          ? undefined
          : Number(option(argv, "--follow-up-depth")),
      followUpAxis: option(argv, "--follow-up-axis") as FollowUpAxis | undefined,
      stopReason: option(argv, "--stop-reason") as AttemptBody["stopReason"],
    });
    if (!body.success) throw new UsageError(body.error.message);
    return deps.createStore().createAttempt(body.data);
  }
  if (argv[0] === "personal" && argv[1] === "list") {
    checkOptions(argv, 3, []);
    const drillType = type(argv[2]);
    return { drillType, ...(await deps.createStore().listEnabledPersonalQuestions(drillType)) };
  }
  if (argv[0] === "personal" && argv[1] === "add") {
    checkOptions(argv, 2, ["--file"]);
    const path = option(argv, "--file", true)!;
    if (!path.endsWith(".json") && !path.endsWith(".jsonl"))
      throw new UsageError("--file 은 .json 또는 .jsonl 이어야 합니다.");
    let entries;
    try {
      entries = parsePersonal(deps.readFile(path), path);
    } catch (error) {
      throw error instanceof UsageError
        ? error
        : new UsageError(error instanceof Error ? error.message : String(error));
    }
    const store = deps.createStore();
    // 한 연결의 쓰기는 차례로 부른다(`CareerDatabase.transaction`).
    const saved = [];
    for (const { drillType, question } of entries)
      saved.push(await store.upsertPersonalQuestion(question.id, { enabled: true, drillType, question }));
    return { saved: saved.length, questionIds: saved.map((item) => item.questionId) };
  }
  if (argv[0] === "personal" && argv[1] === "disable") {
    checkOptions(argv, 2, ["--question-id"]);
    const questionId = option(argv, "--question-id", true)!;
    const store = deps.createStore();
    for (const drillType of ["tech", "behavioral"] as const) {
      const found = (await store.listEnabledPersonalQuestions(drillType)).items.find(
        (item) => item.id === questionId,
      );
      if (found) {
        await store.upsertPersonalQuestion(questionId, {
          enabled: false,
          drillType,
          question: found,
        });
        return { disabled: questionId };
      }
    }
    throw new UsageError(`개인 질문을 찾을 수 없습니다: ${questionId}`);
  }
  throw new UsageError(usage());
}
if (import.meta.main) {
  try {
    const result = await runDrillCli(process.argv.slice(2), {
      environment: process.env,
      createStore: () => createInterviewStore(process.env),
      readFile: (path) => readFileSync(path, "utf8"),
      writeFile: (path, content) => writeFileSync(path, content, "utf8"),
    });
    console.log(JSON.stringify(result));
    if (
      process.argv[2] === "doctor" &&
      typeof result === "object" &&
      result !== null &&
      "passed" in result &&
      result.passed === false
    )
      process.exitCode = 1;
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(usage());
      console.error(error.message);
      process.exitCode = 2;
    } else {
      console.error(careerStoreFailureLine(error) ?? (error instanceof Error ? error.message : String(error)));
      process.exitCode = 1;
    }
  }
}
