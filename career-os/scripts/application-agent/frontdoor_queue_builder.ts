import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import {
  FrontdoorQueueRecordSchema,
  type FrontdoorQueueRecord,
  type FrontdoorQueueStatus,
} from './frontdoor_queue_schema';
import { readFrontdoorQueue, writeFrontdoorQueue } from './frontdoor_queue_io';

const WORKSPACE_PREFIX = process.cwd().endsWith('/career-os') ? '' : 'career-os/';
const DEFAULT_REPORT_PATH = `${WORKSPACE_PREFIX}data/runtime/position-recommendation.md`;
const DEFAULT_OUT_PATH = `${WORKSPACE_PREFIX}data/runtime/application-agent/frontdoor-queue.jsonl`;

const PROTECTED_STATUSES: FrontdoorQueueStatus[] = [
  'start_approved',
  'promoted_to_ledger',
  'rejected',
];

// Required seed URLs (TossPlace excluded — it is hardcoded from ledger)
const REQUIRED_SEED_URLS = [
  'https://kakaopay.career.greetinghr.com/en/o/144295',
  'https://career.kakaopaysec.com/job_posting/iWWBkQ7Z',
];

type Tier = 'strong' | 'stretch';

type ParsedCandidate = {
  company: string;
  role: string;
  url: string;
  tier: Tier;
  whyFit: string;
};

function parseRecommendationMarkdown(content: string): ParsedCandidate[] {
  const lines = content.split(/\r?\n/);
  const results: ParsedCandidate[] = [];
  let tier: Tier | null = null;
  let current: Partial<ParsedCandidate> | null = null;

  const flush = () => {
    if (current?.company && current.role && current.url && current.tier) {
      results.push({
        company: current.company,
        role: current.role,
        url: current.url,
        tier: current.tier,
        whyFit:
          current.whyFit ?? `${current.tier === 'strong' ? '강력' : '도전'} 추천 포지션`,
      });
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (/^##\s+강력 추천/.test(line)) {
      flush();
      tier = 'strong';
      continue;
    }
    if (/^##\s+도전 추천/.test(line)) {
      flush();
      tier = 'stretch';
      continue;
    }
    if (/^##\s+(보류|추가 수집|최근 반복|추천 배경|한 줄 결론|이번 주|수집 상태)/.test(line)) {
      flush();
      tier = null;
      continue;
    }

    if (!tier) continue;

    // "1. Company — Role"
    const itemMatch = line.match(/^\d+\.\s+(.+?)\s+[—-]\s+(.+)$/);
    if (itemMatch) {
      flush();
      current = {
        company: itemMatch[1].trim(),
        role: itemMatch[2].replace(/\*\*/g, '').trim(),
        tier,
      };
      continue;
    }

    if (!current) continue;

    // "- 공고 링크: <url>"
    const urlMatch = line.match(/^-\s+공고 링크:\s+(.+)$/);
    if (urlMatch) {
      const rawUrl = urlMatch[1].trim().split(/\s+/)[0];
      if (/^https?:\/\//.test(rawUrl)) current.url = rawUrl;
      continue;
    }

    // "- 왜 맞는가: <text>" — first occurrence only, truncated to 200 chars
    const whyMatch = line.match(/^-\s+왜 맞는가:\s+(.+)$/);
    if (whyMatch && !current.whyFit) {
      current.whyFit = whyMatch[1].trim().slice(0, 200);
    }
  }

  flush();
  return results;
}

function extractJobId(url: string): string {
  for (const pattern of [
    /\/o\/(\d+)/,
    /\/job_posting\/([A-Za-z0-9]+)/,
    /\/wd\/(\d+)/,
    /gh_jid=(\d+)/,
  ]) {
    const m = url.match(pattern);
    if (m) return m[1];
  }
  return createHash('sha1').update(url).digest('hex').slice(0, 8);
}

function deriveCompanySlug(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes('kakaopaysec')) return 'kakaopaysec';
    if (hostname.includes('kakaopay')) return 'kakaopay';
    if (hostname.includes('toss')) return 'tossplace';
    return hostname.split('.')[0].replace(/[^a-z0-9]/g, '').slice(0, 15);
  } catch {
    return 'unknown';
  }
}

function generateQueueId(url: string): string {
  return `frontdoor-${deriveCompanySlug(url)}-${extractJobId(url)}`;
}

function buildQueueRecord(candidate: ParsedCandidate, rank: number): FrontdoorQueueRecord {
  return FrontdoorQueueRecordSchema.parse({
    queueId: generateQueueId(candidate.url),
    rank,
    company: candidate.company,
    role: candidate.role,
    trackLabel: `${candidate.role.slice(0, 25)} — ${candidate.tier === 'strong' ? '강력 추천' : '도전 추천'}`,
    source: 'position-recommender',
    url: candidate.url,
    status: 'needs_user_start_approval',
    fitScore: candidate.tier === 'strong' ? 85 : 75,
    recommendationTier: candidate.tier,
    sourceFreshness: 'fresh',
    selectedAt: null,
    promotedApplicationId: null,
    decisionReason: candidate.whyFit,
    nextActions: ['await_user_start_approval'],
  });
}

function buildTossplaceSeed(rank: number): FrontdoorQueueRecord {
  return FrontdoorQueueRecordSchema.parse({
    queueId: 'frontdoor-tossplace-7746700003',
    rank,
    company: 'TossPlace',
    role: 'Applied AI Engineer',
    trackLabel: 'Applied AI Engineer — ledger 기존 후보',
    source: 'toss-careers',
    url: 'https://toss.im/career/job-detail?gh_jid=7746700003',
    status: 'promoted_to_ledger',
    fitScore: 80,
    recommendationTier: 'seed',
    sourceFreshness: 'fresh',
    selectedAt: '2026-05-22T09:42:00+09:00',
    promotedApplicationId: 'tossplace-applied-ai-engineer-7746700003',
    decisionReason:
      'TossPlace Applied AI Engineer — ledger에 ready_for_user_review 상태로 등록된 후보. 6개월 쿨다운이 거의 지났으며 사용자 최종 승인 대기 중.',
    nextActions: ['review_application_package_with_user', 'await_user_final_approval'],
  });
}

function mergeQueues(
  incoming: FrontdoorQueueRecord[],
  existing: FrontdoorQueueRecord[],
): FrontdoorQueueRecord[] {
  const existingByUrl = new Map(existing.map((r) => [r.url, r]));
  const processedUrls = new Set<string>();
  const merged: FrontdoorQueueRecord[] = [];

  for (const record of incoming) {
    const prior = existingByUrl.get(record.url);
    processedUrls.add(record.url);

    if (prior && PROTECTED_STATUSES.includes(prior.status)) {
      // User decision is final — preserve record, update rank only
      merged.push({ ...prior, rank: record.rank });
    } else if (prior) {
      // Update fields from new report but keep existing status
      merged.push({ ...record, status: prior.status });
    } else {
      merged.push(record);
    }
  }

  // Preserve existing records not present in this report cycle
  for (const prior of existing) {
    if (!processedUrls.has(prior.url)) {
      merged.push(prior);
    }
  }

  return merged;
}

function main(): void {
  const argv = process.argv.slice(2);
  const reportFlag = argv.indexOf('--report');
  const outFlag = argv.indexOf('--out');

  const reportPath = reportFlag !== -1 ? argv[reportFlag + 1] : DEFAULT_REPORT_PATH;
  const outPath = outFlag !== -1 ? argv[outFlag + 1] : DEFAULT_OUT_PATH;

  if (!reportPath || !outPath) {
    console.error('Usage: frontdoor_queue_builder.ts [--report <path>] [--out <path>]');
    process.exit(1);
  }

  if (!existsSync(reportPath)) {
    console.error(`PHASE_BLOCKED: report file not found: ${reportPath}`);
    process.exit(2);
  }

  const content = readFileSync(reportPath, 'utf-8');
  const candidates = parseRecommendationMarkdown(content);

  // Block if neither required seed URL is found in the report
  const parsedUrlSet = new Set(candidates.map((c) => c.url));
  const missingSeeds = REQUIRED_SEED_URLS.filter((u) => !parsedUrlSet.has(u));
  if (missingSeeds.length === REQUIRED_SEED_URLS.length) {
    console.error('PHASE_BLOCKED: required frontdoor seed postings unavailable');
    console.error('Missing URLs:', missingSeeds.join(', '));
    process.exit(2);
  }

  // Build records from report
  const incoming: FrontdoorQueueRecord[] = [];
  for (let i = 0; i < candidates.length; i++) {
    try {
      incoming.push(buildQueueRecord(candidates[i], i + 1));
    } catch (e) {
      console.warn(`Warning: skipping ${candidates[i].company}/${candidates[i].role}: ${e}`);
    }
  }

  // Add TossPlace seed — already promoted to ledger
  incoming.push(buildTossplaceSeed(incoming.length + 1));

  // Merge with existing queue file
  const existing = readFrontdoorQueue(outPath);
  const merged = mergeQueues(incoming, existing);

  writeFrontdoorQueue(merged, outPath);

  console.log(`frontdoor-queue: ${merged.length} records → ${outPath}`);
  for (const r of merged) {
    console.log(`  [${r.rank}] ${r.company} / ${r.role} — ${r.status}`);
  }
}

if (import.meta.main) {
  main();
}
