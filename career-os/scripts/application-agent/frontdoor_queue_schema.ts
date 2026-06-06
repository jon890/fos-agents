import { existsSync, readFileSync } from 'fs';
import { z } from 'zod';
import { SourceFreshnessSchema } from './ledger_schema';

export const FrontdoorQueueStatusSchema = z.enum([
  'collected',
  'shortlisted',
  'needs_user_start_approval',
  'start_approved',
  'promoted_to_ledger',
  'rejected',
  'expired',
]);

export type FrontdoorQueueStatus = z.infer<typeof FrontdoorQueueStatusSchema>;
export type SourceFreshness = z.infer<typeof SourceFreshnessSchema>;

const STALE_BLOCKED_STATUSES: FrontdoorQueueStatus[] = [
  'needs_user_start_approval',
  'start_approved',
];

export const FrontdoorQueueRecordSchema = z
  .object({
    queueId: z.string().min(1),
    rank: z.number().int().positive(),
    company: z.string().min(1),
    role: z.string().min(1),
    trackLabel: z.string().min(1),
    source: z.string().min(1),
    url: z.string().url(),
    status: FrontdoorQueueStatusSchema,
    fitScore: z.number().min(0).max(100),
    recommendationTier: z.string().min(1),
    sourceFreshness: SourceFreshnessSchema,
    selectedAt: z.string().nullable(),
    promotedApplicationId: z.string().nullable(),
    decisionReason: z.string().min(1),
    nextActions: z.array(z.string().min(1)).default([]),
  })
  .superRefine((record, ctx) => {
    if (
      record.sourceFreshness === 'stale' &&
      STALE_BLOCKED_STATUSES.includes(record.status)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `sourceFreshness=stale is not allowed with status=${record.status}`,
        path: ['status'],
      });
    }

    if (record.status === 'start_approved' && record.selectedAt === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'start_approved requires selectedAt to be set',
        path: ['selectedAt'],
      });
    }

    if (record.status === 'promoted_to_ledger' && record.promotedApplicationId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'promoted_to_ledger requires promotedApplicationId to be set',
        path: ['promotedApplicationId'],
      });
    }
  });

export type FrontdoorQueueRecord = z.infer<typeof FrontdoorQueueRecordSchema>;

export function parseFrontdoorQueueLine(line: string): FrontdoorQueueRecord {
  return FrontdoorQueueRecordSchema.parse(JSON.parse(line));
}

export function parseFrontdoorQueueFile(path: string): FrontdoorQueueRecord[] {
  const text = readFileSync(path, 'utf-8');
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseFrontdoorQueueLine);
}

const WORKSPACE_PREFIX = process.cwd().endsWith('/career-os') ? '' : 'career-os/';
const DEFAULT_QUEUE_PATH = `${WORKSPACE_PREFIX}data/runtime/application-agent/frontdoor-queue.jsonl`;

function main(): void {
  const arg = process.argv[2];
  const path = !arg || arg === 'validate' ? DEFAULT_QUEUE_PATH : arg;

  if (!existsSync(path)) {
    console.log(`queue file not found (empty queue): ${path}`);
    process.exit(0);
  }

  let records: FrontdoorQueueRecord[];
  try {
    records = parseFrontdoorQueueFile(path);
  } catch (err) {
    console.error(`PHASE_FAILED: frontdoor queue schema validation failed`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const ids = new Set<string>();
  const errors: string[] = [];

  for (const record of records) {
    if (ids.has(record.queueId)) {
      errors.push(`duplicate queueId: ${record.queueId}`);
    }
    ids.add(record.queueId);
  }

  if (errors.length > 0) {
    console.error('validation errors:');
    for (const e of errors) {
      console.error(' ', e);
    }
    console.error('PHASE_FAILED: frontdoor queue schema validation failed');
    process.exit(1);
  }

  console.log(`frontdoor queue ok: ${records.length} records`);
}

if (import.meta.main) {
  main();
}
