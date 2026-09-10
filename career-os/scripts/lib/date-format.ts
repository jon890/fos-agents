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
