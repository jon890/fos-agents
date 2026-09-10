export function formatSeoulDateTime(value: Date): string {
  return value.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatSeoulIsoDate(generatedAt: string): string {
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) throw new Error(`유효하지 않은 generatedAt: ${generatedAt}`);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatSeoulDisplayTime(value: string): { short: string; full: string } {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { short: "확인 필요", full: "확인 필요" };
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    short: `${part("month")}.${part("day")} ${part("hour")}:${part("minute")}`,
    full: `${part("year")}.${part("month")}.${part("day")} ${part("hour")}:${part("minute")} KST`,
  };
}

/** 외부 날짜 값을 파싱하고, 값이 없거나 잘못됐으면 null을 반환한다. */
export function parseDateOrNull(value: unknown): Date | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** 두 시각의 차이를 24시간 단위로 올림한다. 기준 시각을 주입해 테스트할 수 있다. */
export function ceilDaysUntil(date: Date, evaluatedAt = new Date()): number {
  return Math.ceil((date.getTime() - evaluatedAt.getTime()) / (24 * 60 * 60 * 1000));
}
