import { createHash } from 'crypto';
import { type FrontdoorQueueRecord } from './frontdoor_queue_schema';
import { DEFAULT_QUEUE_PATH, readFrontdoorQueue, updateQueueRecord } from './frontdoor_queue_io';
import { appendNewRecord, readLedger } from './ledger_io';
import { ApplicationLedgerRecordSchema, type ApplicationLedgerRecord } from './ledger_schema';

const WORKSPACE_PREFIX = process.cwd().endsWith('/career-os') ? '' : 'career-os/';
const DEFAULT_LEDGER_PATH = `${WORKSPACE_PREFIX}data/applications/ledger.jsonl`;

function generateLedgerId(company: string, role: string): string {
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

function derivePriority(fitScore: number): 'high' | 'normal' | 'low' {
  if (fitScore >= 85) return 'high';
  if (fitScore >= 75) return 'normal';
  return 'low';
}

function buildNewLedgerRecord(
  queueRecord: FrontdoorQueueRecord,
  now: string,
): ApplicationLedgerRecord {
  const id = generateLedgerId(queueRecord.company, queueRecord.role);
  const applicationDir = `data/applications/${id}`;

  return ApplicationLedgerRecordSchema.parse({
    id,
    company: queueRecord.company,
    role: queueRecord.role,
    source: queueRecord.source,
    url: queueRecord.url,
    status: 'discovered',
    statusUpdatedAt: now,
    discoveredAt: now,
    applicationDir,
    postingPath: `${applicationDir}/posting.md`,
    needsUserReview: false,
    userDecision: 'pending',
    revisionCount: 0,
    maxRevisionCount: 3,
    riskFlags: [],
    nextActions: [
      'run_posting_analysis',
      'run_fit_gap_analysis',
      'generate_study_priorities',
      'generate_interview_questions',
    ],
    fitScore: queueRecord.fitScore,
    priority: derivePriority(queueRecord.fitScore),
    sourceFreshness: queueRecord.sourceFreshness,
    actionableCandidate: true,
    autonomyLevel: 'agent_only',
    requiredUserAction: 'none',
    agentPhase: 'ingested',
    lastDecisionAt: now,
    decisionReason: `frontdoor queue에서 사용자 선택 승격 (queueId: ${queueRecord.queueId}, fitScore: ${queueRecord.fitScore})`,
    notes: queueRecord.decisionReason,
  });
}

function main(): void {
  const argv = process.argv.slice(2);

  let rankFilter: number | undefined;
  let queueIdFilter: string | undefined;
  let queuePath = DEFAULT_QUEUE_PATH;
  let ledgerPath = DEFAULT_LEDGER_PATH;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--rank' && argv[i + 1]) {
      rankFilter = parseInt(argv[++i], 10);
    } else if (argv[i] === '--queue-id' && argv[i + 1]) {
      queueIdFilter = argv[++i];
    } else if (argv[i] === '--queue' && argv[i + 1]) {
      queuePath = argv[++i];
    } else if (argv[i] === '--ledger' && argv[i + 1]) {
      ledgerPath = argv[++i];
    }
  }

  if (rankFilter === undefined && !queueIdFilter) {
    console.log('Usage: promote_frontdoor_candidate.ts --rank <N> | --queue-id <id>');
    return;
  }

  const queue = readFrontdoorQueue(queuePath);
  if (queue.length === 0) {
    console.error(`PHASE_BLOCKED: frontdoor queue is empty or not found: ${queuePath}`);
    process.exit(2);
  }

  let candidate: FrontdoorQueueRecord;

  if (queueIdFilter) {
    const found = queue.find((r) => r.queueId === queueIdFilter);
    if (!found) {
      console.error(`Queue record not found: ${queueIdFilter}`);
      process.exit(1);
    }
    candidate = found;
  } else {
    const active = queue.filter(
      (r) => r.rank === rankFilter && r.status !== 'rejected' && r.status !== 'expired',
    );

    if (active.length === 0) {
      console.error(`No active candidate found for rank ${rankFilter}`);
      process.exit(1);
    }

    if (active.length > 1) {
      console.error('PHASE_BLOCKED: ambiguous frontdoor rank selection');
      console.error(`Multiple active candidates for rank ${rankFilter}:`);
      for (const c of active) {
        console.error(`  ${c.queueId} (${c.status})`);
      }
      process.exit(2);
    }

    candidate = active[0];
  }

  if (candidate.status === 'promoted_to_ledger') {
    console.log(`Already promoted: ${candidate.queueId} → ${candidate.promotedApplicationId}`);
    process.exit(0);
  }

  if (candidate.status === 'rejected' || candidate.status === 'expired') {
    console.error(`Cannot promote: ${candidate.queueId} has status=${candidate.status}`);
    process.exit(1);
  }

  const now = new Date().toISOString();

  // Mark as start_approved
  updateQueueRecord(candidate.queueId, { status: 'start_approved', selectedAt: now }, queuePath);
  console.log(`Selected: ${candidate.queueId} → start_approved`);

  // Check ledger for duplicate by URL
  const ledger = readLedger(ledgerPath);
  const duplicate = ledger.find((r) => r.url === candidate.url);

  if (duplicate) {
    updateQueueRecord(
      candidate.queueId,
      { status: 'promoted_to_ledger', promotedApplicationId: duplicate.id },
      queuePath,
    );
    console.log(`Duplicate found in ledger: ${duplicate.id} — linked without new record`);
    console.log(`Promoted: ${candidate.queueId} → promoted_to_ledger (existing: ${duplicate.id})`);
    return;
  }

  // Build and append new ledger record
  let newRecord: ApplicationLedgerRecord;
  try {
    newRecord = buildNewLedgerRecord(candidate, now);
  } catch (e) {
    console.error('PHASE_FAILED: promoted ledger record violates schema');
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  appendNewRecord(ledgerPath, newRecord);

  updateQueueRecord(
    candidate.queueId,
    { status: 'promoted_to_ledger', promotedApplicationId: newRecord.id },
    queuePath,
  );

  console.log(`Promoted: ${candidate.queueId} → promoted_to_ledger`);
  console.log(`New ledger record: ${newRecord.id}`);
  console.log(`Application dir: ${newRecord.applicationDir}`);
}

if (import.meta.main) {
  main();
}
