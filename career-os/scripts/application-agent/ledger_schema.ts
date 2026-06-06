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

export const AutonomyLevelSchema = z.enum([
  'agent_only',
  'user_approval_required',
  'external_action_blocked',
]);

export const RequiredUserActionSchema = z.enum([
  'none',
  'review_application',
  'approve_submission',
  'provide_evidence',
  'decide_cooldown',
  'approve_public_publish',
  'approve_profile_update',
]);

export const PrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

export const SourceFreshnessSchema = z.enum(['fresh', 'stale', 'unknown']);

export const ApplicationLedgerRecordSchema = z.object({
  id: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url(),
  discoveryMode: z.string().min(1).optional(),
  activeEvidence: z.string().min(1).optional(),
  identityHash: z.string().min(1).optional(),
  careerUpsideHypothesis: z.string().min(1).optional(),
  careerUpsideEvidence: z.array(z.string().min(1)).optional(),
  careerUpsideRiskFlags: z.array(z.string().min(1)).optional(),
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
  // Runtime fields (optional — backward compatible with plan029 records)
  agentPhase: z.string().optional(),
  nextRunAt: z.string().optional(),
  lastDecisionAt: z.string().optional(),
  decisionReason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  autonomyLevel: AutonomyLevelSchema.optional(),
  requiredUserAction: RequiredUserActionSchema.optional(),
  actionableCandidate: z.boolean().optional(),
  fitScore: z.number().min(0).max(100).optional(),
  priority: PrioritySchema.optional(),
  sourceFreshness: SourceFreshnessSchema.optional(),
  lastAgentAction: z.string().optional(),
  decisionLogPath: z.string().optional(),
});

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type UserDecision = z.infer<typeof UserDecisionSchema>;
export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>;
export type RequiredUserAction = z.infer<typeof RequiredUserActionSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type SourceFreshness = z.infer<typeof SourceFreshnessSchema>;
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

// Agent-forbidden status transitions: agent must not set these autonomously
export const AgentForbiddenTargetStatuses: Set<ApplicationStatus> = new Set([
  'submitted',
  'approved',
]);

export type TransitionViolation = {
  rule: string;
  detail: string;
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return AllowedStatusTransitions[from].includes(to);
}

/**
 * Validates whether a proposed status transition is safe given the current record.
 * Returns an array of violations; empty array means the transition is allowed.
 */
export function validateTransition(
  record: ApplicationLedgerRecord,
  toStatus: ApplicationStatus,
): TransitionViolation[] {
  const violations: TransitionViolation[] = [];

  if (!canTransition(record.status, toStatus)) {
    violations.push({
      rule: 'invalid_transition',
      detail: `${record.status} -> ${toStatus} is not a defined transition`,
    });
  }

  // submitted must not be set by agent
  if (toStatus === 'submitted') {
    violations.push({
      rule: 'agent_cannot_submit',
      detail: 'submitted status must be set by the user after manual submission, not by agent',
    });
  }

  // approved requires explicit user decision
  if (toStatus === 'approved' && record.userDecision !== 'approved') {
    violations.push({
      rule: 'approved_requires_user_decision',
      detail: `approved status requires userDecision=approved, got: ${record.userDecision}`,
    });
  }

  // ready_for_user_review -> approved path: submission action always needs user gate
  if (record.status === 'ready_for_user_review' && toStatus === 'approved') {
    const ua = record.requiredUserAction;
    if (ua !== 'approve_submission' && ua !== 'review_application') {
      violations.push({
        rule: 'submission_requires_user_gate',
        detail:
          'transitioning from ready_for_user_review to approved requires requiredUserAction=approve_submission or review_application',
      });
    }
  }

  // closed is terminal — this is already enforced by AllowedStatusTransitions,
  // but guard explicitly for clarity
  if (record.status === 'closed') {
    violations.push({
      rule: 'closed_is_terminal',
      detail: 'cannot transition out of closed status',
    });
  }

  // blocked auto-resume requires nextRunAt or an explicit decisionReason
  if (record.status === 'blocked' && !record.nextRunAt && !record.decisionReason) {
    violations.push({
      rule: 'blocked_resume_needs_condition',
      detail: 'resuming from blocked requires nextRunAt or decisionReason to be set',
    });
  }

  // revisionCount >= maxRevisionCount blocks further revise
  if (toStatus === 'needs_revision' && record.revisionCount >= record.maxRevisionCount) {
    violations.push({
      rule: 'max_revision_exceeded',
      detail: `revisionCount (${record.revisionCount}) >= maxRevisionCount (${record.maxRevisionCount}); further revisions blocked`,
    });
  }

  return violations;
}

/**
 * Returns true when the record is a valid target for agent action this cycle.
 * sourceFreshness=stale, closed, or submitted records are excluded.
 */
export function isActionableCandidate(record: ApplicationLedgerRecord): boolean {
  if (record.sourceFreshness === 'stale') return false;
  if (record.status === 'closed') return false;
  if (record.status === 'submitted') return false;
  if (record.status === 'interview_scheduled') return false;
  return true;
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

function checkSafetyInvariants(record: ApplicationLedgerRecord): string[] {
  const warnings: string[] = [];

  if (record.sourceFreshness === 'stale' && record.actionableCandidate === true) {
    warnings.push(
      `[${record.id}] actionableCandidate=true but sourceFreshness=stale — inconsistent`,
    );
  }

  if (
    record.status === 'blocked' &&
    record.actionableCandidate === true &&
    !record.nextRunAt
  ) {
    warnings.push(
      `[${record.id}] actionableCandidate=true on blocked record without nextRunAt — inconsistent`,
    );
  }

  if (record.status === 'closed' && record.actionableCandidate === true) {
    warnings.push(`[${record.id}] actionableCandidate=true on closed record — inconsistent`);
  }

  if (
    record.status === 'approved' &&
    record.userDecision !== 'approved'
  ) {
    warnings.push(
      `[${record.id}] status=approved but userDecision=${record.userDecision} — inconsistent`,
    );
  }

  return warnings;
}

function main(): void {
  const path = process.argv[2] ?? 'data/applications/ledger.jsonl';
  if (!existsSync(path)) {
    console.error(`ledger not found: ${path}`);
    process.exit(2);
  }

  const records = parseLedgerFile(path);
  const ids = new Set<string>();
  const allWarnings: string[] = [];

  for (const record of records) {
    if (ids.has(record.id)) {
      console.error(`duplicate ledger id: ${record.id}`);
      process.exit(1);
    }
    ids.add(record.id);

    const warnings = checkSafetyInvariants(record);
    allWarnings.push(...warnings);
  }

  if (allWarnings.length > 0) {
    console.warn('safety invariant warnings:');
    for (const w of allWarnings) {
      console.warn(' ', w);
    }
    process.exit(1);
  }

  console.log(`ledger ok: ${records.length} records`);
}

if (import.meta.main) {
  main();
}
