import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { AgentDecision } from './agent_decision_schema';
import { updateLedgerRecord } from './ledger_io';
import type { ApplicationLedgerRecord } from './ledger_schema';
import {
  type SafetyViolation,
  partitionStudyActions,
  validateSafetyGate,
} from './safety_gate';
import { buildSkillCommand, requiresUserApproval } from './skill_contracts';
import type { ActionStage } from './priority_schema';

export type ActionOptions = {
  dryRun: boolean;
  ledgerPath: string;
  outputDir: string;
};

export type ActionResult = {
  applicationId: string;
  decision: AgentDecision;
  ledgerUpdated: boolean;
  decisionLogPath?: string;
  commandSuggestions: string[];
  executionBlocked?: boolean;
  executionBlockReason?: string;
  missingArtifacts?: string[];
  studyActionsPath?: string;
  submissionChecklistPath?: string;
  profileSuggestionsPath?: string;
  safetyBlocked?: boolean;
  safetyViolations?: SafetyViolation[];
};

export function buildPreparationActionSuggestions(
  actionStage: ActionStage,
  record: Pick<ApplicationLedgerRecord, 'applicationDir' | 'postingPath' | 'url'>,
): string[] {
  switch (actionStage) {
    case 'prepare-now':
      return [
        buildSkillCommand('application-package-writer', {
          postingPath: record.postingPath ?? `${record.applicationDir}/posting.md`,
        }),
        buildSkillCommand('application-reviewer', {
          applicationDir: record.applicationDir,
        }),
        buildSkillCommand('interview-prep-analyzer'),
      ];
    case 'investigate':
      return [
        `# Recheck active/open posting URL: ${record.url}`,
        buildSkillCommand('study-topic-recommender'),
        `# [requires user approval] ${buildSkillCommand('study-pack-writer', { topic: '<public-safe-topic>' })}`,
      ];
    case 'monitor':
      return [
        buildSkillCommand('position-recommender'),
        '# Keep in daily refresh until source freshness or fit changes',
      ];
    case 'low-priority':
      return ['# Keep visible below current action list; skip package draft automation'];
    case 'hold':
      return ['# Wait for user decision or an explicit condition change'];
    case 'excluded':
      return ['# Remove from recommendation and preparation candidates'];
  }
}

export async function executeDecision(
  record: ApplicationLedgerRecord,
  decision: AgentDecision,
  opts: ActionOptions,
): Promise<ActionResult> {
  const result: ActionResult = {
    applicationId: record.id,
    decision,
    ledgerUpdated: false,
    commandSuggestions: buildCommandSuggestions(record, decision),
  };

  // Safety check: hard block before any writes.
  const safetyResult = validateSafetyGate(decision);
  if (!safetyResult.safe) {
    result.safetyBlocked = true;
    result.safetyViolations = safetyResult.violations;
    // Still write the decision log so violations are auditable.
    if (!opts.dryRun) {
      result.decisionLogPath = appendDecisionLog(record, decision);
    }
    return result;
  }

  // Write decision log (append to per-application jsonl log)
  if (!opts.dryRun) {
    result.decisionLogPath = appendDecisionLog(record, decision);
  }

  if (!decision.allowed) return result;

  const artifactGate = validateArtifactGate(record, decision);
  if (!artifactGate.allowed) {
    result.executionBlocked = true;
    result.executionBlockReason = artifactGate.reason;
    result.missingArtifacts = artifactGate.missingArtifacts;
    return result;
  }

  if (opts.dryRun) return result;

  // Update ledger with new state
  updateLedgerRecord(opts.ledgerPath, record.id, {
    status: decision.nextStatus,
    agentPhase: decision.nextAgentPhase ?? record.agentPhase,
    lastDecisionAt: decision.createdAt,
    decisionReason: decision.decisionReason,
    nextActions: decision.nextActions,
    requiredUserAction: decision.requiredUserAction,
    confidence: decision.confidence,
    ...artifactGate.pathUpdates,
  });
  result.ledgerUpdated = true;

  // Generate artifacts for specific decisions
  if (decision.decision === 'generate_submission_checklist') {
    result.submissionChecklistPath = writeSubmissionChecklist(record, decision);
  }

  if (
    decision.decision === 'generate_study_actions' ||
    decision.decision === 'scheduled_retry'
  ) {
    result.studyActionsPath = writePrivateStudyActions(record, decision);
  }

  if (decision.decision === 'generate_study_actions' && record.status === 'interview_prep') {
    result.profileSuggestionsPath = writeProfileSuggestions(record, decision, opts.outputDir);
  }

  return result;
}

function validateArtifactGate(
  record: ApplicationLedgerRecord,
  decision: AgentDecision,
): {
  allowed: boolean;
  reason?: string;
  missingArtifacts?: string[];
  pathUpdates?: Partial<ApplicationLedgerRecord>;
} {
  const expected = expectedArtifacts(record, decision);
  if (expected.length === 0) return { allowed: true, pathUpdates: {} };

  const missing = expected.filter((artifact) => !existsSync(artifact.path));
  if (missing.length > 0) {
    return {
      allowed: false,
      reason:
        'required skill artifacts are missing; run the suggested command(s), then resume this application',
      missingArtifacts: missing.map((artifact) => `${artifact.label}: ${artifact.path}`),
      pathUpdates: {},
    };
  }

  const stale = staleArtifacts(record, decision);
  if (stale.length > 0) {
    return {
      allowed: false,
      reason:
        'required skill artifacts are stale; rerun the suggested command(s), then resume this application',
      missingArtifacts: stale,
      pathUpdates: {},
    };
  }

  const pathUpdates: Partial<ApplicationLedgerRecord> = {};
  for (const artifact of expected) {
    pathUpdates[artifact.field] = artifact.path;
  }
  return { allowed: true, pathUpdates };
}

function staleArtifacts(
  record: ApplicationLedgerRecord,
  decision: AgentDecision,
): string[] {
  const applicationPackagePath =
    record.applicationPackagePath ?? join(record.applicationDir, 'application-package.md');
  const reviewPath = record.reviewPath ?? join(record.applicationDir, 'review.md');

  if (
    decision.decision === 'revise_application_package' &&
    existsSync(applicationPackagePath) &&
    existsSync(reviewPath) &&
    statSync(applicationPackagePath).mtimeMs <= statSync(reviewPath).mtimeMs
  ) {
    return [
      `application package is not newer than review: ${applicationPackagePath} (review: ${reviewPath})`,
    ];
  }

  if (
    decision.decision === 'call_application_package_writer' &&
    existsSync(applicationPackagePath) &&
    existsSync(reviewPath) &&
    statSync(reviewPath).mtimeMs < statSync(applicationPackagePath).mtimeMs
  ) {
    return [
      `application review is older than package: ${reviewPath} (package: ${applicationPackagePath})`,
    ];
  }

  return [];
}

export function expectedArtifacts(
  record: ApplicationLedgerRecord,
  decision: AgentDecision,
): Array<{
  field: 'fitAnalysisPath' | 'applicationPackagePath' | 'reviewPath';
  label: string;
  path: string;
}> {
  const fitAnalysisPath = record.fitAnalysisPath ?? join(record.applicationDir, 'fit-analysis.md');
  const applicationPackagePath =
    record.applicationPackagePath ?? join(record.applicationDir, 'application-package.md');
  const reviewPath = record.reviewPath ?? join(record.applicationDir, 'review.md');

  switch (decision.decision) {
    case 'run_fit_analysis':
      return [
        {
          field: 'fitAnalysisPath',
          label: 'fit analysis',
          path: fitAnalysisPath,
        },
      ];

    case 'draft_application_package':
    case 'revise_application_package':
      return [
        {
          field: 'applicationPackagePath',
          label: 'application package',
          path: applicationPackagePath,
        },
      ];

    case 'call_application_package_writer':
      return [
        {
          field: 'applicationPackagePath',
          label: 'application package',
          path: applicationPackagePath,
        },
        {
          field: 'reviewPath',
          label: 'application review',
          path: reviewPath,
        },
      ];

    default:
      return [];
  }
}

function buildCommandSuggestions(
  record: ApplicationLedgerRecord,
  decision: AgentDecision,
): string[] {
  switch (decision.decision) {
    case 'draft_application_package':
    case 'call_application_package_writer':
    case 'revise_application_package':
      return [
        buildSkillCommand('application-package-writer', {
          postingPath: record.postingPath ?? join(record.applicationDir, 'posting.md'),
        }),
        buildSkillCommand('application-reviewer', { applicationDir: record.applicationDir }),
      ];

    case 'run_fit_analysis':
      return [
        buildSkillCommand('application-package-writer', {
          postingPath: record.postingPath ?? join(record.applicationDir, 'posting.md'),
        }),
        buildSkillCommand('study-topic-recommender'),
        buildSkillCommand('interview-prep-analyzer'),
      ];

    case 'generate_study_actions':
    case 'scheduled_retry': {
      const studyCmds = [
        buildSkillCommand('interview-prep-analyzer'),
        buildSkillCommand('study-topic-recommender'),
      ];
      if (requiresUserApproval('study-pack-writer')) {
        studyCmds.push(
          `# [requires user approval] ${buildSkillCommand('study-pack-writer', { topic: '<topic>' })}`,
        );
      }
      return studyCmds;
    }

    case 'await_user_approval':
    case 'max_revision_exceeded_escalate':
      return [
        `# Review required: ${record.applicationPackagePath ?? record.applicationDir}`,
        `# To approve: update ledger record id=${record.id} userDecision=approved`,
        `# [requires user approval] ${buildSkillCommand('candidate-baseline-suggester')}`,
      ];

    case 'generate_submission_checklist':
      return [
        `# Submission checklist ready — submit manually at: ${record.url}`,
        `# After submission: update ledger record id=${record.id} status=submitted`,
      ];

    case 'generate_study_action_queue':
      return [
        buildSkillCommand('interview-prep-analyzer'),
        `# [requires user approval] ${buildSkillCommand('interview-asset-writer', { topic: '<topic>' })}`,
      ];

    default:
      return [];
  }
}

function appendDecisionLog(
  record: ApplicationLedgerRecord,
  decision: AgentDecision,
): string {
  const dir = join(record.applicationDir, 'decisions');
  ensureDir(dir);
  const logPath = join(dir, 'decisions.jsonl');
  appendFileSync(logPath, JSON.stringify(decision) + '\n', 'utf-8');
  return logPath;
}

function writeSubmissionChecklist(
  record: ApplicationLedgerRecord,
  decision: AgentDecision,
): string {
  ensureDir(record.applicationDir);
  const path = join(record.applicationDir, 'submission-checklist.md');
  const flags =
    record.riskFlags.length > 0
      ? record.riskFlags.map((f) => `- ${f}`).join('\n')
      : '- (none)';
  const content = [
    `# Submission Checklist — ${record.company} / ${record.role}`,
    `Generated: ${decision.createdAt}`,
    `Status: READY FOR SUBMISSION (awaiting manual submission)`,
    '',
    '## Checklist',
    '',
    `- [ ] Review application package: ${record.applicationPackagePath ?? '(not set)'}`,
    `- [ ] Review fit analysis: ${record.fitAnalysisPath ?? '(not set)'}`,
    `- [ ] Review final review: ${record.reviewPath ?? '(not set)'}`,
    `- [ ] Submit at: ${record.url}`,
    `- [ ] After submission: update ledger record \`${record.id}\` status → \`submitted\``,
    '',
    '## Risk Flags',
    flags,
    '',
    '## Safety Check',
    '- Actual submission is NOT automated — this checklist is the final agent artifact',
    '- Browser input, site login, and account access require manual user action',
  ].join('\n');
  writeFileSync(path, content, 'utf-8');
  return path;
}

function writePrivateStudyActions(
  record: ApplicationLedgerRecord,
  decision: AgentDecision,
): string {
  ensureDir(record.applicationDir);
  const path = join(record.applicationDir, 'private-study-actions.md');

  const { publicSafe, privateActions } = partitionStudyActions(decision.nextActions);

  const publicSection =
    publicSafe.length > 0
      ? publicSafe.map((a) => `- ${a}`).join('\n')
      : '- (none identified — check study-topic-recommender for suggestions)';

  const privateSection =
    privateActions.length > 0
      ? privateActions.map((a) => `- ${a}`).join('\n')
      : '- (none)';

  const content = [
    `# Private Study Actions — ${record.company} / ${record.role}`,
    `Generated: ${decision.createdAt}`,
    `Application ID: ${record.id}`,
    `Fit Score: ${record.fitScore ?? 'N/A'}`,
    '',
    '> This file is private. Do not share in public channels or fos-study.',
    '',
    '## Public-Safe Study Candidates',
    '> Pure technical topics — safe to use with study-pack-writer (requires user approval)',
    '',
    publicSection,
    '',
    '## Private Actions',
    '> Application-specific context — keep in private reports only',
    '',
    privateSection,
    '',
    '## Context',
    `- Decision: ${decision.decision}`,
    `- Reason: ${decision.decisionReason}`,
    `- Risk Flags: ${record.riskFlags.length > 0 ? record.riskFlags.join(', ') : '(none)'}`,
    '',
    '## Suggested Commands',
    `\`\`\``,
    `cd career-os && claude -p "/interview-prep-analyzer daily"`,
    `cd career-os && claude -p "/study-topic-recommender"`,
    `# [requires user approval] cd career-os && claude -p "/study-pack-writer <public-safe-topic>"`,
    `\`\`\``,
  ].join('\n');

  writeFileSync(path, content, 'utf-8');
  return path;
}

function writeProfileSuggestions(
  record: ApplicationLedgerRecord,
  decision: AgentDecision,
  outputDir: string,
): string {
  ensureDir(outputDir);
  const date = decision.createdAt.slice(0, 10);
  const path = join(outputDir, `profile-suggestions-${date}.md`);

  const content = [
    `# Profile Suggestions — ${date}`,
    `Generated: ${decision.createdAt}`,
    '',
    '> This is a stub generated by the TS runner.',
    '> Run candidate-baseline-suggester for full AI-assisted analysis.',
    '',
    '## Trigger Context',
    `- Application: ${record.company} / ${record.role} (${record.id})`,
    `- Fit Score: ${record.fitScore ?? 'N/A'}`,
    `- Decision: ${decision.decision}`,
    `- Reason: ${decision.decisionReason}`,
    '',
    '## Risk Flags Observed',
    record.riskFlags.length > 0
      ? record.riskFlags.map((f) => `- ${f}`).join('\n')
      : '- (none)',
    '',
    '## Next Step',
    '> Run the following command to generate full profile suggestions:',
    '',
    '```',
    `cd career-os && claude --permission-mode acceptEdits -p "/candidate-baseline-suggester"`,
    '```',
    '',
    '## Safety Note',
    '- Agent generates this suggestion file only',
    '- config/candidate-profile.md is NOT modified by the agent',
    '- Profile changes require user review and explicit approval',
  ].join('\n');

  writeFileSync(path, content, 'utf-8');
  return path;
}

function ensureDir(dir: string): void {
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
}
