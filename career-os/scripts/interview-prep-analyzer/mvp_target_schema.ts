import { z } from 'zod';
import { readFileSync } from 'fs';

export const InterviewSiteSchema = z.object({
  key: z.string(),
  url: z.string().url(),
  label: z.string(),
});

export const InterviewModeSchema = z.object({
  sites: z.array(InterviewSiteSchema),
  source_dir: z.string(),
  report_slug: z.string(),
  prep_dir: z.string(),
  strategy_filename: z.string().default('strategy.md'),
  checklist_filename: z.string().default('checklist.md'),
});

export const InterviewSchema = z.object({
  coffeechat: InterviewModeSchema.nullable().optional(),
  first_round: InterviewModeSchema.nullable(),
  final_round: InterviewModeSchema.nullable(),
  offer_chat: InterviewModeSchema.nullable(),
});

export const MvpTargetPrimarySchema = z.object({
  company: z.string(),
  team: z.string(),
  role: z.string(),
  interview_date: z.string(),
  notes: z.string().optional(),
  interview: InterviewSchema.optional(),
});

export const MvpTargetHistoryItemSchema = z.object({
  company: z.string(),
  team: z.string(),
  role: z.string(),
  interview_date: z.string(),
  deprecated_at: z.string(),
  notes: z.string().optional(),
});

export const MvpTargetSchema = z.object({
  primary: MvpTargetPrimarySchema,
  history: z.array(MvpTargetHistoryItemSchema).default([]),
});

export type MvpTarget = z.infer<typeof MvpTargetSchema>;
export type InterviewSite = z.infer<typeof InterviewSiteSchema>;
export type InterviewMode = z.infer<typeof InterviewModeSchema>;
export type InterviewConfig = z.infer<typeof InterviewSchema>;
export type SupportedInterviewMode = 'first_round' | 'final_round' | 'offer_chat';

export function parseMvpTarget(path: string): MvpTarget {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  return MvpTargetSchema.parse(raw);
}
