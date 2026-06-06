import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import {
  type ApplicationLedgerRecord,
  ApplicationLedgerRecordSchema,
  parseLedgerFile,
} from './ledger_schema';

const WORKSPACE_PREFIX = process.cwd().endsWith('/career-os') ? '' : 'career-os/';
export const DEFAULT_LEDGER_PATH = `${WORKSPACE_PREFIX}data/applications/ledger.jsonl`;

export function readLedger(path: string = DEFAULT_LEDGER_PATH): ApplicationLedgerRecord[] {
  if (!existsSync(path)) return [];
  return parseLedgerFile(path);
}

export function writeLedger(path: string, records: ApplicationLedgerRecord[]): void {
  ensureDir(dirname(path));
  writeFileSync(path, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
}

export function updateLedgerRecord(
  ledgerPath: string,
  id: string,
  updates: Partial<ApplicationLedgerRecord>,
): void {
  const records = readLedger(ledgerPath);
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`ledger record not found: ${id}`);
  records[idx] = ApplicationLedgerRecordSchema.parse({ ...records[idx], ...updates });
  writeLedger(ledgerPath, records);
}

export function appendNewRecord(ledgerPath: string, record: ApplicationLedgerRecord): void {
  ensureDir(dirname(ledgerPath));
  appendFileSync(ledgerPath, JSON.stringify(record) + '\n', 'utf-8');
}

export function findByUrl(
  ledgerPath: string,
  url: string,
): ApplicationLedgerRecord | undefined {
  return readLedger(ledgerPath).find((r) => r.url === url);
}

function ensureDir(dir: string): void {
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
}
