#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  attemptBodySchema,
  interviewQuestionSchema,
  type AttemptBody,
  type InterviewQuestion,
} from "../../services/career-backend/src/interview/schema.ts";
import { seoulDate } from "../../services/career-backend/src/interview/review-schedule.ts";
import { UsageError } from "../lib/cli.ts";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
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
import { createInterviewPracticeStore } from "./store/index.ts";
import type { InterviewPracticeStore } from "./store/port.ts";
import {
  loadCandidateMemory,
  type CandidateMemoryDocument,
  type ReadCandidateMemoryDocuments,
} from "./memory.ts";
import { createCandidateContextClient } from "../candidate-context/client.ts";

export type DrillType = "tech" | "behavioral";
export type ScoreResult = "pass" | "shallow" | "fail" | "unknown";
export { toDrillProgress };
export type { DrillProgress, DrillProgressEntry } from "./question-selection.ts";
export type DrillQuestion = InterviewQuestion & {
  origin?: ApplicationInterviewQuestion["origin"];
  evidenceBoundary?: string;
  sourceScope?: "public" | "personal" | "application";
};

function repoRoot(): string {
  return join(dirname(import.meta.path), "..", "..", "..");
}
function careerOsRoot(): string {
  return join(repoRoot(), "career-os");
}
const TECH_CATEGORIES = [
  "java-spring",
  "database",
  "cs",
  "operations",
  "system-design",
  "ai-platform",
] as const;
function loadPublicTechQuestions(): DrillQuestion[] {
  const result: DrillQuestion[] = [];
  for (const category of TECH_CATEGORIES) {
    const path = join(careerOsRoot(), "public", "question-bank", category, "questions.json");
    if (existsSync(path))
      result.push(...(JSON.parse(readFileSync(path, "utf8")) as DrillQuestion[]));
  }
  return result;
}
function loadPublicBehavioralQuestions(): DrillQuestion[] {
  const path = join(careerOsRoot(), "public", "question-bank", "behavioral", "questions.json");
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as DrillQuestion[]) : [];
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
    ...(drillType === "tech" ? loadPublicTechQuestions() : loadPublicBehavioralQuestions()),
    ...personal.map((question) => ({ ...question, sourceScope: "personal" as const })),
    ...loadApplicationQuestions(directory, drillType),
  ];
}
function today(): string {
  return seoulDate(new Date());
}
export function selectQuestions(
  drillType: DrillType,
  progress: DrillProgress,
  maxCount = 5,
  directory?: string,
  target?: InterviewBar,
  personal: DrillQuestion[] = [],
): DrillQuestion[] {
  return selectFromBank(loadQuestionBank(drillType, directory, personal), progress, {
    today: today(),
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
async function readContextDocuments(
  keys: Parameters<ReadCandidateMemoryDocuments>[0],
): ReturnType<ReadCandidateMemoryDocuments> {
  const client = createCandidateContextClient();
  const entries = await Promise.all(
    keys.map(async (key) => {
      try {
        const { version, body } = await client.getDocument(key);
        const document: CandidateMemoryDocument = { documentKey: key, version, body };
        return [key, document] as const;
      } catch (error) {
        if (error instanceof CareerBackendHttpError && error.status === 404) return [key, undefined] as const;
        throw error;
      }
    }),
  );
  return Object.fromEntries(entries);
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
  return "Usage: drill-engine.ts memory | doctor | select <tech|behavioral> | record --attempt-id ... | personal add --file <path> | personal disable --question-id <id>";
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
    createStore: () => InterviewPracticeStore;
    readFile: (path: string) => string;
    readContextDocuments?: ReadCandidateMemoryDocuments;
    environment?: Record<string, string | undefined>;
  },
): Promise<unknown> {
  const environment = deps.environment ?? process.env;
  const readDocuments = deps.readContextDocuments ?? readContextDocuments;
  if (argv[0] === "memory") {
    checkOptions(argv, 1, []);
    return loadCandidateMemory(environment, deps.readFile, readDocuments);
  }
  if (argv[0] === "doctor") {
    checkOptions(argv, 1, []);
    const checks: Array<{ name: string; ok: boolean; message: string }> = [];
    const store = environment.CAREER_STORE?.trim();
    if (store !== "backend" && store !== "file") {
      checks.push({
        name: "CAREER_STORE",
        ok: false,
        message: "CAREER_STORE 에 backend 또는 file 을 설정한다.",
      });
    } else {
      try {
        if (store === "file") {
          const directory = environment.CAREER_STORE_DIR?.trim() || join(careerOsRoot(), "state", "interview-practice");
          mkdirSync(directory, { recursive: true });
        }
        await deps.createStore().listProgress("tech");
        checks.push({ name: "CAREER_STORE", ok: true, message: `${store} 저장소를 사용할 수 있습니다.` });
      } catch (error) {
        checks.push({
          name: "CAREER_STORE",
          ok: false,
          message: `저장소를 확인하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
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
          : provider === "backend"
            ? "CAREER_BACKEND_URL 과 token 연결값, career-status 와 application-state 문서가 있는지 확인합니다"
            : "CAREER_MEMORY 에 backend 또는 file 을 설정합니다";
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
    const progress = toDrillProgress(await store.listProgress(drillType));
    const personal = (await store.listPersonalQuestions(drillType)).map((item) => item.question);
    const currentDay = today();
    return {
      store: store.kind,
      drillType,
      today: currentDay,
      questions: selectQuestions(drillType, progress, count, directory, target, personal).map(
        (question) => ({
          ...question,
          dueForReview: dueForReview(progress, question.topic, currentDay),
        }),
      ),
    };
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
      attemptId: option(argv, "--attempt-id", true),
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
    return deps.createStore().recordAttempt(body.data);
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
    const saved = await Promise.all(
      entries.map(({ drillType, question }) =>
        store.upsertPersonalQuestion(question.id, { enabled: true, drillType, question }),
      ),
    );
    return { saved: saved.length, questionIds: saved.map((item) => item.questionId) };
  }
  if (argv[0] === "personal" && argv[1] === "disable") {
    checkOptions(argv, 2, ["--question-id"]);
    const questionId = option(argv, "--question-id", true)!;
    const store = deps.createStore();
    for (const drillType of ["tech", "behavioral"] as const) {
      const found = (await store.listPersonalQuestions(drillType)).find(
        (item) => item.questionId === questionId,
      );
      if (found) {
        await store.upsertPersonalQuestion(questionId, {
          enabled: false,
          drillType,
          question: found.question,
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
      createStore: () => createInterviewPracticeStore(process.env),
      readFile: (path) => readFileSync(path, "utf8"),
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
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        error instanceof CareerBackendHttpError && error.code === "NETWORK_ERROR"
          ? `커리어 Backend에 연결하지 못했습니다. 연습 결과는 기록되지 않았습니다. ${message}`
          : message,
      );
      process.exitCode = 1;
    }
  }
}
