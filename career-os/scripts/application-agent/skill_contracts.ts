/**
 * Canonical contract definitions for career-os skills used by application-flow-agent.
 *
 * Each contract documents:
 * - autonomy level (agent_only vs user_approval_required)
 * - expected output paths (relative to career-os/, {applicationDir}/{date} substituted at runtime)
 * - safety classification (fos-study publish risk, profile modification risk, external access)
 * - prerequisite guards that must pass before the skill can be invoked
 *
 * Runner uses these to build agent-neutral skill suggestions and enforce safety checks.
 * Claude CLI is a compatibility backend, not the canonical workflow contract.
 */

export type SkillAutonomyLevel =
  | 'agent_only'              // runner can suggest without user approval
  | 'user_approval_required'  // must halt and present to user before proceeding
  | 'blocked_by_default';     // forbidden unless explicitly unlocked by user

export type SkillInvocationKind = 'agent_skill' | 'local_script';

export type SkillInvocationBackend = 'current_agent' | 'claude_cli' | 'local_script';

export type ClaudePermissionMode = 'acceptEdits' | 'bypassPermissions';

export type SkillInvocationContract = {
  kind: SkillInvocationKind;
  slashCommand?: string;
  argsTemplate?: string;
  localCommandTemplate?: string;
  claudeCli?: {
    permissionMode?: ClaudePermissionMode;
  };
};

export type SkillContract = {
  skillName: string;
  invocation: SkillInvocationContract;
  description: string;
  autonomy: SkillAutonomyLevel;
  expectedOutputs: string[];  // paths relative to career-os/, template tokens allowed
  touchesFosStudy: boolean;
  modifiesCandidateProfile: boolean;
  requiresExternalAccess: boolean;
  prerequisiteGuards: string[];
  approvalGateReason?: string;
};

export const SKILL_CONTRACTS: Readonly<Record<string, SkillContract>> = {
  'position-recommender': {
    skillName: 'position-recommender',
    invocation: {
      kind: 'agent_skill',
      slashCommand: 'position-recommender',
    },
    description:
      '후보 공고 수집 및 3-tier 추천 리포트 생성. plan030 freshness guard를 prerequisite로 사용.',
    autonomy: 'agent_only',
    expectedOutputs: ['data/runtime/position-recommendation.md'],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: ['plan030_freshness_guard'],
  },

  'application-package-writer': {
    skillName: 'application-package-writer',
    invocation: {
      kind: 'agent_skill',
      slashCommand: 'application-package-writer',
      argsTemplate: '{postingPath}',
      claudeCli: { permissionMode: 'bypassPermissions' },
    },
    description:
      '공고별 fit-analysis.md + application-package.md + 제출용 Markdown 초안 생성. 근거 없는 주장은 보강 필요 / 선택지 / 권장 행동으로 분리.',
    autonomy: 'agent_only',
    expectedOutputs: [
      '{applicationDir}/fit-analysis.md',
      '{applicationDir}/application-package.md',
      '{applicationDir}/resume-draft.md',
      '{applicationDir}/cover-letter.md',
      '{applicationDir}/submission-checklist.md',
    ],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: [],
  },

  'application-reviewer': {
    skillName: 'application-reviewer',
    invocation: {
      kind: 'agent_skill',
      slashCommand: 'application-reviewer',
      argsTemplate: '{applicationDir}',
      claudeCli: { permissionMode: 'bypassPermissions' },
    },
    description:
      '지원 패키지와 제출용 Markdown 초안 심사 — evidence/drift/exaggeration/privacy/resume readiness/cooldown 축 검토 후 pass/revise/blocked 판정.',
    autonomy: 'agent_only',
    expectedOutputs: ['{applicationDir}/review.md'],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: ['application_package_exists'],
  },

  'resume-exporter': {
    skillName: 'resume-exporter',
    invocation: {
      kind: 'local_script',
      localCommandTemplate:
        'node scripts/application-agent/export_resume.ts --application-dir {applicationDir}',
    },
    description:
      '검토된 resume-draft.md와 design.md 계약으로 resume.html과 첨부 가능한 resume.pdf를 생성. 외부 제출이나 업로드는 하지 않음.',
    autonomy: 'agent_only',
    expectedOutputs: [
      '{applicationDir}/resume.html',
      '{applicationDir}/resume.pdf',
    ],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: ['resume_draft_exists', 'review_pass_or_user_requested_export'],
  },

  'daily-application-digest': {
    skillName: 'daily-application-digest',
    invocation: {
      kind: 'agent_skill',
      slashCommand: 'daily-application-digest',
    },
    description:
      '지원 현황 일일 요약. public/private 분리 report.md 생성. Discord 전송은 runner 담당.',
    autonomy: 'agent_only',
    expectedOutputs: ['data/reports/daily/{date}/application-digest/report.md'],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: ['ledger_exists'],
  },

  'study-topic-recommender': {
    skillName: 'study-topic-recommender',
    invocation: {
      kind: 'agent_skill',
      slashCommand: 'study-topic-recommender',
      claudeCli: { permissionMode: 'bypassPermissions' },
    },
    description:
      'gap 기반 private study action 후보 + RSS 보충 + 토픽 promote. 비공개 리포트.',
    autonomy: 'agent_only',
    expectedOutputs: ['data/runtime/morning-topic-recommendation.md'],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: [],
  },

  'study-pack-writer': {
    skillName: 'study-pack-writer',
    invocation: {
      kind: 'agent_skill',
      slashCommand: 'study-pack-writer',
      argsTemplate: '{topic}',
    },
    description:
      'backend study pack 작성 후 sources/fos-study에 commit/push. public-safe topic만 허용.',
    autonomy: 'user_approval_required',
    expectedOutputs: ['sources/fos-study/{category}/{topic}.md'],
    touchesFosStudy: true,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: ['topic_is_public_safe', 'no_candidate_info_in_topic'],
    approvalGateReason:
      'fos-study는 공개 저장소 — 회사명·이력서 문구·지원 전략이 포함되지 않도록 사용자 승인 필요',
  },

  'interview-asset-writer': {
    skillName: 'interview-asset-writer',
    invocation: {
      kind: 'agent_skill',
      slashCommand: 'interview-asset-writer',
      argsTemplate: '{topic}',
    },
    description:
      '후보자 이력 기반 Q&A 질문 은행 + 마스터 플레이북 생성 후 fos-study 발행.',
    autonomy: 'user_approval_required',
    expectedOutputs: ['sources/fos-study/interview/{topic}.md'],
    touchesFosStudy: true,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: ['no_private_company_info_in_output'],
    approvalGateReason:
      'fos-study 발행 + 후보자 이력 포함 — 비공개 지원 전략 노출 방지를 위해 사용자 승인 필요',
  },

  'job-fit-analyzer': {
    skillName: 'job-fit-analyzer',
    invocation: {
      kind: 'agent_skill',
      slashCommand: 'job-fit-analyzer',
    },
    description:
      '타깃 직무 역할 단위 핏·갭 진단. 지원 전 또는 시즌 시작 시 비공개 리포트로 정리.',
    autonomy: 'agent_only',
    expectedOutputs: ['data/reports/job-fit-{date}.md'],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: [],
  },

  'interview-stage-prep': {
    skillName: 'interview-stage-prep',
    invocation: {
      kind: 'agent_skill',
      slashCommand: 'interview-stage-prep',
      argsTemplate: '{stage}',
    },
    description:
      '1차·최종·오퍼 단계별 면접 실전 준비 가이드 생성. 드릴이나 공고 fit 분석은 담당하지 않음.',
    autonomy: 'agent_only',
    expectedOutputs: ['data/reports/stage-prep-{date}.md'],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: [],
  },

  'tech-interview-drill': {
    skillName: 'tech-interview-drill',
    invocation: {
      kind: 'agent_skill',
      slashCommand: 'tech-interview-drill',
    },
    description:
      '매일 기술 면접 질문에 답하고 채점·약점 환류를 기록하는 대화형 드릴.',
    autonomy: 'agent_only',
    expectedOutputs: ['data/runtime/drill-log-{date}.jsonl'],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: [],
  },

  'behavioral-interview-drill': {
    skillName: 'behavioral-interview-drill',
    invocation: {
      kind: 'agent_skill',
      slashCommand: 'behavioral-interview-drill',
    },
    description:
      '매일 인성 면접 질문에 답하고 STAR·가치관 기준으로 채점·약점 환류를 기록하는 대화형 드릴.',
    autonomy: 'agent_only',
    expectedOutputs: ['data/runtime/drill-log-{date}.jsonl'],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: [],
  },

  'question-bank-collector': {
    skillName: 'question-bank-collector',
    invocation: {
      kind: 'agent_skill',
      slashCommand: 'question-bank-collector',
      argsTemplate: '{topic}',
    },
    description:
      '공개 가능한 일반 backend/CS 면접 질문 bank를 정규화하고 보강.',
    autonomy: 'user_approval_required',
    expectedOutputs: ['public/question-bank/<category>/questions.json'],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: ['topic_is_public_safe'],
    approvalGateReason:
      '공개 질문 bank에 반영되는 항목은 개인 답변·회사별 비공개 맥락·저작권 위험이 없어야 함',
  },
};

export function buildSkillCommand(
  skillName: string,
  substitutions?: Record<string, string>,
): string {
  return buildSkillInvocationSuggestion(skillName, substitutions);
}

export function buildSkillInvocationSuggestion(
  skillName: string,
  substitutions?: Record<string, string>,
): string {
  const contract = SKILL_CONTRACTS[skillName];
  if (!contract) return `# unknown skill: ${skillName}`;

  if (contract.invocation.kind === 'local_script') {
    const command = substituteTemplate(
      contract.invocation.localCommandTemplate ?? '',
      substitutions,
    );
    return `Run local script from career-os: ${command}`;
  }

  return `Use skill: ${buildSkillSlashCommand(skillName, substitutions)}`;
}

export function buildSkillSlashCommand(
  skillName: string,
  substitutions?: Record<string, string>,
): string {
  const contract = SKILL_CONTRACTS[skillName];
  if (!contract) return `# unknown skill: ${skillName}`;
  if (contract.invocation.kind !== 'agent_skill' || !contract.invocation.slashCommand) {
    return buildSkillInvocationSuggestion(skillName, substitutions);
  }

  const args = substituteTemplate(contract.invocation.argsTemplate ?? '', substitutions).trim();
  return args.length > 0
    ? `/${contract.invocation.slashCommand} ${args}`
    : `/${contract.invocation.slashCommand}`;
}

export function buildClaudeCliArgs(
  skillName: string,
  substitutions?: Record<string, string>,
): string[] {
  const contract = SKILL_CONTRACTS[skillName];
  if (!contract) throw new Error(`unknown skill: ${skillName}`);
  if (contract.invocation.kind !== 'agent_skill') {
    throw new Error(`${skillName} is not an agent skill`);
  }

  const args = ['claude'];
  const permissionMode = contract.invocation.claudeCli?.permissionMode;
  if (permissionMode) args.push('--permission-mode', permissionMode);
  args.push('-p', buildSkillSlashCommand(skillName, substitutions));
  return args;
}

function substituteTemplate(
  template: string,
  substitutions?: Record<string, string>,
): string {
  let rendered = template;
  if (!substitutions) return rendered;
  for (const [key, value] of Object.entries(substitutions)) {
    rendered = rendered.replaceAll(`{${key}}`, value);
  }
  return rendered;
}

export function getSkillContract(skillName: string): SkillContract | undefined {
  return SKILL_CONTRACTS[skillName];
}

export function requiresUserApproval(skillName: string): boolean {
  const contract = SKILL_CONTRACTS[skillName];
  return (
    contract?.autonomy === 'user_approval_required' ||
    contract?.autonomy === 'blocked_by_default'
  );
}

export function touchesFosStudy(skillName: string): boolean {
  return SKILL_CONTRACTS[skillName]?.touchesFosStudy ?? false;
}
