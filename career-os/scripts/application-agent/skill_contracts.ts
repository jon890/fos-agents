/**
 * Canonical contract definitions for all career-os native skills used by the application-flow-agent.
 *
 * Each contract documents:
 * - autonomy level (agent_only vs user_approval_required)
 * - expected output paths (relative to career-os/, {applicationDir}/{date} substituted at runtime)
 * - safety classification (fos-study publish risk, profile modification risk, external access)
 * - prerequisite guards that must pass before the skill can be invoked
 *
 * Runner uses these to build CLI command suggestions and enforce safety gates.
 */

export type SkillAutonomyLevel =
  | 'agent_only'              // runner can suggest without user gate
  | 'user_approval_required'  // must halt and present to user before proceeding
  | 'blocked_by_default';     // forbidden unless explicitly unlocked by user

export type SkillContract = {
  skillName: string;
  cliPattern: string;   // CLI invocation pattern — {applicationDir}/{topic}/{date} substituted at runtime
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
    cliPattern: 'cd career-os && claude -p "/position-recommender"',
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
    cliPattern:
      'cd career-os && claude --permission-mode acceptEdits -p "/application-package-writer {postingPath}"',
    description:
      '공고별 fit-analysis.md + application-package.md 생성. 근거 없는 주장은 needs_evidence로 마킹.',
    autonomy: 'agent_only',
    expectedOutputs: [
      '{applicationDir}/fit-analysis.md',
      '{applicationDir}/application-package.md',
    ],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: [],
  },

  'application-reviewer': {
    skillName: 'application-reviewer',
    cliPattern:
      'cd career-os && claude --permission-mode acceptEdits -p "/application-reviewer {applicationDir}"',
    description:
      '지원 패키지 심사 — evidence/drift/exaggeration/privacy/cooldown 6축 심사 후 pass/revise/blocked 판정.',
    autonomy: 'agent_only',
    expectedOutputs: ['{applicationDir}/review.md'],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: ['application_package_exists'],
  },

  'daily-application-digest': {
    skillName: 'daily-application-digest',
    cliPattern: 'cd career-os && claude -p "/daily-application-digest"',
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
    cliPattern: 'cd career-os && claude -p "/study-topic-recommender"',
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
    cliPattern: 'cd career-os && claude -p "/study-pack-writer {topic}"',
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
    cliPattern: 'cd career-os && claude -p "/interview-asset-writer {topic}"',
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

  'interview-prep-analyzer': {
    skillName: 'interview-prep-analyzer',
    cliPattern: 'cd career-os && claude -p "/interview-prep-analyzer daily"',
    description:
      'baseline/daily 두 모드 — 갭 진단 + study-progress.json 갱신. 비공개 리포트.',
    autonomy: 'agent_only',
    expectedOutputs: [
      'data/reports/daily/{date}/interview-prep-analysis.md',
      'data/study-progress.json',
    ],
    touchesFosStudy: false,
    modifiesCandidateProfile: false,
    requiresExternalAccess: false,
    prerequisiteGuards: [],
  },

  'candidate-baseline-suggester': {
    skillName: 'candidate-baseline-suggester',
    cliPattern:
      'cd career-os && claude --permission-mode acceptEdits -p "/candidate-baseline-suggester"',
    description:
      'profile-suggestions.md 생성 및 baseline 개선 후보 검토. config/candidate-profile.md 직접 수정 금지.',
    autonomy: 'user_approval_required',
    expectedOutputs: [
      'data/runtime/profile-refresh-suggestions/{date}/before.md',
      'data/runtime/profile-refresh-suggestions/{date}/after.md',
      'data/runtime/profile-refresh-suggestions/{date}/diff.md',
      'data/runtime/profile-refresh-suggestions/{date}/changes.md',
    ],
    touchesFosStudy: false,
    modifiesCandidateProfile: false, // generates suggestions only, never direct modification
    requiresExternalAccess: false,
    prerequisiteGuards: ['profile_suggestions_not_direct_modification'],
    approvalGateReason:
      'profile 반영 전 사용자 검토 필요 — agent는 profile-suggestions.md까지만 생성',
  },
};

export function buildSkillCommand(
  skillName: string,
  substitutions?: Record<string, string>,
): string {
  const contract = SKILL_CONTRACTS[skillName];
  if (!contract) return `# unknown skill: ${skillName}`;

  let cmd = contract.cliPattern;
  if (substitutions) {
    for (const [key, value] of Object.entries(substitutions)) {
      cmd = cmd.replace(`{${key}}`, value);
    }
  }
  return cmd;
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
