/**
 * Safety gate validator for the application-flow-agent.
 *
 * Enforces hard boundaries that the agent must never cross:
 * - No actual job submission (checklist only)
 * - No site login or browser automation
 * - No public fos-study publish without user approval
 * - No direct candidate-profile.md modification (suggestions only)
 * - No external data transmission
 *
 * Also classifies study actions as public-safe vs private to prevent
 * company names and application strategy from leaking into public channels.
 */

import type { AgentDecision } from './agent_decision_schema';

export type SafetyViolation = {
  rule: string;
  detail: string;
  severity: 'error' | 'warning';
};

export type SafetyGateResult = {
  safe: boolean;
  violations: SafetyViolation[];
};

export type StudyActionClassification = 'public_safe' | 'private';

// Action names that are unconditionally forbidden in decision.decision and nextActions
const FORBIDDEN_ACTION_NAMES: ReadonlySet<string> = new Set([
  'submit_application',
  'login_to_site',
  'automate_site_input',
  'publish_to_fos_study',
  'write_to_fos_study',
  'git_push_fos_study',
  'commit_to_fos_study',
  'modify_candidate_profile',
  'update_candidate_profile',
  'write_candidate_profile',
  'overwrite_profile',
  'edit_candidate_profile',
  'send_external_data',
  'access_external_account',
]);

// Substrings in nextAction strings indicating a public publish attempt
const PUBLIC_PUBLISH_SUBSTRINGS: readonly string[] = [
  'publish_to_fos_study',
  'commit_to_fos_study',
  'push_to_fos_study',
  'public_blog_publish',
  'fos_study_publish',
];

// Substrings in nextAction strings indicating direct profile modification
const PROFILE_MODIFICATION_SUBSTRINGS: readonly string[] = [
  'modify_candidate_profile',
  'update_candidate_profile',
  'write_candidate_profile',
  'overwrite_profile',
  'edit_candidate_profile',
];

function checkAction(action: string): SafetyViolation[] {
  const violations: SafetyViolation[] = [];

  if (FORBIDDEN_ACTION_NAMES.has(action)) {
    violations.push({
      rule: 'forbidden_action',
      detail: `action '${action}' is unconditionally forbidden`,
      severity: 'error',
    });
    return violations; // no need to check further patterns
  }

  if (PUBLIC_PUBLISH_SUBSTRINGS.some((s) => action.includes(s))) {
    violations.push({
      rule: 'public_publish_requires_gate',
      detail: `action '${action}' is a public publish operation — requires explicit user approval (approve_public_publish)`,
      severity: 'error',
    });
  }

  if (PROFILE_MODIFICATION_SUBSTRINGS.some((s) => action.includes(s))) {
    violations.push({
      rule: 'profile_modification_blocked',
      detail: `action '${action}' attempts direct profile modification — agent must produce profile-suggestions.md instead`,
      severity: 'error',
    });
  }

  return violations;
}

/**
 * Validates an AgentDecision against safety gates.
 * Returns safe=false with violations if any hard rule is breached.
 */
export function validateSafetyGate(decision: AgentDecision): SafetyGateResult {
  const violations: SafetyViolation[] = [];

  // Check the decision type itself
  violations.push(...checkAction(decision.decision));

  // Check each next action
  for (const action of decision.nextActions) {
    violations.push(...checkAction(action));
  }

  // Agent must not set status=submitted (user sets this after manual submission)
  if (decision.nextStatus === 'submitted' && decision.allowed) {
    violations.push({
      rule: 'agent_cannot_submit',
      detail:
        'agent must not set nextStatus=submitted — user sets this status after manual submission',
      severity: 'error',
    });
  }

  // Agent must not autonomously *transition into* approved — staying at approved is allowed
  if (
    decision.nextStatus === 'approved' &&
    decision.fromStatus !== 'approved' &&
    decision.allowed
  ) {
    violations.push({
      rule: 'agent_cannot_approve',
      detail:
        'agent must not transition into approved — requires explicit userDecision=approved',
      severity: 'error',
    });
  }

  return {
    safe: violations.filter((v) => v.severity === 'error').length === 0,
    violations,
  };
}

// Keywords that classify a study action or topic as private
// (contains company-specific, application-strategy, or profile context)
const PRIVATE_STUDY_KEYWORDS: readonly string[] = [
  'company',
  'interview prep for',
  'application',
  'candidate profile',
  'resume',
  'strategy',
  'submission',
  'cooldown',
  'needs_evidence',
  'fit_analysis',
  'public_unsafe',
  '지원',
  '이력서',
  '전략',
  '후보자',
  '공고',
  '패키지',
  '지원서',
];

/**
 * Classifies a study action string as public_safe or private.
 * public_safe: pure technical topic with no company/application context.
 * private: contains application-specific or candidate-profile context.
 */
export function classifyStudyAction(action: string): StudyActionClassification {
  const lower = action.toLowerCase();
  return PRIVATE_STUDY_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
    ? 'private'
    : 'public_safe';
}

/**
 * Partitions an array of study actions into public-safe and private buckets.
 */
export function partitionStudyActions(actions: string[]): {
  publicSafe: string[];
  privateActions: string[];
} {
  const publicSafe: string[] = [];
  const privateActions: string[] = [];

  for (const action of actions) {
    if (classifyStudyAction(action) === 'public_safe') {
      publicSafe.push(action);
    } else {
      privateActions.push(action);
    }
  }

  return { publicSafe, privateActions };
}
