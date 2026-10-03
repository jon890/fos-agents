import { todaySeoulIsoDate } from "../positions/seoul-date.js";

/** 사용량 기록의 달. `YYYY-MM` 이고 달은 01 부터 12 까지다. migration 의 `CHECK` 와 같은 형식이다. */
export const usageMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 요청을 받은 시각의 Asia/Seoul 달. `YYYY-MM`. */
export function currentSeoulMonth(now: Date): string {
  return todaySeoulIsoDate(now).slice(0, 7);
}

/**
 * `month` 가 `now` 의 Asia/Seoul 달보다 앞이면 참이다. 같은 달과 미래의 달은 거짓이다.
 *
 * 프로세스 시간대는 UTC 라 `now` 의 달을 그대로 쓰면 한국 시각 매달 1일 00:00 부터 09:00 사이에
 * 지난달이 아직 끝나지 않은 것으로 나온다. `YYYY-MM` 은 자릿수가 고정이라 문자열 비교로 앞뒤를 판정한다.
 */
export function isEndedSeoulMonth(month: string, now: Date): boolean {
  return month < currentSeoulMonth(now);
}
