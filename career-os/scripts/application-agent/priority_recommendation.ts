import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  type ApplicationPositionsQueueRecord,
  ApplicationPositionsQueueRecordSchema,
} from './positions_queue_schema';
import {
  readPositionsQueue,
  writePositionsQueue,
  DEFAULT_POSITIONS_QUEUE_PATH,
} from './positions_queue_io';
import {
  type ActionStage,
  RecommendationSnapshotSchema,
  type RecommendationSnapshot,
} from './priority_schema';
import { buildSkillCommand } from './skill_contracts';

const WORKSPACE_PREFIX = process.cwd().endsWith('/career-os') ? '' : 'career-os/';
const DEFAULT_OUTPUT_DIR = `${WORKSPACE_PREFIX}state/application-agent`;
const POSTING_CANDIDATES_PATH = `${WORKSPACE_PREFIX}state/posting-candidates.json`;
const POSITION_RECOMMENDATION_PATH = `${WORKSPACE_PREFIX}reports/latest/position-recommendation.md`;
const CANDIDATE_PROFILE_PATH = `${WORKSPACE_PREFIX}config/candidate-profile.md`;

type RecordType = 'positions-queue';

type CandidateInput = {
  recordType: RecordType;
  id: string;
  company: string;
  role: string;
  url: string;
  fitScore?: number;
  status: string;
  sourceFreshness?: string;
  rank?: number;
  decisionReason?: string;
  riskFlags: string[];
  nextActions: string[];
  applicationDir?: string;
  postingPath?: string;
  fitAnalysisPath?: string;
  reviewPath?: string;
  userConfirmedPriority?: unknown;
  raw: ApplicationPositionsQueueRecord;
};

type PriorityUpdate = {
  actionStage: ActionStage;
  priorityRank: number;
  priorityReason: string;
  nextAction?: string;
  riskFlags: string[];
  evidenceUrls: string[];
  recommendationSnapshot: RecommendationSnapshot;
};

type CliOptions = {
  dryRun: boolean;
  positionsQueuePath: string;
  outputDir: string;
};

function parseOpts(args: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: true,
    positionsQueuePath: DEFAULT_POSITIONS_QUEUE_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--write') opts.dryRun = false;
    else if (args[i] === '--positions-queue' && args[i + 1]) opts.positionsQueuePath = args[++i];
    else if (args[i] === '--output-dir' && args[i + 1]) opts.outputDir = args[++i];
  }

  return opts;
}

function loadOptionalText(path: string): string {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

function loadCandidatePoolText(path: string): string {
  const text = loadOptionalText(path);
  if (!text) return '';
  try {
    const parsed = JSON.parse(text) as { candidates?: unknown[] };
    return JSON.stringify(parsed.candidates ?? []);
  } catch {
    return '';
  }
}

function loadRecentDailyPositionReport(): { path?: string; text: string } {
  const dailyRoot = `${WORKSPACE_PREFIX}reports/daily`;
  if (!existsSync(dailyRoot)) return { text: '' };

  const candidates: string[] = [];
  for (const dateDir of readdirSync(dailyRoot).sort().reverse()) {
    const datePath = join(dailyRoot, dateDir);
    if (!existsSync(datePath)) continue;
    collectMarkdownFiles(datePath, candidates);
    const match = candidates.find((p) => /position|포지션|recommend/i.test(p));
    if (match) return { path: match, text: loadOptionalText(match) };
  }

  return { text: '' };
}

function collectMarkdownFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) collectMarkdownFiles(fullPath, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(fullPath);
  }
}

function positionsQueueToCandidateInput(record: ApplicationPositionsQueueRecord): CandidateInput {
  return {
    recordType: 'positions-queue',
    id: record.id,
    company: record.company,
    role: record.role,
    url: record.url,
    fitScore: record.fitScore,
    status: record.status,
    sourceFreshness: record.sourceFreshness,
    decisionReason: record.decisionReason ?? record.notes,
    riskFlags: record.riskFlags ?? [],
    nextActions: record.nextActions ?? [],
    applicationDir: record.applicationDir,
    postingPath: record.postingPath,
    fitAnalysisPath: record.fitAnalysisPath,
    reviewPath: record.reviewPath,
    userConfirmedPriority: record.userConfirmedPriority,
    raw: record,
  };
}

function buildUpdate(
  candidate: CandidateInput,
  priorityRank: number,
  context: {
    sourceReportPath: string;
    livePostingsText: string;
    recommendationText: string;
    dailyReportText: string;
    candidateProfileLoaded: boolean;
  },
): PriorityUpdate {
  const stage = deriveActionStage(candidate);
  const evidenceUrls = [candidate.url].filter((url) => /^https?:\/\//.test(url));
  const riskFlags = deriveRiskFlags(candidate, context.livePostingsText);
  const sourceText = [
    context.recommendationText,
    context.dailyReportText,
    context.livePostingsText,
    readApplicationFile(candidate.postingPath),
    readApplicationFile(candidate.fitAnalysisPath),
    readApplicationFile(candidate.reviewPath),
  ].join('\n');

  const nextAction = deriveNextAction(stage, candidate);
  const priorityReason = derivePriorityReason(stage, candidate);
  const snapshot = RecommendationSnapshotSchema.parse({
    generatedAt: new Date().toISOString(),
    sourceReportPath: context.sourceReportPath,
    actionStage: stage,
    priorityRank,
    postingAnalysis: {
      activeEvidence: deriveActiveEvidence(candidate, sourceText),
      role: candidate.role,
      stack: extractStackKeywords(sourceText),
      deadline: deriveDeadline(sourceText),
      sourceUrl: candidate.url,
    },
    fitSummary: {
      summary: deriveFitSummary(candidate, context.candidateProfileLoaded),
      evidence: deriveFitEvidence(candidate),
      fitScore: candidate.fitScore,
    },
    gapSummary: {
      summary: deriveGapSummary(candidate, riskFlags, sourceText),
      gaps: deriveGaps(candidate, sourceText),
      riskFlags,
    },
    preparationActions: derivePreparationActions(stage, candidate),
  });

  return {
    actionStage: stage,
    priorityRank,
    priorityReason,
    nextAction,
    riskFlags,
    evidenceUrls,
    recommendationSnapshot: snapshot,
  };
}

function deriveActionStage(candidate: CandidateInput): ActionStage {
  if (candidate.status === 'closed' || candidate.sourceFreshness === 'stale') {
    return 'low-priority';
  }
  if (candidate.status === 'ready_for_user_review') {
    return 'prepare-now';
  }
  if ((candidate.fitScore ?? 0) >= 85 && candidate.sourceFreshness !== 'stale') {
    return 'prepare-now';
  }
  if ((candidate.fitScore ?? 0) >= 75) return 'investigate';
  if (candidate.sourceFreshness === 'fresh') return 'monitor';
  return 'low-priority';
}

function deriveRiskFlags(candidate: CandidateInput, livePostingsText: string): string[] {
  const flags = new Set(candidate.riskFlags);
  if (candidate.sourceFreshness === 'stale') flags.add('source_stale');
  if (candidate.status === 'closed') flags.add('record_closed');
  if (!livePostingsText.includes(candidate.url)) flags.add('missing_from_latest_candidate_pool');
  if (/Kubernetes|k8s|K8s/.test(candidate.role) && !candidate.decisionReason?.includes('Kubernetes')) {
    flags.add('kubernetes_depth_check');
  }
  return [...flags].sort();
}

function derivePriorityReason(stage: ActionStage, candidate: CandidateInput): string {
  const base = candidate.decisionReason ?? `${candidate.company} ${candidate.role}`;
  switch (stage) {
    case 'prepare-now':
      return `지금 준비 행동으로 옮길 수 있다. ${base}`;
    case 'investigate':
      return `공고 fit은 있으나 역할 범위와 약점 확인이 먼저 필요하다. ${base}`;
    case 'monitor':
      return `active/open 후보로 유지하되 현재 즉시 준비 대상은 아니다. ${base}`;
    case 'low-priority':
      return `현재 행동 목록 하단에 둔다. ${base}`;
    case 'hold':
      return `사용자 판단 또는 상태 조건 때문에 보류한다. ${base}`;
    case 'excluded':
      return `사용자 확정 또는 명시 정책 전에는 자동 제외하지 않는다. ${base}`;
  }
}

function deriveNextAction(stage: ActionStage, candidate: CandidateInput): string | undefined {
  switch (stage) {
    case 'prepare-now':
      if (candidate.status === 'ready_for_user_review') {
        return '지원 패키지와 리뷰 결과를 사용자와 함께 확인한다.';
      }
      return '공고 분석, fit/gap 정리, 지원 패키지 초안 순서로 준비를 시작한다.';
    case 'investigate':
      return '공고 URL 활성 상태, 역할 범위, 주요 risk flag를 다시 확인한다.';
    case 'monitor':
      return 'daily refresh 대상으로 유지하고 변동 여부를 확인한다.';
    case 'low-priority':
      return '대시보드 하단에 유지하고 자동 패키지 초안 대상에서 제외한다.';
    case 'hold':
      return '사용자 판단이나 보류 조건이 바뀔 때까지 준비 행동을 멈춘다.';
    case 'excluded':
      return '추천과 준비 후보에서 제외한다.';
  }
}

function deriveFitSummary(candidate: CandidateInput, candidateProfileLoaded: boolean): string {
  const score = candidate.fitScore === undefined ? '점수 없음' : `${candidate.fitScore}점`;
  const profile = candidateProfileLoaded ? '후보자 프로필과 기존 application-agent 자산을 참고했다' : '후보자 프로필을 읽지 못했다';
  return `${score}. ${profile}. ${candidate.decisionReason ?? '상세 fit 근거는 기존 추천 리포트와 공고 파일을 확인한다.'}`;
}

function deriveFitEvidence(candidate: CandidateInput): string[] {
  const evidence = ['positions-queue record'];
  if (candidate.applicationDir) evidence.push('공고별 application directory');
  if (candidate.postingPath) evidence.push('posting.md');
  if (candidate.fitAnalysisPath) evidence.push('fit-analysis.md');
  if (candidate.reviewPath) evidence.push('review.md');
  return evidence;
}

function deriveGapSummary(
  candidate: CandidateInput,
  riskFlags: string[],
  sourceText: string,
): string {
  const gaps = deriveGaps(candidate, sourceText);
  if (gaps.length === 0 && riskFlags.length === 0) {
    return '현재 snapshot 기준으로 큰 gap은 별도 식별되지 않았다.';
  }
  return [...gaps, ...riskFlags].slice(0, 4).join(', ');
}

function deriveGaps(candidate: CandidateInput, sourceText: string): string[] {
  const gaps = new Set<string>();
  const text = `${candidate.role}\n${candidate.decisionReason ?? ''}\n${sourceText}`;
  if (/Kotlin/i.test(text)) gaps.add('Kotlin 비중 확인');
  if (/Kubernetes|k8s/i.test(text)) gaps.add('Kubernetes 운영 깊이 확인');
  if (/DB|RDBMS|MySQL|PostgreSQL|쿼리|튜닝/i.test(text)) {
    gaps.add('DB 튜닝 답변 보강');
  }
  if (/AI|LLM|RAG|Agent|AX/i.test(text)) {
    gaps.add('AI agent 실무 전환 서사 정리');
  }
  return [...gaps];
}

function derivePreparationActions(stage: ActionStage, candidate: CandidateInput) {
  if (stage === 'prepare-now') {
    return [
      {
        kind: 'posting-analysis' as const,
        label: '공고 요구사항과 active/open 근거 최신화',
      },
      {
        kind: 'package-draft' as const,
        label: '지원 패키지 초안 작성 후보',
        command: buildSkillCommand('application-package-writer', {
          postingPath: candidate.postingPath ?? `${candidate.applicationDir ?? '<applicationDir>'}/posting.md`,
        }),
      },
      {
        kind: 'application-review' as const,
        label: '지원 패키지 리뷰 후보',
        command: buildSkillCommand('application-reviewer', {
          applicationDir: candidate.applicationDir ?? '<applicationDir>',
        }),
      },
      {
        kind: 'interview-practice' as const,
        label: '실전 답변 연습 후보',
        command: buildSkillCommand('tech-interview-drill'),
      },
    ];
  }

  if (stage === 'investigate') {
    return [
      { kind: 'investigate' as const, label: '공고 URL과 역할 범위 재확인' },
      {
        kind: 'study-topic' as const,
        label: '약점을 반영한 외부 읽을거리 추천',
        command: buildSkillCommand('study-topic-recommender'),
      },
    ];
  }

  return [
    {
      kind: stage === 'monitor' ? ('monitor' as const) : ('investigate' as const),
      label: deriveNextAction(stage, candidate) ?? '상태 유지',
    },
  ];
}

function deriveActiveEvidence(candidate: CandidateInput, sourceText: string): string {
  const liveMatch = sourceText.match(/active_evidence:\s*(.+)/i);
  if (liveMatch) return liveMatch[1].trim();
  if (candidate.sourceFreshness === 'fresh') return 'sourceFreshness=fresh';
  return 'active/open evidence must be rechecked';
}

function deriveDeadline(sourceText: string): string | undefined {
  const match =
    sourceText.match(/closes_at:\s*([^\n]+)/i) ??
    sourceText.match(/공고 기간:\s*([^\n]+)/i) ??
    sourceText.match(/due:\s*([^\n]+)/i);
  return match?.[1]?.trim();
}

function extractStackKeywords(sourceText: string): string[] {
  const keywords = [
    'Java',
    'Kotlin',
    'Spring',
    'Spring Boot',
    'Kafka',
    'RabbitMQ',
    'MySQL',
    'PostgreSQL',
    'Redis',
    'AWS',
    'Kubernetes',
    'Docker',
    'LLM',
    'RAG',
    'AI Agent',
  ];
  return keywords.filter((keyword) => new RegExp(keyword, 'i').test(sourceText));
}

function readApplicationFile(path: string | undefined): string {
  if (!path) return '';
  const resolved = path.startsWith(WORKSPACE_PREFIX)
    ? path
    : `${WORKSPACE_PREFIX}${path}`;
  return loadOptionalText(resolved);
}

function applyUpdates<T extends ApplicationPositionsQueueRecord>(
  records: T[],
  updates: Map<string, PriorityUpdate>,
  schema: { parse: (input: unknown) => T },
): T[] {
  return records.map((record) => {
    const id = record.id;
    const update = updates.get(id);
    if (!update) return record;
    return schema.parse({
      ...record,
      actionStage: update.actionStage,
      priorityRank: update.priorityRank,
      priorityReason: update.priorityReason,
      nextAction: update.nextAction,
      riskFlags: update.riskFlags,
      evidenceUrls: update.evidenceUrls,
      recommendationSnapshot: update.recommendationSnapshot,
      userConfirmedPriority: record.userConfirmedPriority,
    });
  });
}

function renderDistribution(updates: PriorityUpdate[]): string {
  const counts: Record<ActionStage, number> = {
    'prepare-now': 0,
    investigate: 0,
    monitor: 0,
    'low-priority': 0,
    hold: 0,
    excluded: 0,
  };
  for (const update of updates) counts[update.actionStage]++;
  return Object.entries(counts)
    .map(([stage, count]) => `${stage}=${count}`)
    .join(', ');
}

async function main(): Promise<void> {
  const opts = parseOpts(process.argv.slice(2));
  const positionsQueue = readPositionsQueue(opts.positionsQueuePath);
  const dailyReport = loadRecentDailyPositionReport();

  const context = {
    sourceReportPath: existsSync(POSITION_RECOMMENDATION_PATH)
      ? POSITION_RECOMMENDATION_PATH
      : POSTING_CANDIDATES_PATH,
    livePostingsText: loadCandidatePoolText(POSTING_CANDIDATES_PATH),
    recommendationText: loadOptionalText(POSITION_RECOMMENDATION_PATH),
    dailyReportText: dailyReport.text,
    candidateProfileLoaded: existsSync(CANDIDATE_PROFILE_PATH),
  };

  const candidates = positionsQueue.map(positionsQueueToCandidateInput);

  if (candidates.length === 0) {
    console.error('PHASE_BLOCKED: no posting input available for priority snapshot smoke');
    process.exit(2);
  }

  const stageOrder: Record<ActionStage, number> = {
    'prepare-now': 1,
    investigate: 2,
    monitor: 3,
    'low-priority': 4,
    hold: 5,
    excluded: 6,
  };

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      stage: deriveActionStage(candidate),
    }))
    .sort((a, b) => {
      const stageDiff = stageOrder[a.stage] - stageOrder[b.stage];
      if (stageDiff !== 0) return stageDiff;
      const fitDiff = (b.candidate.fitScore ?? 0) - (a.candidate.fitScore ?? 0);
      if (fitDiff !== 0) return fitDiff;
      return (a.candidate.rank ?? 999) - (b.candidate.rank ?? 999);
    });

  const perStageRank = new Map<ActionStage, number>();
  const positionsQueueUpdates = new Map<string, PriorityUpdate>();

  for (const { candidate, stage } of ranked) {
    const priorityRank = (perStageRank.get(stage) ?? 0) + 1;
    perStageRank.set(stage, priorityRank);
    const update = buildUpdate(candidate, priorityRank, context);
    positionsQueueUpdates.set(candidate.id, update);
  }

  const allUpdates = [...positionsQueueUpdates.values()];
  console.log(`candidate count: ${candidates.length}`);
  console.log(`stage distribution: ${renderDistribution(allUpdates)}`);
  console.log(`dry-run: ${opts.dryRun ? 'yes' : 'no'}`);

  if (opts.dryRun) return;

  writePositionsQueue(
    opts.positionsQueuePath,
    applyUpdates(positionsQueue, positionsQueueUpdates, ApplicationPositionsQueueRecordSchema),
  );
  console.log(`updated positions-queue records: ${positionsQueueUpdates.size}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
