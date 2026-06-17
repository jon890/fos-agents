import { existsSync, statSync } from 'fs';
import { join } from 'path';
import type { AgentDecision } from './agent_decision_schema';
import type { ApplicationLedgerRecord } from './ledger_schema';
import { buildClaudeCliArgs } from './skill_contracts';

export type SkillExecutionOptions = {
  enabled: boolean;
  dryRun: boolean;
  timeoutMs: number;
  notify?: (message: string) => Promise<void>;
  applicationLabel?: string;
};

export type SkillExecutionResult = {
  attempted: boolean;
  ran: string[];
  skipped: string[];
  failed?: string;
};

type SkillInvocation = {
  skillName: 'application-package-writer' | 'application-reviewer';
  substitutions: Record<string, string>;
  requiredBefore?: string;
  expectedOutputs: string[];
  shouldRun?: () => boolean;
};

export async function executeRequiredSkills(
  record: ApplicationLedgerRecord,
  decision: AgentDecision,
  opts: SkillExecutionOptions,
): Promise<SkillExecutionResult> {
  const invocations = skillInvocationsForDecision(record, decision);
  const result: SkillExecutionResult = {
    attempted: opts.enabled && invocations.length > 0,
    ran: [],
    skipped: [],
  };

  if (!opts.enabled || invocations.length === 0) return result;

  for (const invocation of invocations) {
    if (invocation.requiredBefore && !existsSync(invocation.requiredBefore)) {
      result.skipped.push(
        `${invocation.skillName}: prerequisite missing (${invocation.requiredBefore})`,
      );
      continue;
    }

    const alreadyDone =
      invocation.expectedOutputs.every((path) => existsSync(path)) &&
      !(invocation.shouldRun?.() ?? false);
    if (alreadyDone) {
      result.skipped.push(`${invocation.skillName}: expected outputs already exist`);
      continue;
    }

    if (opts.dryRun) {
      result.skipped.push(`${invocation.skillName}: dry-run`);
      continue;
    }

    await opts.notify?.(
      [
        '[application-agent] skill 시작',
        `대상: ${opts.applicationLabel ?? record.id}`,
        `skill: ${invocation.skillName}`,
      ].join('\n'),
    );

    const run = await runClaudeCliBackend(invocation, opts.timeoutMs);
    if (!run.ok) {
      result.failed = `${invocation.skillName}: ${run.error}`;
      await opts.notify?.(
        [
          '[application-agent] skill 실패',
          `대상: ${opts.applicationLabel ?? record.id}`,
          `skill: ${invocation.skillName}`,
          `사유: ${run.error.slice(0, 300)}`,
        ].join('\n'),
      );
      break;
    }
    result.ran.push(invocation.skillName);

    const missing = invocation.expectedOutputs.filter((path) => !existsSync(path));
    if (missing.length > 0) {
      result.failed = `${invocation.skillName}: missing expected output(s): ${missing.join(', ')}`;
      await opts.notify?.(
        [
          '[application-agent] skill 산출물 누락',
          `대상: ${opts.applicationLabel ?? record.id}`,
          `skill: ${invocation.skillName}`,
          `missing: ${missing.join(', ')}`,
        ].join('\n'),
      );
      break;
    }

    await opts.notify?.(
      [
        '[application-agent] skill 완료',
        `대상: ${opts.applicationLabel ?? record.id}`,
        `skill: ${invocation.skillName}`,
      ].join('\n'),
    );
  }

  return result;
}

function skillInvocationsForDecision(
  record: ApplicationLedgerRecord,
  decision: AgentDecision,
): SkillInvocation[] {
  const postingPath = record.postingPath ?? join(record.applicationDir, 'posting.md');
  const fitAnalysisPath = record.fitAnalysisPath ?? join(record.applicationDir, 'fit-analysis.md');
  const applicationPackagePath =
    record.applicationPackagePath ?? join(record.applicationDir, 'application-package.md');
  const reviewPath = record.reviewPath ?? join(record.applicationDir, 'review.md');

  const packageWriter: SkillInvocation = {
    skillName: 'application-package-writer',
    substitutions: { postingPath },
    expectedOutputs: [
      fitAnalysisPath,
      applicationPackagePath,
      join(record.applicationDir, 'resume-draft.md'),
      join(record.applicationDir, 'cover-letter.md'),
      join(record.applicationDir, 'submission-checklist.md'),
    ],
  };
  const reviewer: SkillInvocation = {
    skillName: 'application-reviewer',
    substitutions: { applicationDir: record.applicationDir },
    requiredBefore: applicationPackagePath,
    expectedOutputs: [reviewPath],
  };

  switch (decision.decision) {
    case 'run_fit_analysis':
      return [
        {
          ...packageWriter,
          expectedOutputs: [fitAnalysisPath],
        },
      ];
    case 'draft_application_package':
      return [packageWriter];
    case 'revise_application_package':
      return [
        {
          ...packageWriter,
          shouldRun: () => isOlderOrSame(applicationPackagePath, reviewPath),
        },
      ];
    case 'call_application_package_writer':
      return [
        packageWriter,
        {
          ...reviewer,
          shouldRun: () => isOlder(reviewPath, applicationPackagePath),
        },
      ];
    default:
      return [];
  }
}

function isOlderOrSame(targetPath: string, referencePath: string): boolean {
  if (!existsSync(targetPath)) return true;
  if (!existsSync(referencePath)) return false;
  return statSync(targetPath).mtimeMs <= statSync(referencePath).mtimeMs;
}

function isOlder(targetPath: string, referencePath: string): boolean {
  if (!existsSync(targetPath)) return true;
  if (!existsSync(referencePath)) return false;
  return statSync(targetPath).mtimeMs < statSync(referencePath).mtimeMs;
}

async function runClaudeCliBackend(
  invocation: SkillInvocation,
  timeoutMs: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const proc = Bun.spawn(buildClaudeCliArgs(invocation.skillName, invocation.substitutions), {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const timeout = setTimeout(() => {
    proc.kill();
  }, timeoutMs);

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  clearTimeout(timeout);

  if (exitCode !== 0) {
    const detail = (stderr || stdout || `exit ${exitCode}`).trim();
    return { ok: false, error: detail.slice(0, 1200) };
  }

  return { ok: true };
}
