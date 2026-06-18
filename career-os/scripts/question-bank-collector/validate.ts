#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

type Difficulty = "basic" | "intermediate" | "advanced";

export interface QuestionItem {
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
  topic: string;
  tags?: string[];
  followUps?: string[];
}

export interface QuestionBankInventoryOptions {
  root?: string;
  bankRoot?: string;
}

export interface QuestionBankInventoryItem {
  path: string;
  key: string;
  category: string;
  difficulty: Difficulty;
  tagsCandidate: string[];
  source: string;
  publicSafe: true;
  signalCount: number;
  followUpCount: number;
  mtimeMs: number | null;
  updatedAt: string | null;
}

export interface QuestionBankInventoryCategory {
  category: string;
  fileCount: number;
  questionCount: number;
}

export interface QuestionBankInventory {
  root: string;
  bankRoot: string;
  scannedFileCount: number;
  scannedQuestionCount: number;
  categories: QuestionBankInventoryCategory[];
  items: QuestionBankInventoryItem[];
}

const ROOT = process.cwd();
const BANK_ROOT = join(ROOT, "public", "question-bank");
const CATEGORIES = ["java-spring", "database", "cs", "operations", "system-design", "behavioral"];
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
  "topic",
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

export function fail(message: string): never {
  console.error(`QUESTION_BANK_VALIDATE_FAIL: ${message}`);
  process.exit(1);
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function readJsonArray(path: string): QuestionItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    throw new Error(`${path}: JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  assert(Array.isArray(parsed), `${path}: expected JSON array`);
  return parsed as QuestionItem[];
}

export function validateTextSafety(path: string, item: QuestionItem): void {
  const text = JSON.stringify(item);
  for (const pattern of PRIVATE_PATTERNS) {
    assert(!pattern.test(text), `${path}: ${item.id} contains private/copyright risk pattern ${pattern}`);
  }
  for (const pattern of BOUNDARY_ONLY_PATTERNS) {
    assert(!pattern.test(text), `${path}: ${item.id} should not use boundary-only phrase ${pattern} inside item`);
  }
}

export function validateItem(path: string, item: QuestionItem, expectedCategory: string): void {
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
  assert(typeof item.topic === "string" && /^[a-z0-9][a-z0-9+]*(-[a-z0-9+]+)*$/.test(item.topic), `${path}: ${item.id} topic must be kebab-case, got ${item.topic}`);
  if (item.tags !== undefined) {
    assert(Array.isArray(item.tags) && item.tags.every((value) => typeof value === "string" && value.trim()), `${path}: ${item.id} invalid tags`);
  }
  if (item.followUps !== undefined) {
    assert(Array.isArray(item.followUps) && item.followUps.every((value) => typeof value === "string" && value.trim()), `${path}: ${item.id} invalid followUps`);
  }
  validateTextSafety(path, item);
}

function normalizeRelativePath(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}

function fileMtime(path: string): { mtimeMs: number | null; updatedAt: string | null } {
  try {
    const stat = statSync(path);
    return { mtimeMs: stat.mtime.getTime(), updatedAt: stat.mtime.toISOString() };
  } catch {
    return { mtimeMs: null, updatedAt: null };
  }
}

function toInventoryItem(root: string, path: string, item: QuestionItem): QuestionBankInventoryItem {
  const { mtimeMs, updatedAt } = fileMtime(path);
  return {
    path: normalizeRelativePath(root, path),
    key: item.id,
    category: item.category,
    difficulty: item.difficulty,
    tagsCandidate: item.tags ?? [],
    source: item.source,
    publicSafe: true,
    signalCount: item.answerSignals.length,
    followUpCount: item.followUps?.length ?? 0,
    mtimeMs,
    updatedAt,
  };
}

export function scanQuestionBankInventory(opts: QuestionBankInventoryOptions = {}): QuestionBankInventory {
  const root = opts.root ?? ROOT;
  const bankRoot = opts.bankRoot ?? join(root, "public", "question-bank");

  assert(existsSync(bankRoot), `${bankRoot} does not exist`);
  assert(existsSync(join(bankRoot, "README.md")), "public/question-bank/README.md is missing");

  const ids = new Set<string>();
  const questions = new Map<string, string>();
  const categories: QuestionBankInventoryCategory[] = [];
  const inventoryItems: QuestionBankInventoryItem[] = [];
  let scannedFileCount = 0;
  let total = 0;

  for (const category of CATEGORIES) {
    const categoryDir = join(bankRoot, category);
    assert(existsSync(categoryDir) && statSync(categoryDir).isDirectory(), `${categoryDir} is missing`);
    const files = readdirSync(categoryDir)
      .filter((file) => file.endsWith(".json"))
      .sort();
    assert(files.length > 0, `${categoryDir} has no JSON seed files`);

    let categoryQuestionCount = 0;
    for (const file of files) {
      const path = join(categoryDir, file);
      scannedFileCount++;
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
        inventoryItems.push(toInventoryItem(root, path, item));
        categoryQuestionCount++;
        total++;
      }
    }
    categories.push({ category, fileCount: files.length, questionCount: categoryQuestionCount });
  }

  assert(total >= 15, `expected at least 15 seed questions, got ${total}`);
  inventoryItems.sort((a, b) => a.key.localeCompare(b.key));

  return {
    root,
    bankRoot,
    scannedFileCount,
    scannedQuestionCount: total,
    categories,
    items: inventoryItems,
  };
}

export function main(): void {
  try {
    const inventory = scanQuestionBankInventory();
    console.log(JSON.stringify({
      status: "ok",
      categories: inventory.categories.length,
      questions: inventory.scannedQuestionCount,
    }, null, 2));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

if (import.meta.main) {
  main();
}
