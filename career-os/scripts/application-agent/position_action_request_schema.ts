import { z } from 'zod';
import {
  ActionStageSchema,
  PriorityRankSchema,
} from './priority_schema';

export const PositionActionRecordTypeSchema = z.enum(['frontdoor_queue', 'ledger']);

export const PositionActionRequestActionSchema = z.enum([
  'hold',
  'exclude',
  'prepare_application',
]);

export const PositionActionRequestSnapshotSchema = z
  .object({
    recordType: PositionActionRecordTypeSchema,
    recordId: z.string().min(1),
    workbenchId: z.string().min(1).optional(),
    company: z.string().min(1).nullable().optional(),
    role: z.string().min(1).nullable().optional(),
    url: z.string().url().nullable().optional(),
    status: z.string().min(1).nullable().optional(),
    actionStage: ActionStageSchema.nullable().optional(),
    priorityRank: PriorityRankSchema.nullable().optional(),
    prioritySource: z.enum(['user-confirmed', 'recommendation', 'none']).optional(),
    ledgerId: z.string().min(1).nullable().optional(),
    readiness: z
      .object({
        completeCount: z.number().int().nonnegative(),
        totalCount: z.number().int().positive(),
      })
      .optional(),
    latestRecommendationSnapshotAt: z.string().min(1).nullable().optional(),
    latestUserConfirmationAt: z.string().min(1).nullable().optional(),
  })
  .passthrough();

export const PositionActionRequestSchema = z.object({
  requestId: z.string().min(1),
  recordType: PositionActionRecordTypeSchema,
  recordId: z.string().min(1),
  requestedAction: PositionActionRequestActionSchema,
  effectiveReason: z.string().min(1),
  changedBy: z.string().min(1),
  requestSnapshot: PositionActionRequestSnapshotSchema,
});

export const PositionActionResultSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(['done', 'stale', 'failed']),
  dryRun: z.boolean().default(false),
  message: z.string().min(1),
  recordType: PositionActionRecordTypeSchema.optional(),
  recordId: z.string().min(1).optional(),
  ledgerId: z.string().min(1).nullable().optional(),
  appliedEventId: z.string().min(1).optional(),
  requestedAction: PositionActionRequestActionSchema.optional(),
  effectiveActionStage: ActionStageSchema.nullable().optional(),
  resultSnapshot: z
    .object({
      requestedAction: PositionActionRequestActionSchema,
      effectiveActionStage: ActionStageSchema.nullable(),
      ledgerId: z.string().min(1).nullable(),
      applicationRequestId: z.number().int().positive().nullable().optional(),
      readiness: z
        .object({
          completeCount: z.number().int().nonnegative(),
          totalCount: z.number().int().positive(),
        })
        .optional(),
      materialPaths: z.record(z.string(), z.string().nullable()).nullable().optional(),
    })
    .optional(),
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

export type PositionActionRecordType = z.infer<typeof PositionActionRecordTypeSchema>;
export type PositionActionRequestAction = z.infer<typeof PositionActionRequestActionSchema>;
export type PositionActionRequestSnapshot = z.infer<typeof PositionActionRequestSnapshotSchema>;
export type PositionActionRequest = z.infer<typeof PositionActionRequestSchema>;
export type PositionActionResult = z.infer<typeof PositionActionResultSchema>;
