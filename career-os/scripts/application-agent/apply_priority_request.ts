#!/usr/bin/env bun
import { readFileSync } from 'fs';
import { z } from 'zod';
import { readFrontdoorQueue, DEFAULT_QUEUE_PATH } from './frontdoor_queue_io';
import { readLedger, DEFAULT_LEDGER_PATH } from './ledger_io';
import {
  DEFAULT_PRIORITY_HISTORY_PATH,
} from './priority_history';
import {
  PriorityActionRequestSchema,
  PriorityRequestResultSchema,
  type PriorityActionRequest,
  type PriorityRequestResult,
  type PriorityRequestSnapshot,
} from './priority_request_schema';
import {
  confirmPriority,
  type ConfirmPriorityInput,
} from './run';

type ApplyOptions = {
  requestPath?: string;
  dryRun: boolean;
  queuePath: string;
  ledgerPath: string;
  historyPath: string;
};

type CurrentProjection = PriorityRequestSnapshot;

type SnapshotMismatch = {
  field: string;
  expected: unknown;
  current: unknown;
};

function parseArgs(args: string[]): ApplyOptions {
  const opts: ApplyOptions = {
    dryRun: false,
    queuePath: DEFAULT_QUEUE_PATH,
    ledgerPath: DEFAULT_LEDGER_PATH,
    historyPath: DEFAULT_PRIORITY_HISTORY_PATH,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--request' && args[i + 1]) opts.requestPath = args[++i];
    else if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--queue' && args[i + 1]) opts.queuePath = args[++i];
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

function buildProjection(request: PriorityActionRequest, opts: ApplyOptions): CurrentProjection | null {
  if (request.recordType === 'frontdoor_queue') {
    const record = readFrontdoorQueue(opts.queuePath).find((item) => item.queueId === request.recordId);
    if (!record) return null;
    const effectiveActionStage = record.userConfirmedPriority?.actionStage ?? record.actionStage ?? null;
    return {
      recordType: 'frontdoor_queue',
      recordId: record.queueId,
      company: record.company,
      role: record.role,
      url: record.url,
      effectiveActionStage,
      priorityRank: record.userConfirmedPriority?.priorityRank ?? record.priorityRank ?? null,
      prioritySource: record.userConfirmedPriority
        ? 'user-confirmed'
        : record.actionStage
          ? 'recommendation'
          : 'none',
      latestRecommendationSnapshotAt: record.recommendationSnapshot?.generatedAt ?? null,
      latestUserConfirmationAt: record.userConfirmedPriority?.confirmedAt ?? null,
      userConfirmedPriority: record.userConfirmedPriority ?? null,
    };
  }

  const record = readLedger(opts.ledgerPath).find((item) => item.id === request.recordId);
  if (!record) return null;
  const effectiveActionStage = record.userConfirmedPriority?.actionStage ?? record.actionStage ?? null;
  return {
    recordType: 'ledger',
    recordId: record.id,
    company: record.company,
    role: record.role,
    url: record.url,
    effectiveActionStage,
    priorityRank: record.userConfirmedPriority?.priorityRank ?? record.priorityRank ?? null,
    prioritySource: record.userConfirmedPriority
      ? 'user-confirmed'
      : record.actionStage
        ? 'recommendation'
        : 'none',
    latestRecommendationSnapshotAt: record.recommendationSnapshot?.generatedAt ?? null,
    latestUserConfirmationAt: record.userConfirmedPriority?.confirmedAt ?? null,
    userConfirmedPriority: record.userConfirmedPriority ?? null,
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
  snapshot: PriorityRequestSnapshot,
  current: CurrentProjection,
): SnapshotMismatch[] {
  const fields: (keyof PriorityRequestSnapshot)[] = [
    'recordType',
    'recordId',
    'company',
    'role',
    'url',
    'effectiveActionStage',
    'priorityRank',
    'prioritySource',
    'latestRecommendationSnapshotAt',
    'latestUserConfirmationAt',
    'userConfirmedPriority',
  ];
  const mismatches: SnapshotMismatch[] = [];

  for (const field of fields) {
    if (!(field in snapshot)) continue;
    const expected = snapshot[field];
    const actual = current[field];
    if (stable(expected ?? null) !== stable(actual ?? null)) {
      mismatches.push({
        field: String(field),
        expected: expected ?? null,
        current: actual ?? null,
      });
    }
  }

  return mismatches;
}

function buildPlannedCommand(request: PriorityActionRequest, opts: ApplyOptions): string[] {
  return [
    'bun',
    'scripts/application-agent/run.ts',
    'confirm-priority',
    '--record-id',
    request.recordId,
    '--record-type',
    request.recordType,
    '--stage',
    request.requestedStage,
    '--rank',
    String(request.requestedRank),
    '--reason',
    request.reason,
    '--changed-by',
    request.changedBy,
    '--queue',
    opts.queuePath,
    '--ledger',
    opts.ledgerPath,
    '--history',
    opts.historyPath,
  ];
}

function result(input: PriorityRequestResult): PriorityRequestResult {
  return PriorityRequestResultSchema.parse(input);
}

function rejectResult(requestId: string, message: string): PriorityRequestResult {
  return result({
    requestId,
    status: 'rejected',
    dryRun: false,
    message,
  });
}

function printResult(value: PriorityRequestResult): void {
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
    const request = PriorityActionRequestSchema.parse(raw);
    requestId = request.requestId;

    if (
      request.requestSnapshot.recordType !== request.recordType ||
      request.requestSnapshot.recordId !== request.recordId
    ) {
      printResult(
        rejectResult(
          requestId,
          'request snapshot identity does not match requested record',
        ),
      );
      process.exit(2);
    }

    const current = buildProjection(request, opts);
    if (!current) {
      printResult(
        result({
          requestId,
          status: 'stale',
          dryRun: opts.dryRun,
          message: 'target record no longer exists in current career-os projection',
          recordType: request.recordType,
          recordId: request.recordId,
          plannedCommand: buildPlannedCommand(request, opts),
          staleMismatches: [
            {
              field: 'recordId',
              expected: request.recordId,
              current: null,
            },
          ],
        }),
      );
      process.exit(2);
    }

    const mismatches = collectMismatches(request.requestSnapshot, current);
    if (mismatches.length > 0) {
      printResult(
        result({
          requestId,
          status: 'stale',
          dryRun: opts.dryRun,
          message: 'request snapshot no longer matches current career-os projection',
          recordType: request.recordType,
          recordId: request.recordId,
          plannedCommand: buildPlannedCommand(request, opts),
          staleMismatches: mismatches,
        }),
      );
      process.exit(2);
    }

    const plannedCommand = buildPlannedCommand(request, opts);
    if (opts.dryRun) {
      printResult(
        result({
          requestId,
          status: 'applied',
          dryRun: true,
          message: 'dry-run passed stale guard; no career-os files were written',
          recordType: request.recordType,
          recordId: request.recordId,
          plannedCommand,
        }),
      );
      return;
    }

    const confirmInput: ConfirmPriorityInput = {
      recordId: request.recordId,
      recordType: request.recordType,
      actionStage: request.requestedStage,
      priorityRank: request.requestedRank,
      reason: request.reason,
      changedBy: request.changedBy,
      queuePath: opts.queuePath,
      ledgerPath: opts.ledgerPath,
      historyPath: opts.historyPath,
    };
    const applied = confirmPriority(confirmInput);
    printResult(
      result({
        requestId,
        status: 'applied',
        dryRun: false,
        message: 'priority request applied through application-agent confirm-priority',
        appliedEventId: applied.eventId,
        recordType: applied.recordType,
        recordId: applied.recordId,
        plannedCommand,
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      printResult(rejectResult(requestId, `invalid priority request: ${error.message}`));
      process.exit(2);
    }

    printResult(
      result({
        requestId,
        status: 'failed',
        dryRun: opts.dryRun,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exit(1);
  }
}

function showHelp(): void {
  console.log(`Priority Request Applier

Usage:
  bun scripts/application-agent/apply_priority_request.ts --request <request.json> [--dry-run]
  cat request.json | bun scripts/application-agent/apply_priority_request.ts [--dry-run]

Options:
  --queue <path>     frontdoor queue path
  --ledger <path>    ledger path
  --history <path>   priority history path
`);
}

if (import.meta.main) {
  main();
}
