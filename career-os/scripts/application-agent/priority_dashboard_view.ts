import { existsSync } from 'fs';
import {
  DEFAULT_QUEUE_PATH,
  readFrontdoorQueue,
} from './frontdoor_queue_io';
import {
  DEFAULT_LEDGER_PATH,
  readLedger,
} from './ledger_io';
import {
  DEFAULT_PRIORITY_HISTORY_PATH,
  readPriorityHistory,
} from './priority_history';
import {
  type ActionStage,
  ACTION_STAGE_DISPLAY_VALUE,
} from './priority_schema';

type RecordType = 'frontdoor_queue' | 'ledger';

export type PriorityDashboardRow = {
  recordId: string;
  recordType: RecordType;
  company: string;
  role: string;
  url: string;
  effectiveActionStage?: ActionStage;
  priorityBadgeLabel: string;
  priorityDisplayValue?: number;
  priorityRank?: number;
  prioritySource: 'user-confirmed' | 'recommendation' | 'none';
  fitSummary?: string;
  gapSummary?: string;
  nextAction?: string;
  riskFlags: string[];
  evidenceUrls: string[];
  latestRecommendationSnapshotAt?: string;
  latestUserConfirmationAt?: string;
  priorityHistoryCount: number;
};

type CliOptions = {
  dryRun: boolean;
  json: boolean;
  queuePath: string;
  ledgerPath: string;
  historyPath: string;
};

function parseOpts(args: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    json: false,
    queuePath: DEFAULT_QUEUE_PATH,
    ledgerPath: DEFAULT_LEDGER_PATH,
    historyPath: DEFAULT_PRIORITY_HISTORY_PATH,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--json') opts.json = true;
    else if (args[i] === '--queue' && args[i + 1]) opts.queuePath = args[++i];
    else if (args[i] === '--ledger' && args[i + 1]) opts.ledgerPath = args[++i];
    else if (args[i] === '--history' && args[i + 1]) opts.historyPath = args[++i];
  }

  return opts;
}

export function buildPriorityDashboardRows(options?: {
  queuePath?: string;
  ledgerPath?: string;
  historyPath?: string;
}): PriorityDashboardRow[] {
  const queue = readFrontdoorQueue(options?.queuePath ?? DEFAULT_QUEUE_PATH);
  const ledger = readLedger(options?.ledgerPath ?? DEFAULT_LEDGER_PATH);
  const history = existsSync(options?.historyPath ?? DEFAULT_PRIORITY_HISTORY_PATH)
    ? readPriorityHistory(options?.historyPath ?? DEFAULT_PRIORITY_HISTORY_PATH)
    : [];

  const historyCounts = new Map<string, number>();
  for (const event of history) {
    historyCounts.set(event.recordId, (historyCounts.get(event.recordId) ?? 0) + 1);
  }

  const queueRows = queue.map((record): PriorityDashboardRow => {
    const userConfirmed = record.userConfirmedPriority;
    const effectiveActionStage = userConfirmed?.actionStage ?? record.actionStage;
    const priorityRank = userConfirmed?.priorityRank ?? record.priorityRank;
    const prioritySource = userConfirmed
      ? 'user-confirmed'
      : record.actionStage
        ? 'recommendation'
        : 'none';

    return {
      recordId: record.queueId,
      recordType: 'frontdoor_queue',
      company: record.company,
      role: record.role,
      url: record.url,
      effectiveActionStage,
      priorityBadgeLabel: renderBadgeLabel(effectiveActionStage, priorityRank),
      priorityDisplayValue: effectiveActionStage
        ? ACTION_STAGE_DISPLAY_VALUE[effectiveActionStage]
        : undefined,
      priorityRank,
      prioritySource,
      fitSummary: record.recommendationSnapshot?.fitSummary?.summary ?? record.decisionReason,
      gapSummary: record.recommendationSnapshot?.gapSummary?.summary,
      nextAction: record.nextAction ?? record.nextActions?.[0],
      riskFlags: record.riskFlags ?? [],
      evidenceUrls: record.evidenceUrls ?? [record.url],
      latestRecommendationSnapshotAt: record.recommendationSnapshot?.generatedAt,
      latestUserConfirmationAt: userConfirmed?.confirmedAt,
      priorityHistoryCount: historyCounts.get(record.queueId) ?? 0,
    };
  });

  const ledgerRows = ledger.map((record): PriorityDashboardRow => {
    const userConfirmed = record.userConfirmedPriority;
    const effectiveActionStage = userConfirmed?.actionStage ?? record.actionStage;
    const priorityRank = userConfirmed?.priorityRank ?? record.priorityRank;
    const prioritySource = userConfirmed
      ? 'user-confirmed'
      : record.actionStage
        ? 'recommendation'
        : 'none';

    return {
      recordId: record.id,
      recordType: 'ledger',
      company: record.company,
      role: record.role,
      url: record.url,
      effectiveActionStage,
      priorityBadgeLabel: renderBadgeLabel(effectiveActionStage, priorityRank),
      priorityDisplayValue: effectiveActionStage
        ? ACTION_STAGE_DISPLAY_VALUE[effectiveActionStage]
        : undefined,
      priorityRank,
      prioritySource,
      fitSummary: record.recommendationSnapshot?.fitSummary?.summary ?? record.decisionReason,
      gapSummary: record.recommendationSnapshot?.gapSummary?.summary,
      nextAction: record.nextAction ?? record.nextActions?.[0],
      riskFlags: record.riskFlags ?? [],
      evidenceUrls: record.evidenceUrls ?? [record.url],
      latestRecommendationSnapshotAt: record.recommendationSnapshot?.generatedAt,
      latestUserConfirmationAt: userConfirmed?.confirmedAt,
      priorityHistoryCount: historyCounts.get(record.id) ?? 0,
    };
  });

  return [...queueRows, ...ledgerRows].sort(compareRows);
}

function compareRows(a: PriorityDashboardRow, b: PriorityDashboardRow): number {
  const aValue = a.priorityDisplayValue ?? 99;
  const bValue = b.priorityDisplayValue ?? 99;
  if (aValue !== bValue) return aValue - bValue;
  const aRank = a.priorityRank ?? 999;
  const bRank = b.priorityRank ?? 999;
  if (aRank !== bRank) return aRank - bRank;
  return `${a.company} ${a.role}`.localeCompare(`${b.company} ${b.role}`);
}

function renderBadgeLabel(stage: ActionStage | undefined, rank: number | undefined): string {
  if (!stage) return 'unprioritized';
  const rankSuffix = rank ? ` #${rank}` : '';
  return `${stage}${rankSuffix}`;
}

function renderDistribution(rows: PriorityDashboardRow[]): string {
  const counts: Record<ActionStage, number> = {
    'prepare-now': 0,
    investigate: 0,
    monitor: 0,
    'low-priority': 0,
    hold: 0,
    excluded: 0,
  };
  for (const row of rows) {
    if (row.effectiveActionStage) counts[row.effectiveActionStage]++;
  }
  return Object.entries(counts)
    .map(([stage, count]) => `${stage}=${count}`)
    .join(', ');
}

function main(): void {
  const opts = parseOpts(process.argv.slice(2));
  const rows = buildPriorityDashboardRows({
    queuePath: opts.queuePath,
    ledgerPath: opts.ledgerPath,
    historyPath: opts.historyPath,
  });

  if (opts.json) {
    console.log(JSON.stringify({ rows }, null, 2));
    return;
  }

  console.log(`dashboard rows: ${rows.length}`);
  console.log(`stage distribution: ${renderDistribution(rows)}`);
  console.log(
    'recognized filters: prepare-now, investigate, monitor, low-priority, hold, excluded',
  );
  console.log(`dry-run: ${opts.dryRun ? 'yes' : 'no'}`);
  for (const row of rows.slice(0, 8)) {
    console.log(
      `- [${row.priorityBadgeLabel}] ${row.company} / ${row.role} (${row.recordType}, history=${row.priorityHistoryCount})`,
    );
  }
}

if (import.meta.main) {
  main();
}
