// job-fit-analyzer 산출물 정본 스키마 (ADR-096).
// 에이전트가 이 스키마에 맞는 job-fit-YYYY-MM-DD-<slug>.json을 생성하면,
// render_job_fit.ts가 여기서 Markdown을 파생한다.
// SKILL self-check는 이 스키마 검증으로 대체한다.
import { z } from "zod";

export const TargetRole = z.object({
  source: z.enum(["argument", "mvp-target"]),
  company: z.string().optional(),
  team: z.string().optional(),
  role: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/, "슬러그는 소문자, 숫자, 하이픈만 허용한다"),
});

export const Verdict = z.object({
  recommendation: z.enum(["지원 권장", "조건부 지원", "보류"]),
  confidence: z.enum(["강", "중", "약"]),
  rationale: z.array(z.string().min(1)).min(1),
});

export const CareerPath = z.object({
  expectedTrajectory: z.array(z.string().min(1)).min(1),
  alignmentWithCurrent: z.enum(["정합", "확장", "이탈"]),
  leverageOrRisk: z.array(z.string().min(1)).min(1),
});

export const Strength = z.object({
  point: z.string().min(1),
  evidence: z.string().min(1),
  roleLeverage: z.string().min(1),
});

export const Gap = z.object({
  area: z.string().min(1),
  priority: z.enum(["고", "중", "저"]),
  evidenceSupport: z.string().min(1),
  interviewRisk: z.string().min(1),
});

export const StrengthPitch = z.object({
  strength: z.string().min(1),
  howToFrame: z.string().min(1),
});

export const WeaknessDefense = z.object({
  weakness: z.string().min(1),
  howToDefend: z.string().min(1),
});

export const InterviewStrategy = z.object({
  strengthPitch: z.array(StrengthPitch),
  weaknessDefense: z.array(WeaknessDefense),
});

export const Reinforcement = z.object({
  d30: z.array(z.string()),
  d60: z.array(z.string()),
  d90: z.array(z.string()),
});

export const InterviewQuestion = z.object({
  q: z.string().min(1),
  risk: z.string().min(1),
  answerAngle: z.string().min(1),
});

export const NextAction = z.object({
  skill: z.string().min(1),
  input: z.string().min(1),
  why: z.string().min(1),
});

export const ChangeSince = z.object({
  lastDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resolved: z.array(z.string()),
  newGaps: z.array(z.string()),
  persisting: z.array(z.string()),
});

export const JobFitRun = z.object({
  schemaVersion: z.literal(1),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "reportDate는 YYYY-MM-DD 형식이어야 한다"),
  generatedAt: z.string().min(1),
  targetRole: TargetRole,
  verdict: Verdict,
  careerPath: CareerPath,
  strengths: z.array(Strength).min(1),
  gaps: z.array(Gap).min(1),
  interviewStrategy: InterviewStrategy,
  reinforcement: Reinforcement,
  interviewQuestions: z.array(InterviewQuestion),
  nextActions: z.array(NextAction).min(1),
  changeSince: ChangeSince.optional(),
});

export type JobFitRunType = z.infer<typeof JobFitRun>;
export type TargetRoleType = z.infer<typeof TargetRole>;
export type VerdictType = z.infer<typeof Verdict>;
export type CareerPathType = z.infer<typeof CareerPath>;
export type StrengthType = z.infer<typeof Strength>;
export type GapType = z.infer<typeof Gap>;
export type InterviewStrategyType = z.infer<typeof InterviewStrategy>;
export type NextActionType = z.infer<typeof NextAction>;
export type ChangeSinceType = z.infer<typeof ChangeSince>;
