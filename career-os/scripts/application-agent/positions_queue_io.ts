import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import {
  type ApplicationPositionsQueueRecord,
  ApplicationPositionsQueueRecordSchema,
  parsePositionsQueueFile,
} from './positions_queue_schema';

const WORKSPACE_PREFIX = process.cwd().endsWith('/career-os') ? '' : 'career-os/';
export const DEFAULT_POSITIONS_QUEUE_PATH = `${WORKSPACE_PREFIX}state/positions-queue.jsonl`;

export function readPositionsQueue(
  path: string = DEFAULT_POSITIONS_QUEUE_PATH,
): ApplicationPositionsQueueRecord[] {
  if (!existsSync(path)) return [];
  return parsePositionsQueueFile(path);
}

export function writePositionsQueue(
  path: string,
  records: ApplicationPositionsQueueRecord[],
): void {
  ensureDir(dirname(path));
  writeFileSync(path, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
}

export function updatePositionsQueueRecord(
  positionsQueuePath: string,
  id: string,
  updates: Partial<ApplicationPositionsQueueRecord>,
): void {
  const records = readPositionsQueue(positionsQueuePath);
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`positions-queue record not found: ${id}`);
  records[idx] = ApplicationPositionsQueueRecordSchema.parse({ ...records[idx], ...updates });
  writePositionsQueue(positionsQueuePath, records);
}

export function appendNewRecord(
  positionsQueuePath: string,
  record: ApplicationPositionsQueueRecord,
): void {
  ensureDir(dirname(positionsQueuePath));
  appendFileSync(positionsQueuePath, JSON.stringify(record) + '\n', 'utf-8');
}

export function findByUrl(
  positionsQueuePath: string,
  url: string,
): ApplicationPositionsQueueRecord | undefined {
  return readPositionsQueue(positionsQueuePath).find((r) => r.url === url);
}

function ensureDir(dir: string): void {
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
}
