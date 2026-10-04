import { INTERVIEW_BARS, inferredInterviewBar, type InterviewBar } from "./follow-up-policy.ts";

export type SelectableQuestion = {
  id: string;
  topic: string;
  category: string;
  difficulty: "basic" | "intermediate" | "advanced";
  question: string;
  intent: string;
  answerSignals: string[];
  bar?: InterviewBar;
  followUps?: string[];
  positionFitHint?: string;
  tags?: string[];
  sequenceHint?: "opening" | "early" | "middle" | "late" | "closing";
  sourceScope?: "public" | "personal" | "application";
};
export type DrillProgressEntry = {
  pass_count?: number;
  fail_count?: number;
  next_review_date?: string | null;
  last_passed?: string | null;
};
export type DrillProgress = Record<string, DrillProgressEntry>;

function previousDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}
function interviewBar(question: SelectableQuestion): InterviewBar {
  return question.bar ?? inferredInterviewBar(question.difficulty);
}
function barPriorityBoost(question: SelectableQuestion, target?: InterviewBar): number {
  if (!target) return 0;
  const distance = Math.abs(
    INTERVIEW_BARS.indexOf(target) - INTERVIEW_BARS.indexOf(interviewBar(question)),
  );
  return distance === 0 ? 2 : distance === 1 ? 1 : 0;
}
function inWindow(question: SelectableQuestion, target?: InterviewBar): boolean {
  if (!target) return true;
  const index = INTERVIEW_BARS.indexOf(interviewBar(question));
  const targetIndex = INTERVIEW_BARS.indexOf(target);
  return target === "global-scale"
    ? index >= targetIndex - 1
    : index >= targetIndex && index <= targetIndex + 1;
}
function selectWithStretch<Q extends SelectableQuestion>(
  pool: Array<{ q: Q; priority: number }>,
  count: number,
  target?: InterviewBar,
): Array<{ q: Q; priority: number }> {
  const selected = pool.slice(0, count);
  if (!target || count === 0 || target === "global-scale") return selected;
  const stretchBar = INTERVIEW_BARS[INTERVIEW_BARS.indexOf(target) + 1];
  if (!stretchBar || selected.some((item) => interviewBar(item.q) === stretchBar)) return selected;
  const stretch = pool.find((item) => interviewBar(item.q) === stretchBar);
  return stretch ? [...selected.slice(0, -1), stretch] : selected;
}
function sequenceOrder(question: SelectableQuestion): number {
  if (question.sequenceHint === "opening") return 0;
  if (question.sequenceHint === "early") return 1;
  if (question.sequenceHint === "middle") return 2;
  if (question.sequenceHint === "late") return 3;
  if (question.sequenceHint === "closing") return 4;
  if (question.difficulty === "basic") return 1;
  if (
    question.tags?.some((tag) => ["incident", "customer-impact"].includes(tag)) ||
    question.topic.includes("failure") ||
    question.topic.includes("retry")
  )
    return 3;
  return question.topic.includes("result") ? 4 : 2;
}
function difficultyOrder(difficulty: SelectableQuestion["difficulty"]): number {
  return difficulty === "basic" ? 0 : difficulty === "intermediate" ? 1 : 2;
}

export function toDrillProgress(
  items: Array<{
    topic: string;
    passCount: number;
    failCount: number;
    nextReviewDate: string | null;
    lastPassedDate: string | null;
  }>,
): DrillProgress {
  return Object.fromEntries(
    items.map((item) => [
      item.topic,
      {
        pass_count: item.passCount,
        fail_count: item.failCount,
        next_review_date: item.nextReviewDate,
        last_passed: item.lastPassedDate,
      },
    ]),
  );
}

export function dueForReview(progress: DrillProgress, topic: string, today: string): boolean {
  const next = progress[topic]?.next_review_date;
  return next != null && next <= today;
}

export function selectFromBank<Q extends SelectableQuestion>(
  bank: Q[],
  progress: DrillProgress,
  options: { today: string; maxCount?: number; target?: InterviewBar; mixApplication?: boolean },
): Q[] {
  const { today: currentDay, target } = options;
  const maxCount = options.maxCount ?? 5;
  const eligible = bank
    .map((q) => {
      const entry = progress[q.topic];
      const due = !entry?.next_review_date || entry.next_review_date <= currentDay;
      const recent = entry?.last_passed != null && entry.last_passed >= previousDate(currentDay);
      let priority = recent
        ? -1
        : due && (entry?.fail_count ?? 0) > 0
          ? 3
          : due && (entry?.pass_count ?? 0) === 0
            ? 2
            : due
              ? 1
              : 0;
      if (priority >= 0)
        priority += (q.sourceScope === "application" ? 10 : 0) + barPriorityBoost(q, target);
      return { q, priority };
    })
    .filter((item) => item.priority >= 0 && inWindow(item.q, target))
    .sort((a, b) => b.priority - a.priority);
  let selected = selectWithStretch(eligible, maxCount, target);
  if (options.mixApplication && maxCount > 1) {
    const applications = selectWithStretch(
      eligible.filter((item) => item.q.sourceScope === "application"),
      Math.max(1, Math.ceil(maxCount * 0.6)),
      target,
    );
    const shared = eligible
      .filter((item) => item.q.sourceScope !== "application")
      .slice(0, maxCount - applications.length);
    const ids = new Set([...applications, ...shared].map((item) => item.q.id));
    selected = [
      ...applications,
      ...shared,
      ...eligible
        .filter((item) => !ids.has(item.q.id))
        .slice(0, maxCount - applications.length - shared.length),
    ];
  }
  return selected
    .sort(
      (a, b) =>
        sequenceOrder(a.q) - sequenceOrder(b.q) ||
        difficultyOrder(a.q.difficulty) - difficultyOrder(b.q.difficulty) ||
        a.q.id.localeCompare(b.q.id),
    )
    .map((item) => item.q);
}
