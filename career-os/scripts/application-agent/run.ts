import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  buildPreparationActionSuggestions,
  executeDecision,
  type ActionOptions,
  type ActionResult,
} from './actions';
import { ingestPositionReport } from './ingest_position_report';
import { DEFAULT_LEDGER_PATH, readLedger, writeLedger } from './ledger_io';
import {
  parseLedgerFile,
  isActionableCandidate,
  type ApplicationLedgerRecord,
} from './ledger_schema';
import {
  DEFAULT_QUEUE_PATH,
  readFrontdoorQueue,
  writeFrontdoorQueue,
} from './frontdoor_queue_io';
import { FrontdoorQueueRecordSchema } from './frontdoor_queue_schema';
import {
  ActionStageSchema,
  UserConfirmedPrioritySchema,
  type ActionStage,
} from './priority_schema';
import {
  appendPriorityHistoryEvent,
  createPriorityHistoryEvent,
  DEFAULT_PRIORITY_HISTORY_PATH,
} from './priority_history';
import { decideForRecord, rankCandidates } from './policy';
import {
  renderDecisionLogMarkdown,
  renderDecisionLogJsonl,
  renderDailyDigestReport,
  extractDiscordSummary,
} from './render_decision_log';
import {
  executeRequiredSkills,
  type SkillExecutionResult,
} from './skill_executor';
import {
  createProgressNotifier,
  renderApplicationLabel,
  renderDecisionStartMessage,
  renderExecutionBlockedMessage,
  renderLedgerUpdatedMessage,
} from './progress_notifier';

type RunOptions = {
  ledgerPath: string;
  outputDir: string;
  format: 'markdown' | 'jsonl';
  dryRun: boolean;
  maxActions: number;
  executeSkills: boolean;
  skillTimeoutMs: number;
  notifyDiscord: boolean;
};

type AgentRunResult = ActionResult & {
  skillExecution?: SkillExecutionResult;
};

function parseOpts(args: string[]): Partial<RunOptions> {
  const opts: Partial<RunOptions> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ledger' && args[i + 1]) opts.ledgerPath = args[++i];
    else if (args[i] === '--output-dir' && args[i + 1]) opts.outputDir = args[++i];
    else if (args[i] === '--format' && args[i + 1])
      opts.format = args[++i] as 'markdown' | 'jsonl';
    else if (args[i] === '--max-actions' && args[i + 1])
      opts.maxActions = parseInt(args[++i]);
    else if (args[i] === '--execute-skills') opts.executeSkills = true;
    else if (args[i] === '--notify-discord') opts.notifyDiscord = true;
    else if (args[i] === '--skill-timeout-ms' && args[i + 1])
      opts.skillTimeoutMs = parseInt(args[++i]);
  }
  return opts;
}

function resolveOpts(partial: Partial<RunOptions>, isDryRun = false): RunOptions {
  return {
    ledgerPath: partial.ledgerPath ?? DEFAULT_LEDGER_PATH,
    outputDir: partial.outputDir ?? 'data/runtime/application-agent',
    format: partial.format ?? 'markdown',
    dryRun: isDryRun,
    maxActions: partial.maxActions ?? 5,
    executeSkills: partial.executeSkills ?? false,
    skillTimeoutMs: partial.skillTimeoutMs ?? 20 * 60 * 1000,
    notifyDiscord: partial.notifyDiscord ?? false,
  };
}

// --- Commands ---

function cmdValidate(args: string[]): void {
  const opts = parseOpts(args);
  const ledgerPath = opts.ledgerPath ?? DEFAULT_LEDGER_PATH;

  if (!existsSync(ledgerPath)) {
    console.error(`ledger not found: ${ledgerPath}`);
    process.exit(2);
  }

  const records = parseLedgerFile(ledgerPath);
  const ids = new Set<string>();
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const record of records) {
    if (ids.has(record.id)) {
      errors.push(`duplicate id: ${record.id}`);
    }
    ids.add(record.id);

    // Safety invariants
    if (record.sourceFreshness === 'stale' && record.actionableCandidate === true) {
      warnings.push(`[${record.id}] actionableCandidate=true but sourceFreshness=stale`);
    }
    if (record.status === 'closed' && record.actionableCandidate === true) {
      warnings.push(`[${record.id}] actionableCandidate=true on closed record`);
    }
    if (record.status === 'approved' && record.userDecision !== 'approved') {
      warnings.push(
        `[${record.id}] status=approved but userDecision=${record.userDecision}`,
      );
    }
    if (record.status === 'blocked' && record.actionableCandidate === true && !record.nextRunAt) {
      warnings.push(
        `[${record.id}] actionableCandidate=true on blocked record without nextRunAt`,
      );
    }

    // Private/public boundary flags
    const publicUnsafe = record.riskFlags.filter((f) => f.startsWith('public_unsafe'));
    if (publicUnsafe.length > 0) {
      warnings.push(`[${record.id}] public-unsafe flags: ${publicUnsafe.join(', ')}`);
    }

    // Path existence (warnings only — fixtures may not have real paths on disk)
    for (const [field, p] of [
      ['fitAnalysisPath', record.fitAnalysisPath],
      ['applicationPackagePath', record.applicationPackagePath],
      ['reviewPath', record.reviewPath],
    ] as const) {
      if (p && !workspacePathExists(p)) {
        warnings.push(`[${record.id}] ${field} not found on disk: ${p}`);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn('Warnings:');
    for (const w of warnings) console.warn(' ', w);
  }
  if (errors.length > 0) {
    console.error('Errors:');
    for (const e of errors) console.error(' ', e);
    process.exit(1);
  }

  const warnSuffix = warnings.length > 0 ? ` (${warnings.length} warnings)` : '';
  console.log(`ledger ok: ${records.length} records${warnSuffix}`);
}

function parseConfirmPriorityArgs(args: string[]): {
  recordId?: string;
  recordType?: 'frontdoor_queue' | 'ledger';
  actionStage?: ActionStage;
  priorityRank?: number;
  reason?: string;
  changedBy: string;
  queuePath: string;
  ledgerPath: string;
  historyPath: string;
} {
  const parsed = {
    changedBy: 'user',
    queuePath: DEFAULT_QUEUE_PATH,
    ledgerPath: DEFAULT_LEDGER_PATH,
    historyPath: DEFAULT_PRIORITY_HISTORY_PATH,
  } as {
    recordId?: string;
    recordType?: 'frontdoor_queue' | 'ledger';
    actionStage?: ActionStage;
    priorityRank?: number;
    reason?: string;
    changedBy: string;
    queuePath: string;
    ledgerPath: string;
    historyPath: string;
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--record-id' && args[i + 1]) parsed.recordId = args[++i];
    else if (args[i] === '--record-type' && args[i + 1]) {
      const recordType = args[++i];
      if (recordType !== 'frontdoor_queue' && recordType !== 'ledger') {
        throw new Error('--record-type must be frontdoor_queue or ledger');
      }
      parsed.recordType = recordType;
    } else if (args[i] === '--stage' && args[i + 1]) {
      parsed.actionStage = ActionStageSchema.parse(args[++i]);
    } else if (args[i] === '--rank' && args[i + 1]) {
      parsed.priorityRank = Number.parseInt(args[++i], 10);
    } else if (args[i] === '--reason' && args[i + 1]) {
      parsed.reason = args[++i];
    } else if (args[i] === '--changed-by' && args[i + 1]) {
      parsed.changedBy = args[++i];
    } else if (args[i] === '--queue' && args[i + 1]) {
      parsed.queuePath = args[++i];
    } else if (args[i] === '--ledger' && args[i + 1]) {
      parsed.ledgerPath = args[++i];
    } else if (args[i] === '--history' && args[i + 1]) {
      parsed.historyPath = args[++i];
    }
  }

  return parsed;
}

export type ConfirmPriorityInput = {
  recordId: string;
  recordType?: 'frontdoor_queue' | 'ledger';
  actionStage: ActionStage;
  priorityRank: number;
  reason: string;
  changedBy: string;
  queuePath?: string;
  ledgerPath?: string;
  historyPath?: string;
};

export type ConfirmPriorityResult = {
  recordId: string;
  recordType: 'frontdoor_queue' | 'ledger';
  eventId: string;
  confirmedAt: string;
  messages: string[];
};

export function confirmPriority(input: ConfirmPriorityInput): ConfirmPriorityResult {
  const opts = {
    queuePath: DEFAULT_QUEUE_PATH,
    ledgerPath: DEFAULT_LEDGER_PATH,
    historyPath: DEFAULT_PRIORITY_HISTORY_PATH,
    ...input,
  };

  if (!Number.isInteger(opts.priorityRank) || opts.priorityRank <= 0) {
    throw new Error('--rank must be a positive integer');
  }

  const messages: string[] = [];
  const confirmedAt = new Date().toISOString();
  const next = UserConfirmedPrioritySchema.parse({
    confirmedAt,
    actionStage: opts.actionStage,
    priorityRank: opts.priorityRank,
    reason: opts.reason,
    confirmedBy: opts.changedBy,
  });

  if (!opts.recordType || opts.recordType === 'frontdoor_queue') {
    const queueRecords = readFrontdoorQueue(opts.queuePath);
    const queueIndex = queueRecords.findIndex((record) => record.queueId === opts.recordId);
    if (queueIndex !== -1) {
      const previous = queueRecords[queueIndex].userConfirmedPriority ?? null;
      queueRecords[queueIndex] = FrontdoorQueueRecordSchema.parse({
        ...queueRecords[queueIndex],
        userConfirmedPriority: next,
      });
      writeFrontdoorQueue(queueRecords, opts.queuePath);
      const event = createPriorityHistoryEvent({
        recordId: opts.recordId,
        recordType: 'frontdoor_queue',
        changedBy: opts.changedBy,
        previous,
        next,
        reason: opts.reason,
        source: 'confirm-priority-command',
        changedAt: confirmedAt,
      });
      appendPriorityHistoryEvent(event, opts.historyPath);
      messages.push(`confirmed priority for frontdoor queue record: ${opts.recordId}`);
      messages.push(`suggested next actions: ${queueRecords[queueIndex].nextAction ?? '(none)'}`);
      return {
        recordId: opts.recordId,
        recordType: 'frontdoor_queue',
        eventId: event.eventId,
        confirmedAt,
        messages,
      };
    }
  }

  if (!opts.recordType || opts.recordType === 'ledger') {
    const ledgerRecords = readLedger(opts.ledgerPath);
    const ledgerIndex = ledgerRecords.findIndex((record) => record.id === opts.recordId);
    if (ledgerIndex !== -1) {
      const previous = ledgerRecords[ledgerIndex].userConfirmedPriority ?? null;
      ledgerRecords[ledgerIndex] = {
        ...ledgerRecords[ledgerIndex],
        userConfirmedPriority: next,
      };
      writeLedger(opts.ledgerPath, ledgerRecords);
      const event = createPriorityHistoryEvent({
        recordId: opts.recordId,
        recordType: 'ledger',
        changedBy: opts.changedBy,
        previous,
        next,
        reason: opts.reason,
        source: 'confirm-priority-command',
        changedAt: confirmedAt,
      });
      appendPriorityHistoryEvent(event, opts.historyPath);
      messages.push(`confirmed priority for ledger record: ${opts.recordId}`);
      const suggestions = buildPreparationActionSuggestions(
        next.actionStage,
        ledgerRecords[ledgerIndex],
      );
      for (const suggestion of suggestions) messages.push(suggestion);
      return {
        recordId: opts.recordId,
        recordType: 'ledger',
        eventId: event.eventId,
        confirmedAt,
        messages,
      };
    }
  }

  throw new Error(`record not found in requested priority source: ${opts.recordId}`);
}

function cmdConfirmPriority(args: string[]): void {
  const opts = parseConfirmPriorityArgs(args);
  if (!opts.recordId || !opts.actionStage || !opts.priorityRank || !opts.reason) {
    console.error(
      'Usage: confirm-priority --record-id <id> --stage <stage> --rank <n> --reason <text>',
    );
    process.exit(1);
  }
  if (!Number.isInteger(opts.priorityRank) || opts.priorityRank <= 0) {
    console.error('--rank must be a positive integer');
    process.exit(1);
  }

  try {
    const result = confirmPriority({
      recordId: opts.recordId,
      recordType: opts.recordType,
      actionStage: opts.actionStage,
      priorityRank: opts.priorityRank,
      reason: opts.reason,
      changedBy: opts.changedBy,
      queuePath: opts.queuePath,
      ledgerPath: opts.ledgerPath,
      historyPath: opts.historyPath,
    });
    for (const message of result.messages) console.log(message);
    console.log(`priority history event: ${result.eventId}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function cmdDryRun(args: string[]): Promise<void> {
  const opts = resolveOpts(parseOpts(args), true);
  const records = readLedger(opts.ledgerPath);

  if (records.length === 0) {
    console.log('No records in ledger.');
    return;
  }

  const ranked = rankCandidates(records);
  const results: AgentRunResult[] = [];

  for (const record of ranked) {
    const decision = decideForRecord(record);
    results.push(await executeDecisionWithOptionalSkills(record, decision, opts));
  }

  const output =
    opts.format === 'jsonl'
      ? renderDecisionLogJsonl(results)
      : renderDecisionLogMarkdown(results);
  console.log(output);
}

async function cmdRunOnce(args: string[]): Promise<void> {
  const opts = resolveOpts(parseOpts(args), false);
  const records = readLedger(opts.ledgerPath);
  const ranked = rankCandidates(records);

  for (const record of ranked) {
    if (!isActionableCandidate(record)) continue;
    const decision = decideForRecord(record);
    if (!decision.allowed) continue;

    const result = await executeDecisionWithOptionalSkills(record, decision, opts);

    if (result.safetyBlocked) {
      console.warn(`[safety check blocked] ${record.id}:`);
      for (const v of result.safetyViolations ?? []) {
        console.warn(`  [${v.severity}] ${v.rule}: ${v.detail}`);
      }
      continue;
    }

    printResult(result, opts);
    if (result.executionBlocked) return;
    return;
  }

  console.log('No actionable candidates available for run-once.');
}

async function cmdRunDaily(args: string[]): Promise<void> {
  const opts = resolveOpts(parseOpts(args), false);
  const records = readLedger(opts.ledgerPath);
  const ranked = rankCandidates(records);
  const results: AgentRunResult[] = [];
  let actionCount = 0;

  for (const record of ranked) {
    if (actionCount >= opts.maxActions) break;
    const decision = decideForRecord(record);
    const result = await executeDecisionWithOptionalSkills(record, decision, opts);
    results.push(result);

    if (result.safetyBlocked) {
      console.warn(`[safety check blocked] ${record.id}:`);
      for (const v of result.safetyViolations ?? []) {
        console.warn(`  [${v.severity}] ${v.rule}: ${v.detail}`);
      }
      continue;
    }

    if (decision.allowed && !result.executionBlocked) actionCount++;
    printResult(result, opts);
  }

  console.log('');
  printSummary(results, opts);
}

async function cmdResume(applicationId: string, args: string[]): Promise<void> {
  const opts = resolveOpts(parseOpts(args), false);
  const records = readLedger(opts.ledgerPath);
  const record = records.find((r) => r.id === applicationId);

  if (!record) {
    console.error(`Application not found: ${applicationId}`);
    process.exit(1);
  }

  const decision = decideForRecord(record);
  const result = await executeDecisionWithOptionalSkills(record, decision, opts);

  if (result.safetyBlocked) {
    console.warn(`[safety check blocked] ${record.id}:`);
    for (const v of result.safetyViolations ?? []) {
      console.warn(`  [${v.severity}] ${v.rule}: ${v.detail}`);
    }
    return;
  }

  printResult(result, opts);
}

async function cmdIngestPositionReport(
  reportPath: string,
  args: string[],
): Promise<void> {
  const partial = parseOpts(args);
  const ledgerPath = partial.ledgerPath ?? 'data/applications/ledger.jsonl';

  if (!reportPath) {
    console.error('Usage: ingest-position-report <report-path> [--ledger <path>]');
    process.exit(1);
  }

  const result = ingestPositionReport(reportPath, ledgerPath);
  console.log('Ingest complete:');
  console.log(`  Total positions: ${result.total}`);
  console.log(`  Added:   ${result.added}`);
  console.log(`  Skipped: ${result.skipped} (already in ledger)`);
  if (result.newIds.length > 0) {
    console.log(`  New IDs: ${result.newIds.join(', ')}`);
  }
  if (result.errors.length > 0) {
    console.error('  Errors:');
    for (const e of result.errors) console.error('   ', e);
    process.exit(1);
  }
}

async function cmdReportDaily(args: string[]): Promise<void> {
  const opts = resolveOpts(parseOpts(args), true); // dry-run: no ledger writes
  const records = readLedger(opts.ledgerPath);

  if (records.length === 0) {
    console.log('No records in ledger — nothing to report.');
    return;
  }

  const ranked = rankCandidates(records);
  const results: AgentRunResult[] = [];

  for (const record of ranked) {
    const decision = decideForRecord(record);
    results.push(await executeDecisionWithOptionalSkills(record, decision, opts));
  }

  const date = new Date().toISOString().slice(0, 10);
  const report = renderDailyDigestReport(results, { date, includeDiscordDraft: true });

  // Write digest to timestamped output directory
  const outDir = join(opts.outputDir, 'reports', 'daily', date, 'application-agent');
  ensureDir(outDir);
  const outPath = join(outDir, 'digest.md');
  writeFileSync(outPath, report, 'utf-8');

  console.log(`Digest written: ${outPath}`);

  // Print Discord summary to stdout for cron/runner to pick up
  const discordSummary = extractDiscordSummary(report);
  if (discordSummary) {
    console.log('\n--- Discord Summary ---');
    console.log(discordSummary);
    console.log('-----------------------');
    console.log(`\nTo send: bun _shared/lib/notify_discord.ts --channel $DISCORD_CHANNEL_ID --message "$(cat ${outPath} | grep -A 10 '## Discord Summary Draft' | tail -n +4)"`);
  }
}

// --- Helpers ---

async function executeDecisionWithOptionalSkills(
  record: ApplicationLedgerRecord,
  decision: ReturnType<typeof decideForRecord>,
  opts: RunOptions,
): Promise<AgentRunResult> {
  const notifier = createProgressNotifier({
    enabled: opts.notifyDiscord,
    dryRun: opts.dryRun,
  });

  if (opts.executeSkills && decision.allowed) {
    await notifier.notify(renderDecisionStartMessage(record, decision));
  }

  const skillExecution =
    opts.executeSkills && decision.allowed
      ? await executeRequiredSkills(record, decision, {
          enabled: opts.executeSkills,
          dryRun: opts.dryRun,
          timeoutMs: opts.skillTimeoutMs,
          notify: (message) => notifier.notify(message),
          applicationLabel: renderApplicationLabel(record),
        })
      : undefined;

  const result = (await executeDecision(record, decision, opts)) as AgentRunResult;
  if (skillExecution) result.skillExecution = skillExecution;

  if (opts.executeSkills && decision.allowed) {
    if (result.ledgerUpdated) {
      await notifier.notify(renderLedgerUpdatedMessage(record, decision));
    } else if (result.executionBlocked) {
      await notifier.notify(
        renderExecutionBlockedMessage(record, result.executionBlockReason),
      );
    }
  }

  return result;
}

function printResult(result: AgentRunResult, opts: RunOptions): void {
  const d = result.decision;
  const statusLine =
    d.nextStatus === d.fromStatus
      ? `${d.fromStatus}`
      : `${d.fromStatus} → ${d.nextStatus}`;

  console.log(`\n[${result.applicationId}]`);
  console.log(`  Status:   ${statusLine}`);
  console.log(`  Decision: ${d.decision}`);
  console.log(`  Reason:   ${d.decisionReason}`);
  console.log(`  Allowed:  ${d.allowed ? 'YES' : 'NO'}`);
  if (d.requiredUserAction !== 'none') {
    console.log(`  Required user action: ${d.requiredUserAction}`);
  }
  if (result.commandSuggestions.length > 0) {
    console.log('  Commands:');
    for (const cmd of result.commandSuggestions) console.log(`    ${cmd}`);
  }
  if (result.skillExecution) {
    console.log(
      `  Skill execution: ${result.skillExecution.attempted ? 'attempted' : 'not needed'}`,
    );
    for (const skill of result.skillExecution.ran) {
      console.log(`    ran: ${skill}`);
    }
    for (const skipped of result.skillExecution.skipped) {
      console.log(`    skipped: ${skipped}`);
    }
    if (result.skillExecution.failed) {
      console.log(`    failed: ${result.skillExecution.failed}`);
    }
  }
  if (result.ledgerUpdated) {
    console.log('  Ledger:   updated');
  } else if (!opts.dryRun && !d.allowed) {
    console.log('  Ledger:   NOT updated (awaiting user action or blocked)');
  } else if (opts.dryRun) {
    console.log('  Ledger:   dry-run, no writes');
  }
  if (result.submissionChecklistPath) {
    console.log(`  Checklist: ${result.submissionChecklistPath}`);
  }
  if (result.executionBlocked) {
    console.log('  Execution: blocked until required artifacts exist');
    if (result.executionBlockReason) {
      console.log(`  Reason:    ${result.executionBlockReason}`);
    }
    if (result.missingArtifacts && result.missingArtifacts.length > 0) {
      console.log('  Missing artifacts:');
      for (const artifact of result.missingArtifacts) console.log(`    ${artifact}`);
    }
  }
  if (result.studyActionsPath) {
    console.log(`  Study actions: ${result.studyActionsPath}`);
  }
  if (result.profileSuggestionsPath) {
    console.log(`  Profile suggestions: ${result.profileSuggestionsPath}`);
  }
}

function printSummary(results: AgentRunResult[], opts: RunOptions): void {
  const allowed = results.filter((r) => r.decision.allowed).length;
  const awaitingUser = results.filter(
    (r) => !r.decision.allowed && r.decision.requiredUserAction !== 'none',
  ).length;
  const terminal = results.filter((r) => r.decision.decision === 'terminal_skip').length;
  const updated = results.filter((r) => r.ledgerUpdated).length;
  const safetyBlocked = results.filter((r) => r.safetyBlocked).length;
  const executionBlocked = results.filter((r) => r.executionBlocked).length;
  const skillsRan = results.reduce((sum, r) => sum + (r.skillExecution?.ran.length ?? 0), 0);
  const skillFailures = results.filter((r) => r.skillExecution?.failed).length;

  console.log('---');
  console.log(`Summary: ${results.length} records processed`);
  console.log(`  Allowed actions:      ${allowed}`);
  console.log(`  Awaiting user action: ${awaitingUser}`);
  console.log(`  Terminal (skip):      ${terminal}`);
  if (safetyBlocked > 0) {
    console.log(`  Safety check blocked: ${safetyBlocked}`);
  }
  if (executionBlocked > 0) {
    console.log(`  Execution blocked:    ${executionBlocked}`);
  }
  if (opts.executeSkills) {
    console.log(`  Skills executed:      ${skillsRan}`);
    console.log(`  Skill failures:       ${skillFailures}`);
  }
  if (!opts.dryRun) console.log(`  Ledger updates:       ${updated}`);
  console.log(`  Dry run:              ${opts.dryRun ? 'YES (no writes)' : 'NO'}`);
  console.log(`  Execute skills:       ${opts.executeSkills ? 'YES' : 'NO'}`);
  console.log(`  Notify Discord:       ${opts.notifyDiscord ? 'YES' : 'NO'}`);
}

function ensureDir(dir: string): void {
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function workspacePathExists(path: string): boolean {
  if (existsSync(path)) return true;
  if (!process.cwd().endsWith('/career-os') && existsSync(join('career-os', path))) {
    return true;
  }
  return false;
}

function showHelp(): void {
  console.log(`Application Flow Agent

Usage:
  bun scripts/application-agent/run.ts <command> [options]

Commands:
  run-once                             Execute highest-priority agent action
  run-daily                            Process candidates within daily action limit
  dry-run                              Show decisions without writing to ledger
  validate                             Validate ledger schema and safety invariants
  resume <application-id>              Process a specific application
  ingest-position-report <path>        Import positions from position-recommender report
  report-daily                         Generate daily digest with public/private separation
  confirm-priority                     Store user-confirmed action stage and priority rank

Options:
  --ledger <path>       Ledger file (default: data/applications/ledger.jsonl)
  --output-dir <path>   Output directory (default: data/runtime/application-agent)
  --format markdown|jsonl  Decision log format (default: markdown)
  --max-actions <n>     Max agent actions per run-daily (default: 5)
  --execute-skills      Execute allowed private native skills before artifact checks
  --notify-discord      Send concise progress notifications during real execution
  --skill-timeout-ms <n>  Timeout for each skill execution (default: 1200000)

Priority confirmation:
  confirm-priority --record-id <id> [--record-type frontdoor_queue|ledger] --stage prepare-now|investigate|monitor|low-priority|hold|excluded --rank <n> --reason <text>

Safety rules (always enforced):
  - Actual job submission is never automated (checklist only)
  - Site login and browser automation are blocked
  - fos-study publish requires user approval
  - candidate-profile.md modification is blocked (profile-suggestions.md only)
  - External data transmission is blocked
`);
}

// --- Main ---

async function main(): Promise<void> {
  const [command, ...restArgs] = process.argv.slice(2);

  switch (command) {
    case 'run-once':
      await cmdRunOnce(restArgs);
      break;
    case 'run-daily':
      await cmdRunDaily(restArgs);
      break;
    case 'dry-run':
      await cmdDryRun(restArgs);
      break;
    case 'validate':
      cmdValidate(restArgs);
      break;
    case 'resume': {
      const [appId, ...resumeArgs] = restArgs;
      await cmdResume(appId, resumeArgs);
      break;
    }
    case 'ingest-position-report': {
      const [reportPath, ...ingestArgs] = restArgs;
      await cmdIngestPositionReport(reportPath, ingestArgs);
      break;
    }
    case 'report-daily':
      await cmdReportDaily(restArgs);
      break;
    case 'confirm-priority':
      cmdConfirmPriority(restArgs);
      break;
    default:
      showHelp();
      break;
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
