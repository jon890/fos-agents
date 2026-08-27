import type { ScoreResult } from "./drill-engine.ts";

export const INTERVIEW_BARS = ["production", "large-scale", "global-scale"] as const;
export const FOLLOW_UP_AXES = [
  "clarification",
  "decision",
  "counterexample",
  "operations",
  "evidence-boundary",
] as const;

export type InterviewBar = typeof INTERVIEW_BARS[number];
export type FollowUpAxis = typeof FOLLOW_UP_AXES[number];

export const MAX_FOLLOW_UP_DEPTH = 4;

export function inferredInterviewBar(
  difficulty: "basic" | "intermediate" | "advanced",
): InterviewBar {
  if (difficulty === "basic") return "production";
  if (difficulty === "intermediate") return "large-scale";
  return "global-scale";
}

export function nextFollowUpAxis(
  score: ScoreResult,
  completedDepth: number,
): FollowUpAxis | null {
  if (completedDepth >= MAX_FOLLOW_UP_DEPTH) return null;
  if (score === "fail" || score === "unknown") {
    return completedDepth === 0 ? "clarification" : null;
  }
  if (score === "shallow") {
    if (completedDepth === 0) return "clarification";
    if (completedDepth === 1) return "decision";
    return null;
  }
  return ["decision", "counterexample", "operations", "evidence-boundary"][completedDepth] as FollowUpAxis;
}

