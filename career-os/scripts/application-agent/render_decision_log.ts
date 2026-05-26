import type { ActionResult } from './actions';
import { partitionStudyActions } from './safety_gate';

export function renderDecisionLogMarkdown(results: ActionResult[]): string {
  const lines: string[] = [
    '# Application Agent — Decision Log',
    `Generated: ${new Date().toISOString()}`,
    `Records: ${results.length}`,
    '',
  ];

  for (const r of results) {
    const d = r.decision;
    const statusLine =
      d.nextStatus === d.fromStatus
        ? `${d.fromStatus}`
        : `${d.fromStatus} → ${d.nextStatus}`;

    lines.push(`## ${r.applicationId}`);
    lines.push(`- Status: ${statusLine}`);
    lines.push(`- Decision: \`${d.decision}\``);
    lines.push(`- Reason: ${d.decisionReason}`);
    lines.push(`- Confidence: ${(d.confidence * 100).toFixed(0)}%`);
    lines.push(`- Allowed: ${d.allowed ? 'YES' : 'NO'}`);

    if (r.safetyBlocked) {
      lines.push('- **Safety Gate: BLOCKED**');
      for (const v of r.safetyViolations ?? []) {
        lines.push(`  - [${v.severity}] ${v.rule}: ${v.detail}`);
      }
    }

    if (d.requiredUserAction !== 'none') {
      lines.push(`- Required User Action: **${d.requiredUserAction}**`);
    }
    if (d.nextActions.length > 0) {
      lines.push(`- Next Actions: ${d.nextActions.join(', ')}`);
    }
    if (r.commandSuggestions.length > 0) {
      lines.push('- Commands:');
      for (const cmd of r.commandSuggestions) {
        lines.push(`  \`\`\`\n  ${cmd}\n  \`\`\``);
      }
    }
    if (r.ledgerUpdated) {
      lines.push('- Ledger: updated');
    }
    if (r.submissionChecklistPath) {
      lines.push(`- Submission Checklist: ${r.submissionChecklistPath}`);
    }
    if (r.studyActionsPath) {
      lines.push(`- Study Actions: ${r.studyActionsPath}`);
    }
    if (r.profileSuggestionsPath) {
      lines.push(`- Profile Suggestions: ${r.profileSuggestionsPath}`);
    }
    lines.push('');
  }

  // Summary
  const allowed = results.filter((r) => r.decision.allowed).length;
  const awaitingUser = results.filter(
    (r) => !r.decision.allowed && r.decision.requiredUserAction !== 'none',
  ).length;
  const terminal = results.filter((r) => r.decision.decision === 'terminal_skip').length;
  const noSearch = results.filter((r) => r.decision.decision === 'needs_more_search').length;
  const cooldown = results.filter((r) => r.decision.decision === 'wait_cooldown').length;
  const safetyBlocked = results.filter((r) => r.safetyBlocked).length;

  lines.push('---');
  lines.push('## Summary');
  lines.push(`- Total: ${results.length}`);
  lines.push(`- Allowed (agent-only): ${allowed}`);
  lines.push(`- Awaiting user action: ${awaitingUser}`);
  lines.push(`- Needs more search: ${noSearch}`);
  lines.push(`- Cooldown / blocked: ${cooldown}`);
  lines.push(`- Terminal (skip): ${terminal}`);
  if (safetyBlocked > 0) {
    lines.push(`- Safety gate blocked: ${safetyBlocked}`);
  }

  return lines.join('\n');
}

export function renderDecisionLogJsonl(results: ActionResult[]): string {
  return results.map((r) => JSON.stringify(r.decision)).join('\n');
}

// --- Daily Digest Report ---

export type DigestRenderOptions = {
  date?: string;
  includeDiscordDraft?: boolean;
};

/**
 * Renders a daily digest report from a set of action results.
 *
 * Separates:
 * - Agent actions today (allowed decisions)
 * - Agent-only next work (internal, no user gate)
 * - Needs user approval (requiredUserAction !== 'none')
 * - Blocked / cooldown items
 * - Public-safe study candidates (no company context)
 * - Private strategy notes (decision context for blocked/revision)
 * - Discord summary draft (6 lines max, safe for public channels)
 */
export function renderDailyDigestReport(
  results: ActionResult[],
  opts: DigestRenderOptions = {},
): string {
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const agentActions = results.filter((r) => r.decision.allowed && !r.safetyBlocked);
  const needsApproval = results.filter(
    (r) => !r.decision.allowed && r.decision.requiredUserAction !== 'none',
  );
  const agentOnlyWork = results.filter(
    (r) =>
      !r.decision.allowed &&
      r.decision.requiredUserAction === 'none' &&
      !r.safetyBlocked &&
      r.decision.decision !== 'terminal_skip' &&
      r.decision.decision !== 'wait_cooldown',
  );
  const blockedItems = results.filter(
    (r) =>
      r.decision.decision === 'wait_cooldown' ||
      (r.decision.decision === 'await_user_decision_for_blocked' &&
        r.decision.requiredUserAction === 'none'),
  );
  const safetyBlockedItems = results.filter((r) => r.safetyBlocked);
  const terminalItems = results.filter((r) => r.decision.decision === 'terminal_skip');

  // Collect all study-related nextActions across results
  const allNextActions = results.flatMap((r) => r.decision.nextActions);
  const studyActions = allNextActions.filter(
    (a) =>
      a.includes('study') ||
      a.includes('interview') ||
      a.includes('practice') ||
      a.includes('learn'),
  );
  const { publicSafe, privateActions } = partitionStudyActions(studyActions);

  // Status counts for executive summary
  const statusCounts: Record<string, number> = {};
  for (const r of results) {
    const s = r.decision.fromStatus;
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  const lines: string[] = [];

  // Header
  lines.push(`# ${date} Application Agent Digest`);
  lines.push(`Generated: ${now}`);
  lines.push('');

  // 1. Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`- Total applications tracked: ${results.length}`);
  lines.push(`- Agent actions executed: ${agentActions.length}`);
  lines.push(`- Needs user approval: ${needsApproval.length}`);
  lines.push(`- Agent-only work queued: ${agentOnlyWork.length}`);
  lines.push(`- Blocked / cooldown: ${blockedItems.length}`);
  lines.push(`- Terminal (closed/submitted): ${terminalItems.length}`);
  if (safetyBlockedItems.length > 0) {
    lines.push(`- Safety gate blocked: ${safetyBlockedItems.length}`);
  }
  lines.push('');
  lines.push('**Status breakdown:**');
  for (const [status, count] of Object.entries(statusCounts).sort()) {
    lines.push(`- ${status}: ${count}`);
  }
  lines.push('');

  // 2. Agent Actions Today
  lines.push('## Agent Actions Today');
  lines.push('');
  if (agentActions.length === 0) {
    lines.push('- (no agent actions this cycle)');
  } else {
    for (const r of agentActions) {
      const d = r.decision;
      const statusLine =
        d.nextStatus === d.fromStatus
          ? d.fromStatus
          : `${d.fromStatus} → ${d.nextStatus}`;
      lines.push(`### ${r.applicationId}`);
      lines.push(`- Status: ${statusLine}`);
      lines.push(`- Decision: \`${d.decision}\``);
      lines.push(`- Reason: ${d.decisionReason}`);
      if (r.submissionChecklistPath) {
        lines.push(`- Artifact: submission-checklist.md → ${r.submissionChecklistPath}`);
      }
      if (r.studyActionsPath) {
        lines.push(`- Artifact: private-study-actions.md → ${r.studyActionsPath}`);
      }
      if (r.profileSuggestionsPath) {
        lines.push(`- Artifact: profile-suggestions.md → ${r.profileSuggestionsPath}`);
      }
    }
  }
  lines.push('');

  // 3. Agent-Only Next Work
  lines.push('## Agent-Only Next Work');
  lines.push('');
  if (agentOnlyWork.length === 0) {
    lines.push('- (no internal work queued)');
  } else {
    for (const r of agentOnlyWork) {
      const d = r.decision;
      lines.push(`### ${r.applicationId}`);
      lines.push(`- Decision: \`${d.decision}\``);
      lines.push(`- Reason: ${d.decisionReason}`);
      if (d.nextActions.length > 0) {
        lines.push(`- Next actions: ${d.nextActions.join(', ')}`);
      }
      if (r.commandSuggestions.length > 0) {
        lines.push('- Suggested commands:');
        for (const cmd of r.commandSuggestions) {
          lines.push(`  - \`${cmd}\``);
        }
      }
    }
  }
  lines.push('');

  // 4. Needs User Approval
  lines.push('## Needs User Approval');
  lines.push('');
  if (needsApproval.length === 0) {
    lines.push('- (no items require user approval)');
  } else {
    for (const r of needsApproval) {
      const d = r.decision;
      lines.push(`### ${r.applicationId}`);
      lines.push(`- Required action: **${d.requiredUserAction}**`);
      lines.push(`- Decision: \`${d.decision}\``);
      lines.push(`- Reason: ${d.decisionReason}`);
      if (r.commandSuggestions.length > 0) {
        lines.push('- Steps:');
        for (const cmd of r.commandSuggestions) {
          lines.push(`  - \`${cmd}\``);
        }
      }
    }
  }
  lines.push('');

  // 5. Blocked / Cooldown
  lines.push('## Blocked / Cooldown');
  lines.push('');
  if (blockedItems.length === 0 && safetyBlockedItems.length === 0) {
    lines.push('- (no blocked items)');
  } else {
    for (const r of blockedItems) {
      const d = r.decision;
      lines.push(`- **${r.applicationId}**: ${d.decisionReason}`);
    }
    for (const r of safetyBlockedItems) {
      lines.push(`- **${r.applicationId}** [safety gate]: ${
        r.safetyViolations?.map((v) => v.detail).join('; ') ?? 'unknown violation'
      }`);
    }
  }
  lines.push('');

  // 6. Public-Safe Study Candidates
  lines.push('## Public-Safe Study Candidates');
  lines.push('');
  lines.push('> Pure technical topics only — no company names, resume text, or application strategy.');
  lines.push('> Safe to use with `/study-pack-writer` (requires user approval before running).');
  lines.push('');
  if (publicSafe.length === 0) {
    lines.push('- (none identified this cycle — run `/study-topic-recommender` for suggestions)');
  } else {
    for (const topic of [...new Set(publicSafe)]) {
      lines.push(`- ${topic}`);
    }
  }
  lines.push('');

  // 7. Private Strategy Notes
  lines.push('## Private Strategy Notes');
  lines.push('');
  lines.push('> Application-specific context — keep private, do not share in public channels.');
  lines.push('');
  const privateNotes: string[] = [];

  for (const r of results) {
    const d = r.decision;
    const isPrivateContext =
      d.decision === 'wait_cooldown' ||
      d.decision === 'scheduled_retry' ||
      d.decision === 'max_revision_exceeded_escalate' ||
      d.decision === 'revise_application_package' ||
      (d.decision === 'await_user_approval' && d.requiredUserAction === 'approve_submission');

    if (isPrivateContext) {
      privateNotes.push(`**${r.applicationId}** (${d.fromStatus}): ${d.decisionReason}`);
    }
  }

  for (const a of [...new Set(privateActions)]) {
    privateNotes.push(`Study context: ${a}`);
  }

  if (privateNotes.length === 0) {
    lines.push('- (no private strategy notes this cycle)');
  } else {
    for (const note of privateNotes) {
      lines.push(`- ${note}`);
    }
  }
  lines.push('');

  // 8. Discord Summary Draft
  if (opts.includeDiscordDraft !== false) {
    lines.push('## Discord Summary Draft');
    lines.push('');
    lines.push('> 6 lines max. No sensitive resume text or private application strategy.');
    lines.push('');

    const discordLines = buildDiscordSummary(results, {
      agentActionsCount: agentActions.length,
      needsApprovalCount: needsApproval.length,
      blockedCount: blockedItems.length,
      publicSafeTopics: publicSafe,
    });
    for (const l of discordLines) {
      lines.push(l);
    }
  }

  return lines.join('\n');
}

type DiscordSummaryInput = {
  agentActionsCount: number;
  needsApprovalCount: number;
  blockedCount: number;
  publicSafeTopics: string[];
};

function buildDiscordSummary(
  results: ActionResult[],
  input: DiscordSummaryInput,
): string[] {
  const lines: string[] = [];
  const total = results.length;
  const { agentActionsCount, needsApprovalCount, blockedCount, publicSafeTopics } = input;

  lines.push(
    `📋 Application Agent: ${total} tracked, ${agentActionsCount} actions taken`,
  );

  if (needsApprovalCount > 0) {
    lines.push(`⚠️ ${needsApprovalCount} item(s) need your approval`);
  }

  if (blockedCount > 0) {
    lines.push(`⏸ ${blockedCount} item(s) blocked / cooling down`);
  }

  const readyForReview = results.filter(
    (r) => r.decision.fromStatus === 'ready_for_user_review',
  ).length;
  if (readyForReview > 0) {
    lines.push(`✅ ${readyForReview} application(s) ready for your review`);
  }

  if (publicSafeTopics.length > 0) {
    lines.push(`📚 Study candidate: ${publicSafeTopics[0]}`);
  }

  lines.push(`🔄 Next: run /daily-application-digest for full analysis`);

  return lines.slice(0, 6);
}

/**
 * Extracts the Discord Summary Draft section from a rendered daily digest report.
 */
export function extractDiscordSummary(reportMarkdown: string): string | undefined {
  const match = reportMarkdown.match(
    /## Discord Summary Draft\n(?:>.*\n)*\n([\s\S]*?)(?:\n## |\n$|$)/,
  );
  if (!match) return undefined;
  return match[1].trim();
}
