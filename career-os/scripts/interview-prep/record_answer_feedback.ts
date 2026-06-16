#!/usr/bin/env bun
/**
 * Record an interview-drill answer and create a feedback workspace.
 *
 * This script intentionally does not call an LLM. It gives the morning drill a
 * durable answer trail so a later feedback pass can evaluate the answer without
 * losing context in Discord scrollback.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { parseMvpTarget } from "../interview-prep-analyzer/mvp_target_schema";

// career-os root = 이 스크립트(career-os/scripts/<skill>/)에서 2단계 위.
// CAREER_OS_ROOT env가 있으면 우선 — 어떤 체크아웃 위치에서도 동작 (하드코딩 제거).
const ROOT = process.env.CAREER_OS_ROOT
  ? resolve(process.env.CAREER_OS_ROOT)
  : resolve(import.meta.dir, "..", "..");
const TZ = "Asia/Seoul";

interface Args {
  questionId: string;
  answer: string;
  note: string;
  date: string;
}

function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function usage(): never {
  console.error(`usage: bun scripts/interview-prep/record_answer_feedback.ts --question-id Q1 (--answer "..." | --answer-file path) [--note "..."] [--date YYYY-MM-DD]

Records to:
  <mvp-target data_root>/interview/answers/YYYY-MM-DD.jsonl
  <mvp-target data_root>/interview/feedback/YYYY-MM-DD.md`);
  process.exit(2);
}

function parseArgs(argv: string[]): Args {
  let questionId = "";
  let answer = "";
  let answerFile = "";
  let note = "";
  let date = todayKst();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--question-id" && argv[i + 1]) questionId = argv[++i];
    else if (arg === "--answer" && argv[i + 1]) answer = argv[++i];
    else if (arg === "--answer-file" && argv[i + 1]) answerFile = argv[++i];
    else if (arg === "--note" && argv[i + 1]) note = argv[++i];
    else if (arg === "--date" && argv[i + 1]) date = argv[++i];
    else if (arg === "--help" || arg === "-h") usage();
  }

  if (answerFile) answer = readFileSync(answerFile, "utf-8");
  answer = answer.trim();
  questionId = questionId.trim();
  if (!questionId || !answer) usage();
  return { questionId, answer, note: note.trim(), date };
}

function readOptional(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

function resolveDataRoot(): string {
  const targetPath = join(ROOT, "config", "mvp-target.json");
  const target = parseMvpTarget(targetPath);
  const dataRoot = target.primary.data_root.trim();
  if (!dataRoot || dataRoot.includes("..") || dataRoot.startsWith("/")) {
    throw new Error("config/mvp-target.json primary.data_root must be a safe relative path");
  }
  return join(ROOT, dataRoot);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const dataRoot = resolveDataRoot();
  const prepPath = join(dataRoot, "interview", "prep.md");
  const answerDir = join(dataRoot, "interview", "answers");
  const answerLog = join(answerDir, `${args.date}.jsonl`);
  const feedbackDir = join(dataRoot, "interview", "feedback");
  const feedbackPath = join(feedbackDir, `${args.date}.md`);
  const prep = readOptional(prepPath);

  mkdirSync(answerDir, { recursive: true });
  mkdirSync(feedbackDir, { recursive: true });

  const entry = {
    recordedAt: new Date().toISOString(),
    date: args.date,
    questionId: args.questionId,
    answer: args.answer,
    note: args.note,
    sourcePrep: prepPath,
  };
  appendFileSync(answerLog, JSON.stringify(entry) + "\n", "utf-8");

  const md = [
    `# 면접 답변 피드백 워크스페이스 — ${args.date}`,
    "",
    `- 질문 ID: ${args.questionId}`,
    `- 답변 로그: ${answerLog}`,
    `- 면접 준비 정본: ${prepPath}`,
    "",
    "## 사용자 답변",
    "",
    args.answer,
    "",
    "## 평가 체크리스트",
    "",
    "- 결론을 첫 문장에 말했는가",
    "- 실제 경험 근거가 포함됐는가",
    "- 기술 선택의 trade-off를 말했는가",
    "- 장애/운영/관찰성 관점까지 확장했는가",
    "- CJ Foodville 디지털 채널 백엔드 맥락으로 연결했는가",
    "",
    "## 다음 피드백 패스에서 채울 내용",
    "",
    "- 좋은 점:",
    "- 부족한 점:",
    "- 더 나은 60초 답변:",
    "- 예상 꼬리질문:",
    "- 누적 약점 태그:",
    "",
    "## 면접 준비 정본",
    "",
    prep || "(position home interview/prep.md 없음)",
    "",
  ].join("\n");

  writeFileSync(feedbackPath, md, "utf-8");
  console.log(JSON.stringify({ answerLog, feedbackPath }, null, 0));
}

main();
