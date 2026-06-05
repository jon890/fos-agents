import type { AgentDecision } from './agent_decision_schema';
import type { ApplicationLedgerRecord } from './ledger_schema';

export type ProgressNotifierOptions = {
  enabled: boolean;
  dryRun: boolean;
};

export type ProgressNotifier = {
  notify(message: string): Promise<void>;
};

export function createProgressNotifier(opts: ProgressNotifierOptions): ProgressNotifier {
  return {
    async notify(message: string): Promise<void> {
      if (!opts.enabled || opts.dryRun) return;
      await notifyDiscordNonBlocking(message);
    },
  };
}

export function renderApplicationLabel(record: ApplicationLedgerRecord): string {
  return `${record.company} / ${record.role}`;
}

export function renderDecisionStartMessage(
  record: ApplicationLedgerRecord,
  decision: AgentDecision,
): string {
  return [
    '[application-agent] 시작',
    `대상: ${renderApplicationLabel(record)}`,
    `단계: ${record.status} -> ${decision.nextStatus}`,
    `결정: ${decision.decision}`,
  ].join('\n');
}

export function renderLedgerUpdatedMessage(
  record: ApplicationLedgerRecord,
  decision: AgentDecision,
): string {
  return [
    '[application-agent] ledger 갱신 완료',
    `대상: ${renderApplicationLabel(record)}`,
    `상태: ${record.status} -> ${decision.nextStatus}`,
  ].join('\n');
}

export function renderExecutionBlockedMessage(
  record: ApplicationLedgerRecord,
  reason: string | undefined,
): string {
  return [
    '[application-agent] execution gate 대기',
    `대상: ${renderApplicationLabel(record)}`,
    `사유: ${reason ?? 'required artifacts missing or stale'}`,
  ].join('\n');
}

export async function notifyDiscordNonBlocking(message: string): Promise<void> {
  const proc = Bun.spawn(
    ['bun', '--env-file=.env', 'run', '../_shared/lib/notify_discord.ts', message],
    {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    console.warn(`[progress_notifier] Discord notify skipped: ${stderr.trim()}`);
  }
}
