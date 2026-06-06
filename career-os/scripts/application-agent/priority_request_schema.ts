import { z } from 'zod';
import {
  ActionStageSchema,
  PriorityRankSchema,
  UserConfirmedPrioritySchema,
} from './priority_schema';

export const PriorityRequestRecordTypeSchema = z.enum(['frontdoor_queue', 'ledger']);

export const PriorityRequestSnapshotSchema = z
  .object({
    recordType: PriorityRequestRecordTypeSchema,
    recordId: z.string().min(1),
    company: z.string().min(1).nullable().optional(),
    role: z.string().min(1).nullable().optional(),
    url: z.string().url().nullable().optional(),
    effectiveActionStage: ActionStageSchema.nullable().optional(),
    priorityRank: PriorityRankSchema.nullable().optional(),
    prioritySource: z.enum(['user-confirmed', 'recommendation', 'none']).optional(),
    latestRecommendationSnapshotAt: z.string().min(1).nullable().optional(),
    latestUserConfirmationAt: z.string().min(1).nullable().optional(),
    userConfirmedPriority: UserConfirmedPrioritySchema.nullable().optional(),
  })
  .passthrough();

export const PriorityActionRequestSchema = z.object({
  requestId: z.string().min(1),
  recordType: PriorityRequestRecordTypeSchema,
  recordId: z.string().min(1),
  requestedStage: ActionStageSchema,
  requestedRank: PriorityRankSchema,
  reason: z.string().min(1),
  changedBy: z.string().min(1),
  requestSnapshot: PriorityRequestSnapshotSchema,
});

export const PriorityRequestResultStatusSchema = z.enum([
  'applied',
  'stale',
  'rejected',
  'failed',
]);

export const PriorityRequestResultSchema = z.object({
  requestId: z.string().min(1),
  status: PriorityRequestResultStatusSchema,
  dryRun: z.boolean().default(false),
  message: z.string().min(1),
  appliedEventId: z.string().min(1).optional(),
  recordType: PriorityRequestRecordTypeSchema.optional(),
  recordId: z.string().min(1).optional(),
  plannedCommand: z.array(z.string().min(1)).optional(),
  staleMismatches: z
    .array(
      z.object({
        field: z.string().min(1),
        expected: z.unknown(),
        current: z.unknown(),
      }),
    )
    .optional(),
});

export type PriorityRequestRecordType = z.infer<typeof PriorityRequestRecordTypeSchema>;
export type PriorityRequestSnapshot = z.infer<typeof PriorityRequestSnapshotSchema>;
export type PriorityActionRequest = z.infer<typeof PriorityActionRequestSchema>;
export type PriorityRequestResult = z.infer<typeof PriorityRequestResultSchema>;
