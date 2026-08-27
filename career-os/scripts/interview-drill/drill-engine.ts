#!/usr/bin/env bun

/**
 * interview-practice의 기술·인성 모드가 공유하는 답변 연습 엔진
 *
 * 간격 반복 기반 질문 선정, 답변 채점, 답변 연습 로그 기록, 복습 상태 갱신,
 * 질문 선정, 채점, 기록, 약점 환류를 담당한다.
 *
 * 의존 파일:
 *   - career-os/public/question-bank/{기술 카테고리}/questions.json  (tech)
 *   - career-os/public/question-bank/behavioral/questions.json  (behavioral)
 *   - career-os/private/question-bank/{tech|behavioral}-personal.jsonl  (있으면 merge)
 *   - applications/<company>/<position>/interview-questions.json  (--application-dir로 지정)
 *   - career-os/state/drill-progress.json  (드릴 간격 반복 상태)
 *   - career-os/state/drill-log-YYYY-MM-DD.jsonl  (자동 생성)
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  appendFileSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import {
  loadApplicationInterviewQuestions,
  type ApplicationInterviewQuestion,
} from "./application_question_schema.ts";
import {
  INTERVIEW_BARS,
  inferredInterviewBar,
  type FollowUpAxis,
  type InterviewBar,
} from "./follow-up-policy.ts";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export type DrillType = "tech" | "behavioral";
export type ScoreResult = "pass" | "shallow" | "fail" | "unknown";

export interface DrillQuestion {
  id: string;
  topic: string;
  category: string;
  difficulty: "basic" | "intermediate" | "advanced";
  bar?: InterviewBar;
  question: string;
  intent: string;
  answerSignals: string[];
  followUps?: string[];
  positionFitHint?: string;
  tags?: string[];
  sequenceHint?: "opening" | "early" | "middle" | "late" | "closing";
  origin?: ApplicationInterviewQuestion["origin"];
  evidenceBoundary?: string;
  sourceScope?: "public" | "personal" | "application";
}

/** 드릴 간격 반복 상태 */
export interface DrillProgressEntry {
  pass_count?: number;
  fail_count?: number;
  next_review_date?: string | null;
  last_passed?: string | null;
}

export type DrillProgress = Record<string, DrillProgressEntry>;

export interface DrillLogEntry {
  ts: string;
  drillType: DrillType;
  questionId: string;
  topic: string;
  question: string;
  score: ScoreResult;
  studyPackDispatched?: boolean;
  targetCompany?: string;
  targetRole?: string;
  targetValueAxis?: string;
  rootQuestionId?: string;
  parentQuestion?: string;
  followUpDepth?: number;
  followUpAxis?: FollowUpAxis;
  stopReason?: "depth-limit" | "needs-study" | "answer-complete" | "session-ended";
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
  "ai-platform",
] as const;

function drillProgressPath(): string {
  return join(careerOsRoot(), "state", "drill-progress.json");
}

function loadDrillProgress(): DrillProgress {
  const path = drillProgressPath();
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8")) as DrillProgress;
}

function drillLogPath(date?: string): string {
  const d = date ?? new Date().toISOString().slice(0, 10);
  const dir = join(careerOsRoot(), "state");
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
      privateQuestions.push({ ...(q as DrillQuestion), sourceScope: "personal" });
    } catch {
      console.warn(`[drill-engine] private JSONL 파싱 실패, 건너뜀: ${line.slice(0, 80)}`);
    }
  }
  return [...base, ...privateQuestions];
}

function loadApplicationQuestions(
  applicationDirectory: string | undefined,
  drillType: DrillType,
): DrillQuestion[] {
  if (!applicationDirectory) return [];

  return loadApplicationInterviewQuestions(applicationDirectory).questions
    .filter((item) => item.drillType === drillType)
    .map((item) => ({ ...item, sourceScope: "application" }));
}

export function loadQuestionBank(
  drillType: DrillType,
  applicationDirectory?: string,
): DrillQuestion[] {
  const publicQuestions =
    drillType === "tech"
      ? loadPublicTechQuestions()
      : loadPublicBehavioralQuestions();

  const withPersonalQuestions = mergePrivateQuestions(publicQuestions, drillType);
  const merged = [
    ...withPersonalQuestions,
    ...loadApplicationQuestions(applicationDirectory, drillType),
  ];

  if (merged.length === 0) {
    console.error(
      `[drill-engine] 질문 풀 없음 (${drillType})\n` +
        `  → /interview-practice ${drillType} 질문 은행 보강으로 준비하세요.`
    );
  }
  return merged;
}

// ─── 간격 반복 날짜 계산 ──────────────────────────────────────────────────────

const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60];

function nextReviewDays(passCount: number): number {
  const idx = Math.min(Math.max(passCount - 1, 0), REVIEW_INTERVALS_DAYS.length - 1);
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

function applicationPriorityBoost(question: DrillQuestion): number {
  return question.sourceScope === "application" ? 10 : 0;
}

function interviewBar(question: DrillQuestion): InterviewBar {
  return question.bar ?? inferredInterviewBar(question.difficulty);
}

function barPriorityBoost(question: DrillQuestion, targetBar?: InterviewBar): number {
  if (!targetBar) return 0;
  const targetIndex = INTERVIEW_BARS.indexOf(targetBar);
  const questionIndex = INTERVIEW_BARS.indexOf(interviewBar(question));
  const distance = Math.abs(targetIndex - questionIndex);
  if (distance === 0) return 2;
  if (distance === 1) return 1;
  return 0;
}

function isWithinTargetBarWindow(
  question: DrillQuestion,
  targetBar?: InterviewBar,
): boolean {
  if (!targetBar) return true;

  const questionIndex = INTERVIEW_BARS.indexOf(interviewBar(question));
  const targetIndex = INTERVIEW_BARS.indexOf(targetBar);
  if (targetBar === "global-scale") {
    return questionIndex >= targetIndex - 1;
  }
  return questionIndex >= targetIndex && questionIndex <= targetIndex + 1;
}

function selectWithStretch(
  pool: Array<{ q: DrillQuestion; priority: number }>,
  count: number,
  targetBar?: InterviewBar,
): Array<{ q: DrillQuestion; priority: number }> {
  const selected = pool.slice(0, count);
  if (!targetBar || count === 0 || targetBar === "global-scale") return selected;

  const targetIndex = INTERVIEW_BARS.indexOf(targetBar);
  const stretchBar = INTERVIEW_BARS[targetIndex + 1];
  if (!stretchBar || selected.some((item) => interviewBar(item.q) === stretchBar)) {
    return selected;
  }

  const stretchQuestion = pool.find((item) => interviewBar(item.q) === stretchBar);
  if (!stretchQuestion) return selected;

  return [...selected.slice(0, -1), stretchQuestion];
}

function difficultyOrder(difficulty: DrillQuestion["difficulty"]): number {
  if (difficulty === "basic") return 0;
  if (difficulty === "intermediate") return 1;
  return 2;
}

function sequenceOrder(question: DrillQuestion): number {
  if (question.sequenceHint === "opening") return 0;
  if (question.sequenceHint === "early") return 1;
  if (question.sequenceHint === "middle") return 2;
  if (question.sequenceHint === "late") return 3;
  if (question.sequenceHint === "closing") return 4;

  if (question.difficulty === "basic") return 1;
  if (question.tags?.some((tag) => ["incident", "customer-impact"].includes(tag))) {
    return 3;
  }
  if (question.topic.includes("failure") || question.topic.includes("retry")) return 3;
  if (question.topic.includes("result")) return 4;
  return 2;
}

// ─── 질문 선정 (간격 반복) ────────────────────────────────────────────────────

/**
 * 오늘 복습 대상 우선, 이후 신규·약점 순으로 최대 maxCount 개 반환.
 * next_review_date <= today 인 질문 우선, pass된 지 얼마 안 된 질문은 제외.
 */
export function selectQuestions(
  drillType: DrillType,
  drillProgress: DrillProgress,
  maxCount = 5,
  applicationDirectory?: string,
  targetBar?: InterviewBar,
): DrillQuestion[] {
  const bank = loadQuestionBank(drillType, applicationDirectory);
  if (bank.length === 0) return [];

  const todayStr = today();

  // 각 질문의 우선순위 점수 계산
  const scored = bank.map((q) => {
    const ws = drillProgress[q.topic];
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

    if (priority >= 0) {
      priority += applicationPriorityBoost(q);
      priority += barPriorityBoost(q, targetBar);
    }

    return { q, priority };
  });

  const eligible = scored
    .filter((s) => s.priority >= 0 && isWithinTargetBarWindow(s.q, targetBar))
    .sort((a, b) => b.priority - a.priority);

  let selected = selectWithStretch(eligible, maxCount, targetBar);
  if (applicationDirectory && maxCount > 1) {
    const applicationQuota = Math.max(1, Math.ceil(maxCount * 0.6));
    const applicationQuestions = selectWithStretch(
      eligible.filter((item) => item.q.sourceScope === "application"),
      applicationQuota,
      targetBar,
    );
    const sharedQuestions = eligible
      .filter((item) => item.q.sourceScope !== "application")
      .slice(0, maxCount - applicationQuestions.length);
    const selectedIds = new Set(
      [...applicationQuestions, ...sharedQuestions].map((item) => item.q.id),
    );
    const fill = eligible
      .filter((item) => !selectedIds.has(item.q.id))
      .slice(0, maxCount - applicationQuestions.length - sharedQuestions.length);
    selected = [...applicationQuestions, ...sharedQuestions, ...fill];
  }

  return selected
    .sort((a, b) => {
      const sequenceDiff = sequenceOrder(a.q) - sequenceOrder(b.q);
      if (sequenceDiff !== 0) return sequenceDiff;

      const difficultyDiff = difficultyOrder(a.q.difficulty) - difficultyOrder(b.q.difficulty);
      if (difficultyDiff !== 0) return difficultyDiff;

      return a.q.id.localeCompare(b.q.id);
    })
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

// ─── 답변 연습 로그 기록 ──────────────────────────────────────────────────────

export function recordDrillLog(entry: DrillLogEntry): void {
  const path = drillLogPath();
  appendFileSync(path, JSON.stringify(entry) + "\n", "utf-8");
}

// ─── 복습 상태 갱신 ──────────────────────────────────────────────────────────

/**
 * 질문 주제별 통과·실패 횟수와 다음 복습일을 갱신한다.
 */
export function updateDrillProgressState(
  progress: DrillProgress,
  question: DrillQuestion,
  score: ScoreResult,
  evaluatedAt = today(),
): DrillProgress {
  const nextProgress = structuredClone(progress);
  const drillEntry: DrillProgressEntry = nextProgress[question.topic] ?? {
    pass_count: 0,
    fail_count: 0,
    next_review_date: null,
    last_passed: null,
  };

  if (score === "pass") {
    drillEntry.pass_count = (drillEntry.pass_count ?? 0) + 1;
    drillEntry.fail_count = drillEntry.fail_count ?? 0;
    drillEntry.last_passed = evaluatedAt;
    drillEntry.next_review_date = addDays(evaluatedAt, nextReviewDays(drillEntry.pass_count));
  } else if (score === "shallow") {
    drillEntry.fail_count = (drillEntry.fail_count ?? 0) + 1;
    drillEntry.next_review_date = addDays(evaluatedAt, 1);
  } else if (score === "fail" || score === "unknown") {
    drillEntry.fail_count = (drillEntry.fail_count ?? 0) + 1;
    drillEntry.next_review_date = addDays(evaluatedAt, 1);
  }

  nextProgress[question.topic] = drillEntry;
  return nextProgress;
}

export function updateDrillProgress(question: DrillQuestion, score: ScoreResult): void {
  const nextProgress = updateDrillProgressState(loadDrillProgress(), question, score);
  writeFileSync(drillProgressPath(), JSON.stringify(nextProgress, null, 2) + "\n", "utf-8");
}

// ─── CLI 직접 실행 (진단용) ───────────────────────────────────────────────────

if (import.meta.main) {
  const drillType: DrillType = (process.argv[2] as DrillType) ?? "tech";
  const applicationDirectoryIndex = process.argv.indexOf("--application-dir");
  const applicationDirectory =
    applicationDirectoryIndex >= 0 ? process.argv[applicationDirectoryIndex + 1] : undefined;
  const targetBarIndex = process.argv.indexOf("--target-bar");
  const requestedTargetBar = targetBarIndex >= 0 ? process.argv[targetBarIndex + 1] : undefined;
  const targetBar = INTERVIEW_BARS.includes(requestedTargetBar as InterviewBar)
    ? requestedTargetBar as InterviewBar
    : undefined;
  const drillProgress = loadDrillProgress();

  let questions: DrillQuestion[];
  try {
    questions = selectQuestions(drillType, drillProgress, 5, applicationDirectory, targetBar);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  if (questions.length === 0) {
    console.log(
      "오늘 연습할 질문이 없습니다. /interview-practice 질문 은행 보강으로 준비하세요."
    );
  } else {
    console.log(`[${drillType}] 오늘 연습 질문 ${questions.length}개:`);
    questions.forEach((q, i) => {
      console.log(`  ${i + 1}. [${q.topic}] ${q.question}`);
    });
  }
}
