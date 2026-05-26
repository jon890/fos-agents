import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { z } from 'zod';
import { appendNewRecord, readLedger } from './ledger_io';
import { type ApplicationLedgerRecord, ApplicationLedgerRecordSchema } from './ledger_schema';
import { NORMAL_FIT_THRESHOLD, STRONG_FIT_THRESHOLD } from './policy';

const PositionEntrySchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  url: z.string().url(),
  source: z.string().min(1).default('unknown'),
  fitScore: z.number().min(0).max(100).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  notes: z.string().optional(),
});

type PositionEntry = z.infer<typeof PositionEntrySchema>;

export type IngestResult = {
  total: number;
  added: number;
  skipped: number;
  errors: string[];
  newIds: string[];
};

function parsePositionReport(reportPath: string): PositionEntry[] {
  const content = readFileSync(reportPath, 'utf-8').trim();
  if (content.startsWith('[')) {
    // JSON array
    return (JSON.parse(content) as unknown[]).map((item) =>
      PositionEntrySchema.parse(item),
    );
  }
  // JSONL — one position per line
  return content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return PositionEntrySchema.parse(JSON.parse(l));
      } catch {
        return undefined;
      }
    })
    .filter((entry): entry is PositionEntry => entry !== undefined);
}

function parseMarkdownPositionReport(reportPath: string): PositionEntry[] {
  const lines = readFileSync(reportPath, 'utf-8').split(/\r?\n/);
  const entries: PositionEntry[] = [];
  let tier: 'strong' | 'stretch' | null = null;
  let current: Partial<PositionEntry> | null = null;

  const flush = () => {
    if (!current?.company || !current.role || !current.url) return;
    entries.push(
      PositionEntrySchema.parse({
        company: current.company,
        role: current.role,
        url: current.url,
        source: current.source ?? 'position-recommender',
        fitScore: current.fitScore,
        priority: current.priority,
        notes: current.notes,
      }),
    );
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^##\s+강력 추천/.test(line)) {
      flush();
      current = null;
      tier = 'strong';
      continue;
    }
    if (/^##\s+도전 추천/.test(line)) {
      flush();
      current = null;
      tier = 'stretch';
      continue;
    }
    if (/^##\s+(보류|추가 수집|최근 반복|추천 배경)/.test(line)) {
      flush();
      current = null;
      tier = null;
      continue;
    }
    if (!tier) continue;

    const item = line.match(/^\d+\.\s+(.+?)\s+[—-]\s+(.+)$/);
    if (item) {
      flush();
      current = {
        company: item[1].trim(),
        role: item[2].replace(/\*\*/g, '').trim(),
        source: 'position-recommender',
        fitScore: tier === 'strong' ? 85 : 75,
        priority: tier === 'strong' ? 'high' : 'normal',
        notes: `${tier === 'strong' ? '강력 추천' : '도전 추천'} tier에서 수집`,
      };
      continue;
    }

    const link = line.match(/^-\s+공고 링크:\s+(.+)$/);
    if (link && current) {
      const url = link[1].trim().split(/\s+/)[0];
      if (/^https?:\/\//.test(url)) current.url = url;
      continue;
    }
  }

  flush();
  return entries;
}

function generateId(company: string, role: string): string {
  const base = `${company}-${role}`;
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'position';
  const hash = createHash('sha1').update(base).digest('hex').slice(0, 8);
  const ts = Date.now().toString(36).slice(-6);
  return `app-${slug}-${hash}-${ts}`;
}

function derivePriority(
  fitScore: number | undefined,
): ApplicationLedgerRecord['priority'] {
  if (!fitScore) return 'low';
  if (fitScore >= STRONG_FIT_THRESHOLD) return 'high';
  if (fitScore >= NORMAL_FIT_THRESHOLD) return 'normal';
  return 'low';
}

export function ingestPositionReport(reportPath: string, ledgerPath: string): IngestResult {
  const result: IngestResult = {
    total: 0,
    added: 0,
    skipped: 0,
    errors: [],
    newIds: [],
  };

  if (!existsSync(reportPath)) {
    result.errors.push(`report file not found: ${reportPath}`);
    return result;
  }

  let positions: PositionEntry[];
  try {
    positions = parsePositionReport(reportPath);
    if (positions.length === 0) {
      positions = parseMarkdownPositionReport(reportPath);
    }
  } catch (e) {
    try {
      positions = parseMarkdownPositionReport(reportPath);
    } catch (markdownError) {
      result.errors.push(`failed to parse report: ${e}; markdown fallback failed: ${markdownError}`);
      return result;
    }
  }

  result.total = positions.length;
  const existing = readLedger(ledgerPath);
  const existingUrls = new Set(existing.map((r) => r.url));
  const now = new Date().toISOString();

  for (const pos of positions) {
    if (existingUrls.has(pos.url)) {
      result.skipped++;
      continue;
    }

    const id = generateId(pos.company, pos.role);
    const fitScore = pos.fitScore;
    const actionable = (fitScore ?? 0) >= NORMAL_FIT_THRESHOLD;

    let record: ApplicationLedgerRecord;
    try {
      record = ApplicationLedgerRecordSchema.parse({
        id,
        company: pos.company,
        role: pos.role,
        source: pos.source,
        url: pos.url,
        status: 'discovered',
        statusUpdatedAt: now,
        discoveredAt: now,
        applicationDir: `data/applications/${id}`,
        fitScore,
        priority: pos.priority ?? derivePriority(fitScore),
        sourceFreshness: 'fresh',
        actionableCandidate: actionable,
        autonomyLevel: 'agent_only',
        requiredUserAction: 'none',
        agentPhase: 'ingested',
        needsUserReview: false,
        userDecision: 'pending',
        revisionCount: 0,
        maxRevisionCount: 3,
        riskFlags: [],
        nextActions: actionable ? ['run_fit_analysis'] : [],
        notes: pos.notes,
        lastDecisionAt: now,
        decisionReason: `position-recommender report에서 수집 (fitScore: ${fitScore ?? 'N/A'})`,
      });
    } catch (e) {
      result.errors.push(`failed to create record for ${pos.company}/${pos.role}: ${e}`);
      continue;
    }

    appendNewRecord(ledgerPath, record);
    existingUrls.add(pos.url);
    result.added++;
    result.newIds.push(id);
  }

  return result;
}
