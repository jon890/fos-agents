import { existsSync, readFileSync } from 'fs';
import { z } from 'zod';

export const ApplicationStatusSchema = z.enum([
  'discovered',
  'analyzing',
  'preparing_application',
  'needs_revision',
  'ready_for_user_review',
  'approved',
  'submitted',
  'interview_prep',
  'interview_scheduled',
  'closed',
  'blocked',
]);

export const UserDecisionSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'paused',
  'needs_changes',
]);

export const ApplicationLedgerRecordSchema = z.object({
  id: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url(),
  status: ApplicationStatusSchema,
  statusUpdatedAt: z.string().min(1),
  discoveredAt: z.string().min(1).optional(),
  applicationDir: z.string().min(1),
  postingPath: z.string().min(1).optional(),
  fitAnalysisPath: z.string().min(1).optional(),
  applicationPackagePath: z.string().min(1).optional(),
  reviewPath: z.string().min(1).optional(),
  needsUserReview: z.boolean().default(false),
  userDecision: UserDecisionSchema.default('pending'),
  revisionCount: z.number().int().min(0).default(0),
  maxRevisionCount: z.number().int().min(1).default(3),
  riskFlags: z.array(z.string().min(1)).default([]),
  nextActions: z.array(z.string().min(1)).default([]),
  notes: z.string().optional(),
});

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type UserDecision = z.infer<typeof UserDecisionSchema>;
export type ApplicationLedgerRecord = z.infer<typeof ApplicationLedgerRecordSchema>;

export const AllowedStatusTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  discovered: ['analyzing', 'blocked', 'closed'],
  analyzing: ['preparing_application', 'needs_revision', 'ready_for_user_review', 'blocked', 'closed'],
  preparing_application: ['needs_revision', 'ready_for_user_review', 'blocked', 'closed'],
  needs_revision: ['preparing_application', 'blocked', 'ready_for_user_review'],
  ready_for_user_review: ['approved', 'needs_revision', 'blocked', 'closed'],
  approved: ['submitted', 'interview_prep', 'blocked', 'closed'],
  submitted: ['interview_prep', 'interview_scheduled', 'closed'],
  interview_prep: ['interview_scheduled', 'closed', 'blocked'],
  interview_scheduled: ['interview_prep', 'closed'],
  closed: [],
  blocked: ['analyzing', 'preparing_application', 'ready_for_user_review', 'closed'],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return AllowedStatusTransitions[from].includes(to);
}

export function parseLedgerLine(line: string): ApplicationLedgerRecord {
  return ApplicationLedgerRecordSchema.parse(JSON.parse(line));
}

export function parseLedgerFile(path: string): ApplicationLedgerRecord[] {
  const text = readFileSync(path, 'utf-8');
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLedgerLine);
}

function main(): void {
  const path = process.argv[2] ?? 'data/applications/ledger.jsonl';
  if (!existsSync(path)) {
    console.error(`ledger not found: ${path}`);
    process.exit(2);
  }

  const records = parseLedgerFile(path);
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) {
      console.error(`duplicate ledger id: ${record.id}`);
      process.exit(1);
    }
    ids.add(record.id);
  }

  console.log(`ledger ok: ${records.length} records`);
}

if (import.meta.main) {
  main();
}
