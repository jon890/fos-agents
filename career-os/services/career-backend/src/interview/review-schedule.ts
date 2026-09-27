export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60] as const;

export type InterviewScore = "pass" | "shallow" | "fail" | "unknown";

export type TopicProgressState = {
  passCount: number;
  failCount: number;
  nextReviewDate: string | null;
  lastPassedDate: string | null;
};

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function nextTopicProgress(
  current: TopicProgressState,
  score: InterviewScore,
  evaluatedOn: string,
): TopicProgressState {
  if (score === "pass") {
    const passCount = current.passCount + 1;
    return {
      passCount,
      failCount: current.failCount,
      nextReviewDate: addDays(evaluatedOn, REVIEW_INTERVALS_DAYS[Math.min(passCount - 1, 5)]),
      lastPassedDate: evaluatedOn,
    };
  }
  return {
    passCount: current.passCount,
    failCount: current.failCount + 1,
    nextReviewDate: addDays(evaluatedOn, 1),
    lastPassedDate: current.lastPassedDate,
  };
}

export function seoulDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
