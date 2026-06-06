import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { z } from 'zod';
import {
  ActionStageSchema,
  PriorityRankSchema,
  UserConfirmedPrioritySchema,
} from './priority_schema';

const WORKSPACE_PREFIX = process.cwd().endsWith('/career-os') ? '' : 'career-os/';
export const DEFAULT_PRIORITY_HISTORY_PATH = `${WORKSPACE_PREFIX}data/applications/_priority-history.jsonl`;

export const PriorityHistorySnapshotSchema = z
  .object({
    actionStage: ActionStageSchema.optional(),
    priorityRank: PriorityRankSchema.optional(),
    reason: z.string().min(1).optional(),
    confirmedAt: z.string().min(1).optional(),
    confirmedBy: z.string().min(1).optional(),
  })
  .partial()
  .nullable();

export const PriorityHistoryEventSchema = z.object({
  eventId: z.string().min(1),
  recordId: z.string().min(1),
  recordType: z.enum(['frontdoor_queue', 'ledger']),
  changedAt: z.string().min(1),
  changedBy: z.string().min(1),
  previous: PriorityHistorySnapshotSchema,
  next: UserConfirmedPrioritySchema,
  reason: z.string().min(1),
  source: z.string().min(1),
});

export type PriorityHistoryEvent = z.infer<typeof PriorityHistoryEventSchema>;

export function parsePriorityHistoryLine(line: string): PriorityHistoryEvent {
  return PriorityHistoryEventSchema.parse(JSON.parse(line));
}

export function readPriorityHistory(
  path: string = DEFAULT_PRIORITY_HISTORY_PATH,
): PriorityHistoryEvent[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf-8');
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parsePriorityHistoryLine);
}

export function appendPriorityHistoryEvent(
  event: PriorityHistoryEvent,
  path: string = DEFAULT_PRIORITY_HISTORY_PATH,
): void {
  ensureDir(dirname(path));
  const parsed = PriorityHistoryEventSchema.parse(event);
  appendFileSync(path, JSON.stringify(parsed) + '\n', 'utf-8');
}

export function createPriorityHistoryEvent(input: {
  recordId: string;
  recordType: 'frontdoor_queue' | 'ledger';
  changedBy: string;
  previous: z.infer<typeof PriorityHistorySnapshotSchema>;
  next: z.infer<typeof UserConfirmedPrioritySchema>;
  reason: string;
  source: string;
  changedAt?: string;
}): PriorityHistoryEvent {
  const changedAt = input.changedAt ?? new Date().toISOString();
  const eventId = `priority-${changedAt.replace(/[^0-9]/g, '').slice(0, 14)}-${input.recordId}`;
  return PriorityHistoryEventSchema.parse({
    eventId,
    recordId: input.recordId,
    recordType: input.recordType,
    changedAt,
    changedBy: input.changedBy,
    previous: input.previous,
    next: input.next,
    reason: input.reason,
    source: input.source,
  });
}

function ensureDir(dir: string): void {
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
}
