import { ceilDaysUntil, parseDateOrNull } from "../../../lib/date-format.ts";
import { normalizeText } from "../../../lib/text.ts";
import type { Posting } from "../types.ts";

export function parseDueDate(raw: unknown): Date | null {
  return parseDateOrNull(normalizeText(raw));
}

export function daysUntil(date: Date, evaluatedAt = new Date()): number {
  return ceilDaysUntil(date, evaluatedAt);
}

export function closeWindow(
  rawDueTime: unknown,
  evaluatedAt = new Date(),
): Pick<Posting, "closesAt" | "daysUntilClose" | "closeUrgency"> {
  const dueTime = normalizeText(rawDueTime);
  if (!dueTime) {
    return {
      closesAt: "no_deadline",
      daysUntilClose: "no_deadline",
      closeUrgency: "no_deadline",
    };
  }

  const dueDate = parseDueDate(dueTime);
  if (!dueDate) {
    return { closesAt: dueTime, daysUntilClose: "unknown", closeUrgency: "unknown" };
  }

  const days = daysUntil(dueDate, evaluatedAt);
  return {
    closesAt: dueTime,
    daysUntilClose: String(days),
    closeUrgency: days <= 7 ? (days <= 3 ? "urgent" : "soon") : "normal",
  };
}
