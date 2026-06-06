import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  AgentForbiddenTargetStatuses,
  type ApplicationLedgerRecord,
  type ApplicationStatus,
  type RequiredUserAction,
} from './ledger_schema';
import type { AgentDecision } from './agent_decision_schema';

export const STRONG_FIT_THRESHOLD = 85;
export const NORMAL_FIT_THRESHOLD = 70;

export function computePriorityScore(record: ApplicationLedgerRecord): number {
  let score = (record.fitScore ?? 0) * 0.5;

  const priorityBoost: Record<string, number> = {
    urgent: 30,
    high: 20,
    normal: 10,
    low: 0,
  };
  score += priorityBoost[record.priority ?? 'low'] ?? 0;

  if (record.sourceFreshness === 'fresh') score += 10;

  const statusScore: Partial<Record<ApplicationStatus, number>> = {
    needs_revision: 15,
    analyzing: 12,
    preparing_application: 10,
    discovered: 8,
    interview_prep: 7,
    ready_for_user_review: 5,
    approved: 3,
    blocked: -5,
    interview_scheduled: -10,
    submitted: -20,
    closed: -20,
  };
  score += statusScore[record.status] ?? 0;

  return score;
}

export function rankCandidates(
  records: ApplicationLedgerRecord[],
): ApplicationLedgerRecord[] {
  return [...records].sort((a, b) => computePriorityScore(b) - computePriorityScore(a));
}

type DecisionInput = {
  decision: string;
  decisionReason: string;
  confidence: number;
  nextStatus: ApplicationStatus;
  nextAgentPhase?: string;
  nextActions: string[];
  requiredUserAction: RequiredUserAction;
  allowed: boolean;
};

function makeDecision(
  record: ApplicationLedgerRecord,
  now: string,
  input: DecisionInput,
): AgentDecision {
  // Safety: agent must never autonomously *transition into* forbidden statuses.
  // Staying at an already-forbidden status (e.g. approved → approved to write a checklist) is allowed.
  const forbidden =
    AgentForbiddenTargetStatuses.has(input.nextStatus) && input.nextStatus !== record.status;
  return {
    applicationId: record.id,
    fromStatus: record.status,
    fromAgentPhase: record.agentPhase,
    decision: input.decision,
    decisionReason: input.decisionReason,
    confidence: input.confidence,
    nextStatus: forbidden ? record.status : input.nextStatus,
    nextAgentPhase: input.nextAgentPhase,
    nextActions: input.nextActions,
    requiredUserAction: input.requiredUserAction,
    allowed: forbidden ? false : input.allowed,
    createdAt: now,
  };
}

export function decideForRecord(record: ApplicationLedgerRecord): AgentDecision {
  const now = new Date().toISOString();
  const fitScore = record.fitScore ?? 0;
  const reviewVerdict = readReviewVerdict(record);

  // Terminal statuses — no agent action
  if (record.status === 'closed') {
    return makeDecision(record, now, {
      decision: 'terminal_skip',
      decisionReason: 'closed는 terminal 상태 — agent 처리 없음',
      confidence: 1.0,
      nextStatus: 'closed',
      nextActions: [],
      requiredUserAction: 'none',
      allowed: false,
    });
  }

  if (record.status === 'submitted') {
    return makeDecision(record, now, {
      decision: 'terminal_skip',
      decisionReason: 'submitted 상태는 사용자 제출 완료 — agent 처리 없음',
      confidence: 1.0,
      nextStatus: 'submitted',
      nextActions: [],
      requiredUserAction: 'none',
      allowed: false,
    });
  }

  if (record.status === 'interview_scheduled') {
    return makeDecision(record, now, {
      decision: 'terminal_skip',
      decisionReason: 'interview_scheduled — 스케줄 확인 후 사용자 처리',
      confidence: 1.0,
      nextStatus: 'interview_scheduled',
      nextActions: [],
      requiredUserAction: 'none',
      allowed: false,
    });
  }

  // Stale source — search expansion needed
  if (record.sourceFreshness === 'stale') {
    return makeDecision(record, now, {
      decision: 'needs_more_search',
      decisionReason: 'sourceFreshness=stale — 공고 재확인 또는 신규 검색 필요',
      confidence: 0.9,
      nextStatus: record.status,
      nextActions: ['refresh_source_or_expand_search'],
      requiredUserAction: 'none',
      allowed: false,
    });
  }

  // Blocked — check cooldown expiry
  if (record.status === 'blocked') {
    if (record.nextRunAt) {
      const cooldownExpired = new Date(record.nextRunAt) <= new Date();
      if (!cooldownExpired) {
        return makeDecision(record, now, {
          decision: 'wait_cooldown',
          decisionReason: `쿨다운 중 — nextRunAt: ${record.nextRunAt}`,
          confidence: 1.0,
          nextStatus: 'blocked',
          nextActions: ['wait_cooldown_expiry'],
          requiredUserAction: 'none',
          allowed: false,
        });
      }
      return makeDecision(record, now, {
        decision: 'resume_from_cooldown',
        decisionReason: `쿨다운 만료 (${record.nextRunAt}) — analyzing 재개`,
        confidence: 0.85,
        nextStatus: 'analyzing',
        nextAgentPhase: 'resumed_from_cooldown',
        nextActions: ['run_fit_analysis'],
        requiredUserAction: 'none',
        allowed: true,
      });
    }
    // Blocked without nextRunAt — user decision required
    return makeDecision(record, now, {
      decision: 'await_user_decision_for_blocked',
      decisionReason: 'blocked 상태, nextRunAt 없음 — 사용자 결정 필요',
      confidence: 0.7,
      nextStatus: 'blocked',
      nextActions: [],
      requiredUserAction: 'decide_cooldown',
      allowed: false,
    });
  }

  // User approval gate — always stop
  if (record.status === 'ready_for_user_review') {
    const rua: RequiredUserAction =
      record.requiredUserAction === 'approve_submission'
        ? 'approve_submission'
        : 'review_application';
    return makeDecision(record, now, {
      decision: 'await_user_approval',
      decisionReason: '지원 패키지 완료 — 사용자 최종 승인 대기 (자동 진행 불가)',
      confidence: 1.0,
      nextStatus: 'ready_for_user_review',
      nextAgentPhase: 'user_review_pending',
      nextActions: ['await_user_approval'],
      requiredUserAction: rua,
      allowed: false,
    });
  }

  // Approved — generate checklist only, never auto-submit
  if (record.status === 'approved') {
    return makeDecision(record, now, {
      decision: 'generate_submission_checklist',
      decisionReason: '사용자 승인 완료 — 제출 체크리스트 생성 후 수동 제출 대기',
      confidence: 1.0,
      nextStatus: 'approved',
      nextAgentPhase: 'submission_checklist_ready',
      nextActions: ['generate_submission_checklist', 'await_manual_submission'],
      requiredUserAction: 'approve_submission',
      allowed: true,
    });
  }

  // Route by status for remaining actionable candidates
  switch (record.status) {
    case 'discovered': {
      if (fitScore >= NORMAL_FIT_THRESHOLD) {
        return makeDecision(record, now, {
          decision: 'run_fit_analysis',
          decisionReason: `fitScore ${fitScore} >= ${NORMAL_FIT_THRESHOLD} — analyzing 단계로 진행`,
          confidence: fitScore >= STRONG_FIT_THRESHOLD ? 0.9 : 0.75,
          nextStatus: 'analyzing',
          nextAgentPhase: 'fit_analysis_started',
          nextActions: [
            'run_posting_analysis',
            'run_fit_gap_analysis',
            'generate_study_priorities',
            'generate_interview_questions',
          ],
          requiredUserAction: 'none',
          allowed: true,
        });
      }
      return makeDecision(record, now, {
        decision: 'scheduled_retry',
        decisionReason: `fitScore ${fitScore} < ${NORMAL_FIT_THRESHOLD} — 임계값 미달, hold 처리`,
        confidence: 0.7,
        nextStatus: 'blocked',
        nextAgentPhase: 'low_fit_hold',
        nextActions: ['generate_study_actions'],
        requiredUserAction: 'none',
        allowed: true,
      });
    }

    case 'analyzing': {
      if (fitScore >= NORMAL_FIT_THRESHOLD) {
        return makeDecision(record, now, {
          decision: 'draft_application_package',
          decisionReason: `fitScore ${fitScore} — application-package-writer 호출 준비`,
          confidence: fitScore >= STRONG_FIT_THRESHOLD ? 0.9 : 0.75,
          nextStatus: 'preparing_application',
          nextAgentPhase: 'package_drafting',
          nextActions: ['call_application_package_writer'],
          requiredUserAction: 'none',
          allowed: true,
        });
      }
      return makeDecision(record, now, {
        decision: 'scheduled_retry',
        decisionReason: `fitScore ${fitScore} < ${NORMAL_FIT_THRESHOLD} — 임계값 미달`,
        confidence: 0.7,
        nextStatus: 'blocked',
        nextAgentPhase: 'low_fit_hold',
        nextActions: ['generate_study_actions'],
        requiredUserAction: 'none',
        allowed: true,
      });
    }

    case 'preparing_application': {
      if (reviewVerdict === 'pass') {
        return makeDecision(record, now, {
          decision: 'review_pass_ready_for_user',
          decisionReason: 'review.md 판정 pass — 사용자 최종 검토 단계로 전환',
          confidence: 0.95,
          nextStatus: 'ready_for_user_review',
          nextAgentPhase: 'user_review_pending',
          nextActions: ['user_review_application_package', 'await_user_approval'],
          requiredUserAction: 'review_application',
          allowed: true,
        });
      }

      return makeDecision(record, now, {
        decision: 'call_application_package_writer',
        decisionReason: 'application-package-writer 호출 — 지원 패키지 초안 작성',
        confidence: 0.85,
        nextStatus: 'needs_revision',
        nextAgentPhase: 'awaiting_package',
        nextActions: ['call_application_package_writer', 'call_application_reviewer'],
        requiredUserAction: 'none',
        allowed: true,
      });
    }

    case 'needs_revision': {
      if (reviewVerdict === 'pass') {
        return makeDecision(record, now, {
          decision: 'review_pass_ready_for_user',
          decisionReason: 'review.md 판정 pass — 사용자 최종 검토 단계로 전환',
          confidence: 0.95,
          nextStatus: 'ready_for_user_review',
          nextAgentPhase: 'user_review_pending',
          nextActions: ['user_review_application_package', 'await_user_approval'],
          requiredUserAction: 'review_application',
          allowed: true,
        });
      }

      if (record.revisionCount < record.maxRevisionCount) {
        return makeDecision(record, now, {
          decision: 'revise_application_package',
          decisionReason: `revision ${record.revisionCount}/${record.maxRevisionCount} — application-package-writer 재호출`,
          confidence: 0.8,
          nextStatus: 'preparing_application',
          nextAgentPhase: 'revision_in_progress',
          nextActions: ['call_application_package_writer'],
          requiredUserAction: 'none',
          allowed: true,
        });
      }
      // Max revisions exceeded — escalate to user
      return makeDecision(record, now, {
        decision: 'max_revision_exceeded_escalate',
        decisionReason: `revision ${record.revisionCount}/${record.maxRevisionCount} 한도 초과 — 사용자 검토 에스컬레이션`,
        confidence: 0.9,
        nextStatus: 'ready_for_user_review',
        nextAgentPhase: 'user_review_pending',
        nextActions: ['await_user_review'],
        requiredUserAction: 'review_application',
        allowed: false,
      });
    }

    case 'interview_prep': {
      return makeDecision(record, now, {
        decision: 'generate_study_actions',
        decisionReason: '인터뷰 준비 단계 — study/interview 액션 큐 생성',
        confidence: 0.85,
        nextStatus: 'interview_prep',
        nextAgentPhase: 'study_actions_queued',
        nextActions: ['generate_study_action_queue', 'call_interview_prep_analyzer'],
        requiredUserAction: 'none',
        allowed: true,
      });
    }

    default: {
      return makeDecision(record, now, {
        decision: 'unknown_status_skip',
        decisionReason: `알 수 없는 status: ${record.status}`,
        confidence: 0.1,
        nextStatus: record.status,
        nextActions: [],
        requiredUserAction: 'none',
        allowed: false,
      });
    }
  }
}

function readReviewVerdict(
  record: ApplicationLedgerRecord,
): 'pass' | 'revise' | 'block' | undefined {
  const reviewPath = record.reviewPath ?? join(record.applicationDir, 'review.md');
  if (!existsSync(reviewPath)) return undefined;

  const text = readFileSync(reviewPath, 'utf-8');
  if (/^\s*-\s*result:\s*pass\s*$/im.test(text)) return 'pass';
  if (/^\s*-\s*result:\s*revise\s*$/im.test(text)) return 'revise';
  if (/^\s*-\s*result:\s*block\s*$/im.test(text)) return 'block';
  return undefined;
}
