export interface SafeUsageSnapshot {
  fiveHourRemaining?: string;
  fiveHourResetIn?: string;
  weeklyRemaining?: string;
  weeklyResetIn?: string;
  contextPercent?: number;
  compactionCount?: number;
}

const MAX_COLLECTED_STRINGS = 120;

export function safeUsageSnapshot(raw: Record<string, unknown>): SafeUsageSnapshot {
  return compact({
    fiveHourRemaining: readDirectRemaining(raw, [
      "fiveHourRemaining",
      "five_hour_remaining",
      "fiveHour",
      "five_hour",
      "fiveHours",
      "five_hours",
    ]) ?? parseFiveHourRemaining(raw),
    fiveHourResetIn: readDirectResetIn(raw, [
      "fiveHourResetIn",
      "five_hour_reset_in",
      "fiveHourResetsIn",
      "five_hour_resets_in",
    ]) ?? parseFiveHourResetIn(raw),
    weeklyRemaining: readDirectRemaining(raw, [
      "weeklyRemaining",
      "weekly_remaining",
      "weekRemaining",
      "week_remaining",
      "weekly",
      "week",
    ]) ?? parseWeeklyRemaining(raw),
    weeklyResetIn: readDirectResetIn(raw, [
      "weeklyResetIn",
      "weekly_reset_in",
      "weekResetIn",
      "week_reset_in",
      "weeklyResetsIn",
      "weekly_resets_in",
    ]) ?? parseWeeklyResetIn(raw),
    contextPercent:
      readDirectNumber(raw, ["contextPercent", "context_percent", "usedPercent", "used_percent"]) ??
      readDirectNumber(readObject(raw.context) ?? readObject(raw.contextWindow), ["percent", "usedPercent", "used_percent"]),
    compactionCount:
      readDirectNumber(raw, ["compactionCount", "compaction_count"]) ??
      readDirectNumber(readObject(raw.compaction), ["count"]),
  });
}

export function hasUsageRemaining(snapshot: SafeUsageSnapshot | undefined): boolean {
  return Boolean(snapshot?.fiveHourRemaining || snapshot?.weeklyRemaining);
}

export function mergeKnownUsage(
  previous: SafeUsageSnapshot | undefined,
  next: SafeUsageSnapshot | undefined,
): SafeUsageSnapshot | undefined {
  if (!previous) return next;
  if (!next) return previous;
  return compact({
    fiveHourRemaining: next.fiveHourRemaining ?? previous.fiveHourRemaining,
    fiveHourResetIn: next.fiveHourResetIn ?? previous.fiveHourResetIn,
    weeklyRemaining: next.weeklyRemaining ?? previous.weeklyRemaining,
    weeklyResetIn: next.weeklyResetIn ?? previous.weeklyResetIn,
    contextPercent: next.contextPercent ?? previous.contextPercent,
    compactionCount: next.compactionCount ?? previous.compactionCount,
  });
}

function parseFiveHourRemaining(raw: Record<string, unknown>): string | undefined {
  for (const text of collectSearchTexts(raw)) {
    const parsed = parseRemainingText(text, /\b5\s*h(?:our)?s?\b/i);
    if (parsed) return parsed;
  }
  return undefined;
}

function parseWeeklyRemaining(raw: Record<string, unknown>): string | undefined {
  for (const text of collectSearchTexts(raw)) {
    const parsed = parseRemainingText(text, /\bweek(?:ly)?\b/i);
    if (parsed) return parsed;
  }
  return undefined;
}

function parseFiveHourResetIn(raw: Record<string, unknown>): string | undefined {
  for (const text of collectSearchTexts(raw)) {
    const parsed = parseResetInText(text, /\b5\s*h(?:our)?s?\b/i);
    if (parsed) return parsed;
  }
  return undefined;
}

function parseWeeklyResetIn(raw: Record<string, unknown>): string | undefined {
  for (const text of collectSearchTexts(raw)) {
    const parsed = parseResetInText(text, /\bweek(?:ly)?\b/i);
    if (parsed) return parsed;
  }
  return undefined;
}

function parseRemainingText(text: string, labelPattern: RegExp): string | undefined {
  const labelFirst = new RegExp(`${labelPattern.source}[^\\n\\r%]{0,80}?(\\d+(?:\\.\\d+)?)\\s*%\\s*(left|remaining)?`, "i");
  const first = text.match(labelFirst);
  if (first) return formatRemaining(first[1], first[2]);

  const percentFirst = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%\\s*(left|remaining)?[^\\n\\r]{0,80}?${labelPattern.source}`, "i");
  const second = text.match(percentFirst);
  if (second) return formatRemaining(second[1], second[2]);

  return undefined;
}

function formatRemaining(percent: string, suffix: string | undefined): string {
  return suffix ? `${percent}% ${suffix.toLowerCase()}` : `${percent}%`;
}

function parseResetInText(text: string, labelPattern: RegExp): string | undefined {
  const labelFirst = new RegExp(`${labelPattern.source}[^\\n\\r·]{0,120}?%[^\\n\\r·]{0,80}?(?:⏱|reset(?:s)?\\s+in)\\s*([^\\n\\r·]+)`, "i");
  const first = text.match(labelFirst);
  if (first) return normalizeResetIn(first[1]);

  const markerFirst = new RegExp(`(?:⏱|reset(?:s)?\\s+in)\\s*([^\\n\\r·]{1,40})[^\\n\\r·]{0,80}?${labelPattern.source}`, "i");
  const second = text.match(markerFirst);
  if (second) return normalizeResetIn(second[1]);

  return undefined;
}

function readDirectRemaining(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const value of findValuesByKeys(raw, keys)) {
    const direct = readString(value);
    if (!direct) continue;
    const normalized = direct.match(/(\d+(?:\.\d+)?)\s*%\s*(left|remaining)?/i);
    if (normalized) return formatRemaining(normalized[1], normalized[2]);
  }
  return undefined;
}

function readDirectResetIn(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const value of findValuesByKeys(raw, keys)) {
    const direct = readString(value);
    if (!direct) continue;
    return normalizeResetIn(direct);
  }
  return undefined;
}

function normalizeResetIn(value: string): string | undefined {
  const normalized = value
    .replace(/[^\dwdhms일시간분초\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || undefined;
}

function readDirectNumber(raw: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  if (!raw) return undefined;
  for (const value of findValuesByKeys(raw, keys)) {
    const direct = readNumber(value);
    if (direct !== undefined) return direct;
  }
  return undefined;
}

function findValuesByKeys(raw: unknown, keys: string[]): unknown[] {
  const wanted = new Set(keys.map(normalizeKey));
  const values: unknown[] = [];
  const stack: unknown[] = [raw];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (wanted.has(normalizeKey(key))) {
        values.push(value);
      }
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return values;
}

function collectSearchTexts(raw: unknown): string[] {
  const texts: string[] = [];
  const stack: Array<{ key?: string; value: unknown }> = [{ value: raw }];

  while (stack.length > 0 && texts.length < MAX_COLLECTED_STRINGS) {
    const { key, value } = stack.pop() ?? {};
    if (typeof value === "string" && value.trim()) {
      texts.push(key ? `${key} ${value}` : value);
      continue;
    }
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const item of value) stack.push({ value: item });
      continue;
    }
    for (const [itemKey, itemValue] of Object.entries(value as Record<string, unknown>)) {
      stack.push({ key: itemKey, value: itemValue });
    }
  }

  return texts;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
