#!/usr/bin/env bun
import { readFileSync } from 'fs';
import { z } from 'zod';
import { DEFAULT_LEDGER_PATH, readLedger } from './ledger_io';
import { type ApplicationLedgerRecord } from './ledger_schema';
import { DEFAULT_PRIORITY_HISTORY_PATH } from './priority_history';
import { ACTION_STAGE_DISPLAY_VALUE, type ActionStage } from './priority_schema';
import {
  PositionActionRequestSchema,
  PositionActionResultSchema,
  type PositionActionRequest,
  type PositionActionRequestSnapshot,
  type PositionActionResult,
} from './position_action_request_schema';
import { confirmPriority } from './run';

type ApplyOptions = {
  requestPath?: string;
  dryRun: boolean;
  ledgerPath: string;
  historyPath: string;
};

type CurrentProjection = PositionActionRequestSnapshot;

type SnapshotMismatch = {
  field: string;
  expected: unknown;
  current: unknown;
};

function parseArgs(args: string[]): ApplyOptions {
  const opts: ApplyOptions = {
    dryRun: false,
    ledgerPath: DEFAULT_LEDGER_PATH,
    historyPath: DEFAULT_PRIORITY_HISTORY_PATH,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--request' && args[i + 1]) opts.requestPath = args[++i];
    else if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--ledger' && args[i + 1]) opts.ledgerPath = args[++i];
    else if (args[i] === '--history' && args[i + 1]) opts.historyPath = args[++i];
    else if (args[i] === '--help') {
      showHelp();
      process.exit(0);
    }
  }

  return opts;
}

async function readRequestJson(path?: string): Promise<unknown> {
  const text = path ? readFileSync(path, 'utf-8') : await Bun.stdin.text();
  return JSON.parse(text);
}

function effectiveStageForAction(action: PositionActionRequest['requestedAction']): ActionStage {
  if (action === 'hold') return 'hold';
  if (action === 'exclude') return 'excluded';
  return 'prepare-now';
}

function buildProjection(request: PositionActionRequest, opts: ApplyOptions): CurrentProjection | null {
  const record = readLedger(opts.ledgerPath).find((item) => item.id === request.recordId);
  if (!record) return null;
  const userConfirmed = record.userConfirmedPriority;
  const actionStage = userConfirmed?.actionStage ?? record.actionStage ?? record.recommendationSnapshot?.actionStage ?? null;
  return {
    recordType: 'ledger',
    recordId: record.id,
    workbenchId: `ledger:${record.id}`,
    company: record.company,
    role: record.role,
    url: record.url,
    status: record.status,
    actionStage,
    priorityRank: userConfirmed?.priorityRank ?? record.priorityRank ?? record.recommendationSnapshot?.priorityRank ?? null,
    prioritySource: userConfirmed ? 'user-confirmed' : record.actionStage || record.recommendationSnapshot?.actionStage ? 'recommendation' : 'none',
    ledgerId: record.id,
    readiness: undefined,
    latestRecommendationSnapshotAt: record.recommendationSnapshot?.generatedAt ?? null,
    latestUserConfirmationAt: userConfirmed?.confirmedAt ?? null,
  };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function collectMismatches(
  snapshot: PositionActionRequestSnapshot,
  current: CurrentProjection,
): SnapshotMismatch[] {
  const fields: (keyof PositionActionRequestSnapshot)[] = [
    'recordType',
    'recordId',
    'company',
    'role',
    'url',
    'status',
    'actionStage',
    'priorityRank',
    'prioritySource',
    'ledgerId',
    'latestRecommendationSnapshotAt',
    'latestUserConfirmationAt',
  ];
  const mismatches: SnapshotMismatch[] = [];

  for (const field of fields) {
    if (!(field in snapshot)) continue;
    const expected = snapshot[field];
    const actual = current[field];
    if (stable(expected ?? null) !== stable(actual ?? null)) {
      mismatches.push({ field: String(field), expected: expected ?? null, current: actual ?? null });
    }
  }

  return mismatches;
}

function priorityRankFor(stage: ActionStage, current: CurrentProjection): number {
  return current.priorityRank ?? ACTION_STAGE_DISPLAY_VALUE[stage];
}

function materialPaths(record: ApplicationLedgerRecord): Record<string, string | null> {
  const applicationDir = record.applicationDir ?? `applications/${record.id}`;
  return {
    postingPath: record.postingPath ?? `${applicationDir}/posting.md`,
    fitAnalysisPath: record.fitAnalysisPath ?? `${applicationDir}/fit-analysis.md`,
    applicationPackagePath: record.applicationPackagePath ?? `${applicationDir}/application-package.md`,
    resumeDraftPath: record.resumeDraftPath ?? `${applicationDir}/resume-draft.md`,
    coverLetterPath: record.coverLetterPath ?? `${applicationDir}/cover-letter.md`,
    submissionChecklistPath: record.submissionChecklistPath ?? `${applicationDir}/submission-checklist.md`,
    reviewPath: record.reviewPath ?? `${applicationDir}/review.md`,
  };
}

function result(input: PositionActionResult): PositionActionResult {
  return PositionActionResultSchema.parse(input);
}

function printResult(value: PositionActionResult): void {
  console.log(JSON.stringify(value, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    showHelp();
    return;
  }

  const opts = parseArgs(args);
  let requestId = 'unknown-request';

  try {
    const raw = await readRequestJson(opts.requestPath);
    const request = PositionActionRequestSchema.parse(raw);
    requestId = request.requestId;

    if (
      request.requestSnapshot.recordType !== request.recordType ||
      request.requestSnapshot.recordId !== request.recordId
    ) {
      printResult(result({
        requestId,
        status: 'failed',
        dryRun: opts.dryRun,
        message: 'request snapshot identity does not match requested record',
      }));
      process.exit(2);
    }

    const current = buildProjection(request, opts);
    if (!current) {
      printResult(result({
        requestId,
        status: 'stale',
        dryRun: opts.dryRun,
        message: 'target record no longer exists in current career-os projection',
        recordType: request.recordType,
        recordId: request.recordId,
        staleMismatches: [{ field: 'recordId', expected: request.recordId, current: null }],
      }));
      process.exit(2);
    }

    const mismatches = collectMismatches(request.requestSnapshot, current);
    if (mismatches.length > 0) {
      printResult(result({
        requestId,
        status: 'stale',
        dryRun: opts.dryRun,
        message: 'request snapshot no longer matches current career-os projection',
        recordType: request.recordType,
        recordId: request.recordId,
        staleMismatches: mismatches,
      }));
      process.exit(2);
    }

    const effectiveActionStage = effectiveStageForAction(request.requestedAction);
    if (opts.dryRun) {
      printResult(result({
        requestId,
        status: 'done',
        dryRun: true,
        message: 'dry-run passed stale guard; no career-os files were written',
        recordType: request.recordType,
        recordId: request.recordId,
        ledgerId: current.ledgerId ?? null,
        requestedAction: request.requestedAction,
        effectiveActionStage,
        resultSnapshot: {
          requestedAction: request.requestedAction,
          effectiveActionStage,
          ledgerId: current.ledgerId ?? null,
          readiness: current.readiness,
          materialPaths: null,
        },
      }));
      return;
    }

    const targetLedgerId = request.recordId;

    const applied = confirmPriority({
      recordId: targetLedgerId,
      recordType: 'ledger',
      actionStage: effectiveActionStage,
      priorityRank: priorityRankFor(effectiveActionStage, current),
      reason: request.effectiveReason,
      changedBy: request.changedBy,
      ledgerPath: opts.ledgerPath,
      historyPath: opts.historyPath,
    });

    const ledgerRecord = targetLedgerId
      ? readLedger(opts.ledgerPath).find((record) => record.id === targetLedgerId)
      : null;

    printResult(result({
      requestId,
      status: 'done',
      dryRun: false,
      message: `position action applied: ${request.requestedAction}`,
      recordType: request.recordType,
      recordId: request.recordId,
      ledgerId: targetLedgerId,
      appliedEventId: applied.eventId,
      requestedAction: request.requestedAction,
      effectiveActionStage,
      resultSnapshot: {
        requestedAction: request.requestedAction,
        effectiveActionStage,
        ledgerId: targetLedgerId,
        readiness: current.readiness,
        materialPaths: ledgerRecord ? materialPaths(ledgerRecord) : null,
      },
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      printResult(result({
        requestId,
        status: 'failed',
        dryRun: opts.dryRun,
        message: `invalid position action request: ${error.message}`,
      }));
      process.exit(2);
    }

    printResult(result({
      requestId,
      status: 'failed',
      dryRun: opts.dryRun,
      message: error instanceof Error ? error.message : String(error),
    }));
    process.exit(1);
  }
}

function showHelp(): void {
  console.log(`Position Action Request Applier

Usage:
  bun scripts/application-agent/apply_position_action_request.ts --request <request.json> [--dry-run]
  cat request.json | bun scripts/application-agent/apply_position_action_request.ts [--dry-run]

Options:
  --ledger <path>    ledger path
  --history <path>   priority history path
`);
}

if (import.meta.main) {
  main();
}
