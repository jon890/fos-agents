import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { AgentDecision } from './agent_decision_schema';
import { updatePositionsQueueRecord } from './positions_queue_io';
import type { ApplicationPositionsQueueRecord } from './positions_queue_schema';
import {
  type SafetyViolation,
  partitionStudyActions,
  validateSafetyGate,
} from './safety_gate';
import { buildSkillCommand } from './skill_contracts';
import type { ActionStage } from './priority_schema';

type ArtifactField =
  | 'postingPath'
  | 'candidateInterviewPath'
  | 'fitAnalysisPath'
  | 'applicationPackagePath'
  | 'applicationPackageHtmlPath'
  | 'resumeDraftPath'
  | 'coverLetterPath'
  | 'submissionChecklistPath'
  | 'reviewPath';

type ExpectedArtifact = {
  field: ArtifactField;
  label: string;
  path: string;
  freshnessRole?: 'source' | 'generated' | 'review';
};

export type ActionOptions = {
  dryRun: boolean;
  positionsQueuePath: string;
  outputDir: string;
};

export type ActionResult = {
  applicationId: string;
  decision: AgentDecision;
  positionsQueueUpdated: boolean;
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
  record: Pick<ApplicationPositionsQueueRecord, 'applicationDir' | 'postingPath' | 'url'>,
): string[] {
  switch (actionStage) {
    case 'prepare-now':
      return [
        buildSkillCommand('application-package-writer', {
          postingPath: record.postingPath ?? `${record.applicationDir}/posting.md`,
        }),
      ];
    case 'investigate':
      return [
        `# Recheck active/open posting URL: ${record.url}`,
        buildSkillCommand('study-topic-recommender'),
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
  record: ApplicationPositionsQueueRecord,
  decision: AgentDecision,
  opts: ActionOptions,
): Promise<ActionResult> {
  const result: ActionResult = {
    applicationId: record.id,
    decision,
    positionsQueueUpdated: false,
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
    if (!opts.dryRun) {
      result.decisionLogPath = appendArtifactGateLog(record, decision, artifactGate);
    }
    return result;
  }

  if (opts.dryRun) return result;

  // Update positions-queue with new state
  updatePositionsQueueRecord(opts.positionsQueuePath, record.id, {
    status: decision.nextStatus,
    agentPhase: decision.nextAgentPhase ?? record.agentPhase,
    lastDecisionAt: decision.createdAt,
    decisionReason: decision.decisionReason,
    nextActions: decision.nextActions,
    requiredUserAction: decision.requiredUserAction,
    confidence: decision.confidence,
    ...artifactGate.pathUpdates,
  });
  result.positionsQueueUpdated = true;

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
  record: ApplicationPositionsQueueRecord,
  decision: AgentDecision,
): {
  allowed: boolean;
  reason?: string;
  missingArtifacts?: string[];
  pathUpdates?: Partial<ApplicationPositionsQueueRecord>;
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

  const pathUpdates: Partial<ApplicationPositionsQueueRecord> = {};
  for (const artifact of expected) {
    pathUpdates[artifact.field] = artifact.path;
  }
  return { allowed: true, pathUpdates };
}

function staleArtifacts(
  record: ApplicationPositionsQueueRecord,
  decision: AgentDecision,
): string[] {
  const applicationPackagePath =
    record.applicationPackagePath ?? join(record.applicationDir, 'application-package.md');
  const candidateInterviewPath =
    record.candidateInterviewPath ?? join(record.applicationDir, 'candidate-interview.md');
  const resumeDraftPath = record.resumeDraftPath ?? join(record.applicationDir, 'resume-draft.md');
  const applicationPackageHtmlPath =
    record.applicationPackageHtmlPath ?? join(record.applicationDir, 'application-package.html');
  const reviewPath = record.reviewPath ?? join(record.applicationDir, 'review.md');
  const generatedPaths = [
    candidateInterviewPath,
    applicationPackagePath,
    resumeDraftPath,
    applicationPackageHtmlPath,
  ];

  if (
    decision.decision === 'revise_application_package' &&
    existsSync(applicationPackagePath) &&
    existsSync(reviewPath) &&
    generatedPaths.some(
      (path) => existsSync(path) && statSync(path).mtimeMs <= statSync(reviewPath).mtimeMs,
    )
  ) {
    return [
      `generated resume package is not newer than review; rerun writer outputs before review: ${reviewPath}`,
    ];
  }

  if (
    decision.decision === 'call_application_package_writer' &&
    generatedPaths.every((path) => existsSync(path)) &&
    existsSync(reviewPath) &&
    generatedPaths.some(
      (path) => statSync(reviewPath).mtimeMs < statSync(path).mtimeMs,
    )
  ) {
    return [
      `application review is older than generated resume package: ${reviewPath}`,
    ];
  }

  if (decision.decision === 'review_pass_ready_for_user') {
    const expected = expectedArtifacts(record, decision);
    const review = expected.find((artifact) => artifact.freshnessRole === 'review');
    if (!review || !existsSync(review.path)) return [];

    const reviewMtime = statSync(review.path).mtimeMs;
    return expected
      .filter(
        (artifact) =>
          artifact.freshnessRole === 'generated' &&
          existsSync(artifact.path) &&
          statSync(artifact.path).mtimeMs > reviewMtime,
      )
      .map(
        (artifact) =>
          `review is older than ${artifact.label}: ${review.path} (${artifact.label}: ${artifact.path})`,
      );
  }

  return [];
}

export function expectedArtifacts(
  record: ApplicationPositionsQueueRecord,
  decision: AgentDecision,
): ExpectedArtifact[] {
  const postingPath = record.postingPath ?? join(record.applicationDir, 'posting.md');
  const candidateInterviewPath =
    record.candidateInterviewPath ?? join(record.applicationDir, 'candidate-interview.md');
  const applicationPackagePath =
    record.applicationPackagePath ?? join(record.applicationDir, 'application-package.md');
  const applicationPackageHtmlPath =
    record.applicationPackageHtmlPath ?? join(record.applicationDir, 'application-package.html');
  const resumeDraftPath = record.resumeDraftPath ?? join(record.applicationDir, 'resume-draft.md');
  const reviewPath = record.reviewPath ?? join(record.applicationDir, 'review.md');

  switch (decision.decision) {
    case 'run_fit_analysis':
      return [
        {
          field: 'applicationPackagePath',
          label: 'application package',
          path: applicationPackagePath,
          freshnessRole: 'generated',
        },
      ];

    case 'draft_application_package':
    case 'revise_application_package':
      return [
        {
          field: 'candidateInterviewPath',
          label: 'candidate interview',
          path: candidateInterviewPath,
          freshnessRole: 'generated',
        },
        {
          field: 'applicationPackagePath',
          label: 'application package',
          path: applicationPackagePath,
          freshnessRole: 'generated',
        },
        {
          field: 'resumeDraftPath',
          label: 'resume draft',
          path: resumeDraftPath,
          freshnessRole: 'generated',
        },
        {
          field: 'applicationPackageHtmlPath',
          label: 'application package HTML',
          path: applicationPackageHtmlPath,
          freshnessRole: 'generated',
        },
      ];

    case 'call_application_package_writer':
      return [
        {
          field: 'candidateInterviewPath',
          label: 'candidate interview',
          path: candidateInterviewPath,
          freshnessRole: 'generated',
        },
        {
          field: 'applicationPackagePath',
          label: 'application package',
          path: applicationPackagePath,
          freshnessRole: 'generated',
        },
        {
          field: 'resumeDraftPath',
          label: 'resume draft',
          path: resumeDraftPath,
          freshnessRole: 'generated',
        },
        {
          field: 'applicationPackageHtmlPath',
          label: 'application package HTML',
          path: applicationPackageHtmlPath,
          freshnessRole: 'generated',
        },
        {
          field: 'reviewPath',
          label: 'application review',
          path: reviewPath,
          freshnessRole: 'review',
        },
      ];

    case 'review_pass_ready_for_user':
      return [
        {
          field: 'postingPath',
          label: 'posting',
          path: postingPath,
          freshnessRole: 'source',
        },
        {
          field: 'candidateInterviewPath',
          label: 'candidate interview',
          path: candidateInterviewPath,
          freshnessRole: 'generated',
        },
        {
          field: 'applicationPackagePath',
          label: 'application package',
          path: applicationPackagePath,
          freshnessRole: 'generated',
        },
        {
          field: 'resumeDraftPath',
          label: 'resume draft',
          path: resumeDraftPath,
          freshnessRole: 'generated',
        },
        {
          field: 'applicationPackageHtmlPath',
          label: 'application package HTML',
          path: applicationPackageHtmlPath,
          freshnessRole: 'generated',
        },
        {
          field: 'reviewPath',
          label: 'application review',
          path: reviewPath,
          freshnessRole: 'review',
        },
      ];

    default:
      return [];
  }
}

function buildCommandSuggestions(
  record: ApplicationPositionsQueueRecord,
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
      ];

    case 'run_fit_analysis':
      return [
        buildSkillCommand('application-package-writer', {
          postingPath: record.postingPath ?? join(record.applicationDir, 'posting.md'),
        }),
        buildSkillCommand('study-topic-recommender'),
        buildSkillCommand('job-fit-analyzer'),
      ];

    case 'generate_study_actions':
    case 'scheduled_retry': {
      return [
        buildSkillCommand('job-fit-analyzer'),
        buildSkillCommand('study-topic-recommender'),
      ];
    }

    case 'await_user_approval':
    case 'max_revision_exceeded_escalate':
      return [
        `# Review required: ${record.applicationPackagePath ?? record.applicationDir}`,
        buildSkillCommand('resume-exporter', { applicationDir: record.applicationDir }),
        `# To approve: update positions-queue record id=${record.id} userDecision=approved`,
        `# [requires user approval] candidate-profile.md 직접 편집으로 프로필을 갱신하세요.`,
      ];

    case 'generate_submission_checklist':
      return [
        `# Submission checklist ready — submit manually at: ${record.url}`,
        `# After submission: update positions-queue record id=${record.id} status=submitted`,
      ];

    case 'generate_study_action_queue':
      return [
        buildSkillCommand('tech-interview-drill'),
        `# [requires user approval] ${buildSkillCommand('interview-asset-writer', { topic: '<topic>' })}`,
      ];

    default:
      return [];
  }
}

function appendDecisionLog(
  record: ApplicationPositionsQueueRecord,
  decision: AgentDecision,
): string {
  const dir = join(record.applicationDir, 'decisions');
  ensureDir(dir);
  const logPath = join(dir, 'decisions.jsonl');
  appendFileSync(logPath, JSON.stringify(decision) + '\n', 'utf-8');
  return logPath;
}

function appendArtifactGateLog(
  record: ApplicationPositionsQueueRecord,
  decision: AgentDecision,
  artifactGate: {
    allowed: boolean;
    reason?: string;
    missingArtifacts?: string[];
    pathUpdates?: Partial<ApplicationPositionsQueueRecord>;
  },
): string {
  const dir = join(record.applicationDir, 'decisions');
  ensureDir(dir);
  const logPath = join(dir, 'decisions.jsonl');
  appendFileSync(
    logPath,
    JSON.stringify({
      applicationId: record.id,
      event: 'artifact_gate_blocked',
      decision: decision.decision,
      nextStatus: decision.nextStatus,
      reason: artifactGate.reason,
      missingOrStaleArtifacts: artifactGate.missingArtifacts ?? [],
      createdAt: decision.createdAt,
    }) + '\n',
    'utf-8',
  );
  return logPath;
}

function writeSubmissionChecklist(
  record: ApplicationPositionsQueueRecord,
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
    `- [ ] After submission: update positions-queue record \`${record.id}\` status → \`submitted\``,
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
  record: ApplicationPositionsQueueRecord,
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
    '## Public-Safe Learning Signals',
    '> Pure technical topics that can guide the next external reading recommendation',
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
    buildSkillCommand('job-fit-analyzer'),
    buildSkillCommand('study-topic-recommender'),
    `\`\`\``,
  ].join('\n');

  writeFileSync(path, content, 'utf-8');
  return path;
}

function writeProfileSuggestions(
  record: ApplicationPositionsQueueRecord,
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
    '> candidate-profile.md를 직접 편집해 프로필을 갱신하세요.',
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
    '> candidate-profile.md를 직접 편집해 weak_spots와 강점을 갱신하세요.',
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
