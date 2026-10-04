// Same result as the Backend's seoulDate (services/career-backend/src/interview/review-schedule.ts).
// Rewritten here so the bundle does not pull in Backend code.
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
