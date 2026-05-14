#!/usr/bin/env bun
// render_question_bank.ts — Claude structured JSON → question-bank markdown
// Usage: render_question_bank.ts <raw-json> <output-md>
// ADR-022 TS 마이그레이션
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const EXPECTED_MAIN_QUESTIONS = 5;
const EXPECTED_FOLLOWUPS = 5;

interface Question {
  question: string;
  addedDate?: string;
  updatedDate?: string;
  interviewerIntent: string[];
  answerPoints: string[];
  oneMinuteAnswer: string[];
  pressureDefense: string[];
  weakAnswers: string[];
  followUps: string[];
}

interface QuestionBankData {
  title: string;
  trackSummary: string[];
  selfIntro: { oneMinute: string[]; targetRoleFit: string[] };
  motivationAndFit: { whyChange: string[]; whyTargetCompany: string[]; whyThisRole: string[] };
  questions: Question[];
  finalChecklist: string[];
}

function bullets(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}

function render(data: QuestionBankData): string {
  const questions = data.questions ?? [];
  if (questions.length !== EXPECTED_MAIN_QUESTIONS) {
    process.stderr.write(
      `question-bank validation failed: expected ${EXPECTED_MAIN_QUESTIONS} questions, got ${questions.length}\n`
    );
    process.exit(1);
  }
  for (let i = 0; i < questions.length; i++) {
    const followups = questions[i].followUps ?? [];
    if (followups.length !== EXPECTED_FOLLOWUPS) {
      process.stderr.write(
        `question-bank validation failed: question ${i + 1} followUp count is ${followups.length}\n`
      );
      process.exit(1);
    }
  }

  const lines: string[] = [
    `# ${data.title}`,
    "",
    "---",
    "",
    "## 이 트랙의 경험 요약",
    "",
    ...bullets(data.trackSummary),
    "",
    "## 1분 자기소개 준비",
    "",
    ...bullets(data.selfIntro.oneMinute),
    "",
    "## 타깃 회사/포지션 맞춤 연결 포인트",
    "",
    ...bullets(data.selfIntro.targetRoleFit),
    "",
    "## 지원 동기 / 회사 핏",
    "",
    "### 왜 이직하려는가",
    ...bullets(data.motivationAndFit.whyChange),
    "",
    "### 왜 카카오헬스케어 케어챗인가",
    ...bullets(data.motivationAndFit.whyTargetCompany),
    "",
    "### 왜 이 역할에 맞는가",
    ...bullets(data.motivationAndFit.whyThisRole),
    "",
  ];

  for (let idx = 1; idx <= questions.length; idx++) {
    const q = questions[idx - 1];
    const added = q.addedDate ?? "2026-04-18";
    const updated = q.updatedDate ?? "2026-04-18";
    lines.push(
      `## 메인 질문 ${idx}. ${q.question}`,
      "",
      `> 추가: ${added} | 업데이트: ${updated}`,
      "",
      "### 면접관이 실제로 보는 것",
      "",
      ...bullets(q.interviewerIntent),
      "",
      "### 실제 경험 기반 답변 포인트",
      "",
      ...bullets(q.answerPoints),
      "",
      "### 1분 답변 구조",
      "",
      ...bullets(q.oneMinuteAnswer),
      "",
      "### 압박 질문 방어 포인트",
      "",
      ...bullets(q.pressureDefense),
      "",
      "### 피해야 할 약한 답변",
      "",
      ...bullets(q.weakAnswers),
      "",
      "### 꼬리 질문 5개",
      ""
    );
    for (let fIdx = 1; fIdx <= q.followUps.length; fIdx++) {
      lines.push(`**F${idx}-${fIdx}.** ${q.followUps[fIdx - 1]}`, "");
    }
    lines.push("---", "");
  }

  lines.push("## 최종 준비 체크리스트", "", ...bullets(data.finalChecklist));
  return lines.join("\n").trimEnd() + "\n";
}

const [, , src, out] = process.argv;

if (!src || !out) {
  process.stderr.write("usage: render_question_bank.ts <raw-json> <output-md>\n");
  process.exit(1);
}

const text = readFileSync(src, "utf-8").trim();
if (!text) {
  process.stderr.write("question-bank validation failed: JSON output is empty\n");
  process.exit(1);
}

const envelope = JSON.parse(text);
const data: QuestionBankData = envelope.structured_output ?? envelope;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, render(data), "utf-8");
console.log(`Wrote question bank: ${out}`);
