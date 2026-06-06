import { describe, expect, test } from "bun:test";
import { hasUsageRemaining, mergeKnownUsage, safeUsageSnapshot } from "./session_status_hud.ts";

describe("safeUsageSnapshot", () => {
  test("parses current session_status text labels", () => {
    const snapshot = safeUsageSnapshot({
      limits: "Usage limits\n5h 91% left\nWeek 87% left",
      context: { percent: 42 },
    });

    expect(snapshot).toEqual({
      fiveHourRemaining: "91% left",
      weeklyRemaining: "87% left",
      contextPercent: 42,
    });
  });

  test("parses nested JSON usage fields without unsafe details", () => {
    const snapshot = safeUsageSnapshot({
      account: { email: "person@example.com" },
      usage: {
        five_hour_remaining: "5h 64% left",
        weekly_remaining: "Week 70% left",
        cost: "$12.34",
      },
      contextWindow: { used_percent: 55 },
    });

    expect(snapshot).toEqual({
      fiveHourRemaining: "64% left",
      weeklyRemaining: "70% left",
      contextPercent: 55,
    });
  });

  test("reports whether usage remaining was parsed", () => {
    expect(hasUsageRemaining(safeUsageSnapshot({ text: "no usage here" }))).toBe(false);
    expect(hasUsageRemaining(safeUsageSnapshot({ text: "5h 91% left" }))).toBe(true);
  });
});

describe("mergeKnownUsage", () => {
  test("keeps previous usage remaining when next parse lacks usage values", () => {
    const merged = mergeKnownUsage(
      { fiveHourRemaining: "91% left", weeklyRemaining: "87% left", contextPercent: 40 },
      { contextPercent: 43 },
    );

    expect(merged).toEqual({
      fiveHourRemaining: "91% left",
      weeklyRemaining: "87% left",
      contextPercent: 43,
    });
  });
});
