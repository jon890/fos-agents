#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

type Difficulty = "basic" | "intermediate" | "advanced";

interface QuestionItem {
  id: string;
  category: string;
  difficulty: Difficulty;
  question: string;
  intent: string;
  answerSignals: string[];
  source: string;
  publicSafe: boolean;
  positionFitHint: string;
  normalizedFrom: string;
  tags?: string[];
  followUps?: string[];
}

const ROOT = process.cwd();
const BANK_ROOT = join(ROOT, "public", "question-bank");
const CATEGORIES = ["java-spring", "database", "cs", "operations", "system-design"];
const DIFFICULTIES = new Set(["basic", "intermediate", "advanced"]);
const REQUIRED_FIELDS: Array<keyof QuestionItem> = [
  "id",
  "category",
  "difficulty",
  "question",
  "intent",
  "answerSignals",
  "source",
  "publicSafe",
  "positionFitHint",
  "normalizedFrom",
];

const PRIVATE_PATTERNS = [
  /회사별 비공개/,
  /개인 이력/,
  /내 경력/,
  /합격 후기 원문/,
  /면접 후기 원문/,
  /유료 강의 원문/,
  /문제집 원문/,
  /private answer/i,
  /non[- ]public/i,
];

const BOUNDARY_ONLY_PATTERNS = [/private 답변/, /지원 전략/, /유료 강의/, /문제집/];

function fail(message: string): never {
  console.error(`QUESTION_BANK_VALIDATE_FAIL: ${message}`);
  process.exit(1);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function readJsonArray(path: string): QuestionItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    fail(`${path}: JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  assert(Array.isArray(parsed), `${path}: expected JSON array`);
  return parsed as QuestionItem[];
}

function validateTextSafety(path: string, item: QuestionItem): void {
  const text = JSON.stringify(item);
  for (const pattern of PRIVATE_PATTERNS) {
    assert(!pattern.test(text), `${path}: ${item.id} contains private/copyright risk pattern ${pattern}`);
  }
  for (const pattern of BOUNDARY_ONLY_PATTERNS) {
    assert(!pattern.test(text), `${path}: ${item.id} should not use boundary-only phrase ${pattern} inside item`);
  }
}

function validateItem(path: string, item: QuestionItem, expectedCategory: string): void {
  for (const field of REQUIRED_FIELDS) {
    assert(item[field] !== undefined && item[field] !== null, `${path}: missing ${field}`);
  }
  assert(typeof item.id === "string" && item.id.startsWith(`${expectedCategory}-`), `${path}: invalid id ${item.id}`);
  assert(item.category === expectedCategory, `${path}: ${item.id} category must be ${expectedCategory}`);
  assert(DIFFICULTIES.has(item.difficulty), `${path}: ${item.id} invalid difficulty ${item.difficulty}`);
  assert(typeof item.question === "string" && item.question.trim().length >= 20, `${path}: ${item.id} question too short`);
  assert(typeof item.intent === "string" && item.intent.trim().length >= 10, `${path}: ${item.id} intent too short`);
  assert(Array.isArray(item.answerSignals) && item.answerSignals.length >= 2, `${path}: ${item.id} needs answerSignals`);
  assert(item.answerSignals.every((value) => typeof value === "string" && value.trim()), `${path}: ${item.id} invalid answerSignals`);
  assert(typeof item.source === "string" && item.source.startsWith("public-"), `${path}: ${item.id} source must be public-*`);
  assert(item.publicSafe === true, `${path}: ${item.id} publicSafe must be true`);
  assert(typeof item.positionFitHint === "string" && item.positionFitHint.trim().length >= 10, `${path}: ${item.id} positionFitHint too short`);
  assert(typeof item.normalizedFrom === "string" && item.normalizedFrom.trim().length >= 10, `${path}: ${item.id} normalizedFrom too short`);
  if (item.tags !== undefined) {
    assert(Array.isArray(item.tags) && item.tags.every((value) => typeof value === "string" && value.trim()), `${path}: ${item.id} invalid tags`);
  }
  if (item.followUps !== undefined) {
    assert(Array.isArray(item.followUps) && item.followUps.every((value) => typeof value === "string" && value.trim()), `${path}: ${item.id} invalid followUps`);
  }
  validateTextSafety(path, item);
}

function main(): void {
  assert(existsSync(BANK_ROOT), `${BANK_ROOT} does not exist`);
  assert(existsSync(join(BANK_ROOT, "README.md")), "public/question-bank/README.md is missing");

  const ids = new Set<string>();
  const questions = new Map<string, string>();
  let total = 0;

  for (const category of CATEGORIES) {
    const categoryDir = join(BANK_ROOT, category);
    assert(existsSync(categoryDir) && statSync(categoryDir).isDirectory(), `${categoryDir} is missing`);
    const files = readdirSync(categoryDir)
      .filter((file) => file.endsWith(".json"))
      .sort();
    assert(files.length > 0, `${categoryDir} has no JSON seed files`);

    for (const file of files) {
      const path = join(categoryDir, file);
      const items = readJsonArray(path);
      assert(items.length > 0, `${path}: empty question array`);
      for (const item of items) {
        validateItem(path, item, category);
        assert(!ids.has(item.id), `${path}: duplicate id ${item.id}`);
        ids.add(item.id);

        const normalizedQuestion = item.question.replace(/\s+/g, " ").trim();
        const duplicateOwner = questions.get(normalizedQuestion);
        assert(!duplicateOwner, `${path}: duplicate question with ${duplicateOwner}`);
        questions.set(normalizedQuestion, item.id);
        total++;
      }
    }
  }

  assert(total >= 15, `expected at least 15 seed questions, got ${total}`);
  console.log(JSON.stringify({ status: "ok", categories: CATEGORIES.length, questions: total }, null, 2));
}

main();
