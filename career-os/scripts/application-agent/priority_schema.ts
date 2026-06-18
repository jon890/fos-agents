import { z } from 'zod';

export const ActionStageSchema = z.enum([
  'prepare-now',
  'investigate',
  'monitor',
  'low-priority',
  'hold',
  'excluded',
]);

export const PriorityRankSchema = z.number().int().positive();

export const EvidenceUrlSchema = z.string().url();

export const PostingAnalysisSummarySchema = z.object({
  activeEvidence: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  stack: z.array(z.string().min(1)).default([]),
  deadline: z.string().min(1).optional(),
  sourceUrl: EvidenceUrlSchema.optional(),
});

export const FitSummarySchema = z.object({
  summary: z.string().min(1),
  evidence: z.array(z.string().min(1)).default([]),
  fitScore: z.number().min(0).max(100).optional(),
});

export const GapSummarySchema = z.object({
  summary: z.string().min(1),
  gaps: z.array(z.string().min(1)).default([]),
  riskFlags: z.array(z.string().min(1)).default([]),
});

export const PreparationActionSchema = z.object({
  kind: z.enum([
    'posting-analysis',
    'fit-analysis',
    'gap-analysis',
    'package-draft',
    'application-review',
    'study-topic',
    'study-pack',
    'interview-practice',
    'monitor',
    'investigate',
  ]),
  label: z.string().min(1),
  command: z.string().min(1).optional(),
  requiresUserApproval: z.boolean().default(false),
});

export const RecommendationSnapshotSchema = z.object({
  generatedAt: z.string().min(1),
  sourceReportPath: z.string().min(1),
  actionStage: ActionStageSchema.optional(),
  priorityRank: PriorityRankSchema.optional(),
  postingAnalysis: PostingAnalysisSummarySchema.optional(),
  fitSummary: FitSummarySchema.optional(),
  gapSummary: GapSummarySchema.optional(),
  preparationActions: z.array(PreparationActionSchema).default([]),
});

export const UserConfirmedPrioritySchema = z.object({
  confirmedAt: z.string().min(1),
  actionStage: ActionStageSchema,
  priorityRank: PriorityRankSchema,
  reason: z.string().min(1),
  confirmedBy: z.string().min(1),
});

export const PriorityFieldsSchema = z
  .object({
    actionStage: ActionStageSchema.optional(),
    priorityRank: PriorityRankSchema.optional(),
    priorityReason: z.string().min(1).optional(),
    nextAction: z.string().min(1).optional(),
    riskFlags: z.array(z.string().min(1)).default([]),
    evidenceUrls: z.array(EvidenceUrlSchema).default([]),
    recommendationSnapshot: RecommendationSnapshotSchema.optional(),
    userConfirmedPriority: UserConfirmedPrioritySchema.optional(),
  })
  .superRefine((record, ctx) => {
    if (record.actionStage === 'prepare-now') {
      if (!record.nextAction) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'prepare-now requires nextAction',
          path: ['nextAction'],
        });
      }
      if (record.evidenceUrls.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'prepare-now requires at least one evidenceUrls entry',
          path: ['evidenceUrls'],
        });
      }
    }
  });

export type ActionStage = z.infer<typeof ActionStageSchema>;
export type RecommendationSnapshot = z.infer<typeof RecommendationSnapshotSchema>;
export type UserConfirmedPriority = z.infer<typeof UserConfirmedPrioritySchema>;
export type PriorityFields = z.infer<typeof PriorityFieldsSchema>;

export const ACTION_STAGE_DISPLAY_VALUE: Record<ActionStage, number> = {
  'prepare-now': 1,
  investigate: 2,
  monitor: 3,
  'low-priority': 4,
  hold: 4,
  excluded: 4,
};

export function priorityDisplayValue(stage: ActionStage): number {
  return ACTION_STAGE_DISPLAY_VALUE[stage];
}

export function parsePriorityFields(input: unknown): PriorityFields {
  return PriorityFieldsSchema.parse(input);
}
