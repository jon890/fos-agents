#!/usr/bin/env bun

/**
 * 공용 드릴 엔진 — tech-interview-drill · behavioral-interview-drill 공통 로직
 *
 * 간격 반복 기반 질문 선정, 답변 채점, 드릴 로그 기록, weak_spots 갱신,
 * study-pack-writer 위임 판단을 담당한다.
 *
 * 의존 파일:
 *   - career-os/public/question-bank/{기술 카테고리}/questions.json  (tech)
 *   - career-os/public/question-bank/behavioral/questions.json  (behavioral)
 *   - career-os/private/question-bank/{tech|behavioral}-personal.jsonl  (있으면 merge)
 *   - career-os/config/study-progress.json
 *   - career-os/data/runtime/drill-log-YYYY-MM-DD.jsonl  (자동 생성)
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  appendFileSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export type DrillType = "tech" | "behavioral";
export type ScoreResult = "pass" | "shallow" | "fail" | "unknown";

export interface DrillQuestion {
  id: string;
  topic: string;
  category: string;
  difficulty: "basic" | "intermediate" | "advanced";
  question: string;
  intent: string;
  answerSignals: string[];
  followUps?: string[];
}

export interface WeakSpotEntry {
  last_studied: string | null;
  study_count: number;
  last_evaluated: string | null;
  status: string;
  // 드릴 엔진이 관리하는 필드
  pass_count?: number;
  fail_count?: number;
  next_review_date?: string | null;
  last_passed?: string | null;
}

export interface StudyProgress {
  sessions: unknown[];
  weak_spots: Record<string, WeakSpotEntry>;
}

export interface DrillLogEntry {
  ts: string;
  drillType: DrillType;
  questionId: string;
  topic: string;
  question: string;
  score: ScoreResult;
  studyPackDispatched?: boolean;
}

// ─── 경로 헬퍼 ───────────────────────────────────────────────────────────────

function repoRoot(): string {
  // 스크립트가 career-os/scripts/interview-drill/ 안에 있다고 가정
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
] as const;

function studyProgressPath(): string {
  return join(careerOsRoot(), "config", "study-progress.json");
}

function drillLogPath(date?: string): string {
  const d = date ?? new Date().toISOString().slice(0, 10);
  const dir = join(careerOsRoot(), "data", "runtime");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, `drill-log-${d}.jsonl`);
}

// ─── 질문 풀 로드 ─────────────────────────────────────────────────────────────

function loadPublicTechQuestions(): DrillQuestion[] {
  const questions: DrillQuestion[] = [];
  for (const cat of TECH_CATEGORIES) {
    const path = join(careerOsRoot(), "public", "question-bank", cat, "questions.json");
    if (!existsSync(path)) continue;
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as DrillQuestion[];
    questions.push(...parsed);
  }
  return questions;
}

function loadPublicBehavioralQuestions(): DrillQuestion[] {
  const path = join(careerOsRoot(), "public", "question-bank", "behavioral", "questions.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8")) as DrillQuestion[];
}

function mergePrivateQuestions(
  base: DrillQuestion[],
  drillType: DrillType
): DrillQuestion[] {
  const privatePath = join(
    careerOsRoot(),
    "private",
    "question-bank",
    `${drillType}-personal.jsonl`
  );
  if (!existsSync(privatePath)) return base;

  const requiredFields: (keyof DrillQuestion)[] = [
    "id",
    "topic",
    "category",
    "difficulty",
    "question",
    "intent",
    "answerSignals",
  ];
  const lines = readFileSync(privatePath, "utf-8")
    .split("\n")
    .filter((l) => l.trim());
  const privateQuestions: DrillQuestion[] = [];
  for (const line of lines) {
    try {
      const q = JSON.parse(line) as Partial<DrillQuestion>;
      const missing = requiredFields.filter((f) => !q[f]);
      if (missing.length > 0) {
        console.warn(
          `[drill-engine] private 항목 건너뜀 (누락 필드: ${missing.join(", ")}): ${line.slice(0, 80)}`
        );
        continue;
      }
      privateQuestions.push(q as DrillQuestion);
    } catch {
      console.warn(`[drill-engine] private JSONL 파싱 실패, 건너뜀: ${line.slice(0, 80)}`);
    }
  }
  return [...base, ...privateQuestions];
}

export function loadQuestionBank(drillType: DrillType): DrillQuestion[] {
  const publicQuestions =
    drillType === "tech"
      ? loadPublicTechQuestions()
      : loadPublicBehavioralQuestions();

  const merged = mergePrivateQuestions(publicQuestions, drillType);

  if (merged.length === 0) {
    console.error(
      `[drill-engine] 질문 풀 없음 (${drillType})\n` +
        `  → /question-bank-collector ${drillType} 로 보강하세요.`
    );
  }
  return merged;
}

// ─── 간격 반복 날짜 계산 ──────────────────────────────────────────────────────

const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60];

function nextReviewDays(passCount: number): number {
  const idx = Math.min(passCount, REVIEW_INTERVALS_DAYS.length - 1);
  return REVIEW_INTERVALS_DAYS[idx];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── 질문 선정 (간격 반복) ────────────────────────────────────────────────────

/**
 * 오늘 복습 대상 우선, 이후 신규·약점 순으로 최대 maxCount 개 반환.
 * next_review_date <= today 인 질문 우선, pass된 지 얼마 안 된 질문은 제외.
 */
export function selectQuestions(
  drillType: DrillType,
  weakSpots: Record<string, WeakSpotEntry>,
  maxCount = 5
): DrillQuestion[] {
  const bank = loadQuestionBank(drillType);
  if (bank.length === 0) return [];

  const todayStr = today();

  // 각 질문의 우선순위 점수 계산
  const scored = bank.map((q) => {
    const ws = weakSpots[q.topic];
    const nextReview = ws?.next_review_date ?? null;
    const passCount = ws?.pass_count ?? 0;

    // 오늘 복습 대상 여부
    const isDue = !nextReview || nextReview <= todayStr;
    // 최근 통과 여부 (하루 이내)
    const recentlyPassed =
      ws?.last_passed != null && ws.last_passed >= addDays(todayStr, -1);

    // 우선순위: 복습 대상 > 미시도 약점 > 신규
    let priority = 0;
    if (recentlyPassed) priority = -1; // 제외
    else if (isDue && (ws?.fail_count ?? 0) > 0) priority = 3; // 약점 복습
    else if (isDue && passCount === 0) priority = 2; // 미시도
    else if (isDue) priority = 1; // 일반 복습

    return { q, priority };
  });

  return scored
    .filter((s) => s.priority >= 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxCount)
    .map((s) => s.q);
}

// ─── 답변 채점 ────────────────────────────────────────────────────────────────

/**
 * 답변 텍스트와 질문의 answerSignals를 비교해 점수를 반환한다.
 * 실제 LLM 채점은 스킬(SKILL.md)이 담당하고, 이 함수는 기계적 점검용.
 */
export function scoreAnswer(
  answer: string,
  question: DrillQuestion
): ScoreResult {
  if (!answer || answer.trim().length === 0) return "unknown";

  const lower = answer.toLowerCase();
  const matchedSignals = question.answerSignals.filter((sig) =>
    lower.includes(sig.toLowerCase())
  );

  const ratio = matchedSignals.length / question.answerSignals.length;
  if (ratio >= 0.7) return "pass";
  if (ratio >= 0.3) return "shallow";
  return "fail";
}

// ─── 드릴 로그 기록 ──────────────────────────────────────────────────────────

export function recordDrillLog(entry: DrillLogEntry): void {
  const path = drillLogPath();
  appendFileSync(path, JSON.stringify(entry) + "\n", "utf-8");
}

// ─── weak_spots 갱신 ──────────────────────────────────────────────────────────

export function updateWeakSpots(
  question: DrillQuestion,
  score: ScoreResult
): void {
  const path = studyProgressPath();
  if (!existsSync(path)) {
    console.error(`[drill-engine] study-progress.json 없음: ${path}`);
    return;
  }

  const progress: StudyProgress = JSON.parse(readFileSync(path, "utf-8"));
  if (!progress.weak_spots) progress.weak_spots = {};

  const ws: WeakSpotEntry = progress.weak_spots[question.topic] ?? {
    last_studied: null,
    study_count: 0,
    last_evaluated: null,
    status: "new",
    pass_count: 0,
    fail_count: 0,
    next_review_date: null,
    last_passed: null,
  };

  const todayStr = today();
  ws.last_evaluated = todayStr;
  ws.study_count = (ws.study_count ?? 0) + 1;

  if (score === "pass") {
    ws.pass_count = (ws.pass_count ?? 0) + 1;
    ws.fail_count = ws.fail_count ?? 0;
    ws.last_passed = todayStr;
    ws.last_studied = todayStr;
    ws.next_review_date = addDays(todayStr, nextReviewDays(ws.pass_count));
    ws.status = ws.pass_count >= 3 ? "strong" : "improving";
  } else if (score === "shallow") {
    ws.fail_count = (ws.fail_count ?? 0) + 1;
    ws.next_review_date = addDays(todayStr, 1); // 내일 재시도
    ws.status = "shallow";
  } else if (score === "fail" || score === "unknown") {
    ws.fail_count = (ws.fail_count ?? 0) + 1;
    ws.next_review_date = addDays(todayStr, 1);
    ws.status = score === "unknown" ? "unknown" : "stale";
  }

  progress.weak_spots[question.topic] = ws;
  writeFileSync(path, JSON.stringify(progress, null, 2) + "\n", "utf-8");
}

// ─── study-pack-writer 위임 판단 ─────────────────────────────────────────────

/**
 * 같은 토픽 2회 이상 틀림·모름이면 true 반환.
 * 과생성 방지: 오늘 이미 dispatched 기록이 있으면 false.
 */
export function shouldDispatchStudyPack(
  weakSpots: Record<string, WeakSpotEntry>,
  topic: string,
  alreadyDispatchedToday: Set<string>
): boolean {
  if (alreadyDispatchedToday.has(topic)) return false;

  const ws = weakSpots[topic];
  if (!ws) return false;

  const failCount = ws.fail_count ?? 0;
  return failCount >= 2;
}

// ─── CLI 직접 실행 (진단용) ───────────────────────────────────────────────────

if (import.meta.main) {
  const drillType: DrillType = (process.argv[2] as DrillType) ?? "tech";
  const progress: StudyProgress = existsSync(studyProgressPath())
    ? JSON.parse(readFileSync(studyProgressPath(), "utf-8"))
    : { sessions: [], weak_spots: {} };

  const questions = selectQuestions(drillType, progress.weak_spots);
  if (questions.length === 0) {
    console.log(
      "오늘 드릴할 질문이 없습니다. /question-bank-collector 로 질문 풀을 보강하세요."
    );
  } else {
    console.log(`[${drillType}] 오늘 드릴 질문 ${questions.length}개:`);
    questions.forEach((q, i) => {
      console.log(`  ${i + 1}. [${q.topic}] ${q.question}`);
    });
  }
}
