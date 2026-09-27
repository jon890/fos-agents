/**
 * Seoul 기준 날짜를 낸다.
 *
 * 프로세스 시간대는 `src/utc.ts` 가 UTC 로 고정한다.
 * 그 시간대로 날짜를 만들면 한국 시각 00:00 부터 09:00 사이에 전날이 나와,
 * 그날까지 유효한 제외 규칙이 하루 일찍 사라진다.
 *
 * `sv-SE` locale 은 `YYYY-MM-DD` 로 찍는다.
 * 수집기 쪽 `scripts/lib/date-format.ts` 의 `formatSeoulIsoDate` 와 같은 값을 내야 한다.
 */
const seoulDateFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todaySeoulIsoDate(now: Date): string {
  if (Number.isNaN(now.getTime())) {
    throw new Error("Seoul 기준 날짜를 만들 수 없는 시각입니다.");
  }
  return seoulDateFormat.format(now);
}
