import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import {
  type FrontdoorQueueRecord,
  FrontdoorQueueRecordSchema,
  parseFrontdoorQueueFile,
} from './frontdoor_queue_schema';

const WORKSPACE_PREFIX = process.cwd().endsWith('/career-os') ? '' : 'career-os/';
export const DEFAULT_QUEUE_PATH = `${WORKSPACE_PREFIX}data/runtime/application-agent/frontdoor-queue.jsonl`;

export function readFrontdoorQueue(path: string = DEFAULT_QUEUE_PATH): FrontdoorQueueRecord[] {
  if (!existsSync(path)) return [];
  return parseFrontdoorQueueFile(path);
}

export function writeFrontdoorQueue(
  records: FrontdoorQueueRecord[],
  path: string = DEFAULT_QUEUE_PATH,
): void {
  ensureDir(dirname(path));
  writeFileSync(path, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
}

export function appendQueueRecord(
  record: FrontdoorQueueRecord,
  path: string = DEFAULT_QUEUE_PATH,
): void {
  ensureDir(dirname(path));
  appendFileSync(path, JSON.stringify(record) + '\n', 'utf-8');
}

export function updateQueueRecord(
  id: string,
  updates: Partial<FrontdoorQueueRecord>,
  path: string = DEFAULT_QUEUE_PATH,
): void {
  const records = readFrontdoorQueue(path);
  const idx = records.findIndex((r) => r.queueId === id);
  if (idx === -1) throw new Error(`frontdoor queue record not found: ${id}`);
  records[idx] = FrontdoorQueueRecordSchema.parse({ ...records[idx], ...updates });
  writeFrontdoorQueue(records, path);
}

export function findQueueRecordByUrl(
  url: string,
  path: string = DEFAULT_QUEUE_PATH,
): FrontdoorQueueRecord | undefined {
  return readFrontdoorQueue(path).find((r) => r.url === url);
}

function ensureDir(dir: string): void {
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
}
