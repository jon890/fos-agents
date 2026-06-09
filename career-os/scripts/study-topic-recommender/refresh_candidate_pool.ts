#!/usr/bin/env bun
/**
 * refresh_candidate_pool.ts — ADR-070 LLM 후보 발굴 + 검증 + config 자동 반영 entrypoint.
 *
 * CLI:
 *   --help                        이 메시지 출력
 *   --render-only                 기존 runtime JSON에서 markdown만 재생성 (config 수정 없음)
 *   --dry-run                     검증 + 리포트 생성만, config write 없음
 *   --proposals <path|->          LLM proposal JSON 파일 경로 또는 '-' (stdin)
 *   --trigger-kind <kind>         on-demand | cron-health-check | recommendation-needs-refresh
 *   --trigger-reason <text>       trigger 사유
 *   --context <text>              관심사 맥락 요약 (민감 본문 제외, runtime JSON 에만 저장)
 *
 * 출력:
 *   data/runtime/study-topic-candidate-refresh.json
 *   data/runtime/study-topic-candidate-refresh.md
 *   stdout: JSON summary
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { scanFosStudyInventory, type FosStudyInventory } from "./fos_study_inventory.js";
import {
  deterministicDedupe,
  type DuplicateCandidateInput,
} from "./duplicate_detection.js";
import {
  parseProposals,
  type CandidateRefreshDecision,
  type CandidateRefreshInputs,
  type CandidateRefreshProposal,
  type CandidateRefreshReport,
  type CandidateRefreshTrigger,
  type TriggerKind,
} from "./candidate_refresh_schema.js";
import { applyNewCandidates } from "./candidate_refresh_apply.js";

// ── paths ─────────────────────────────────────────────────────────────────────

const TASK_ROOT = join(homedir(), "ai-nodes", "career-os");
const CONFIG = join(TASK_ROOT, "config");
const RUNTIME = join(TASK_ROOT, "data", "runtime");
const FOS_STUDY_ROOT = join(TASK_ROOT, "sources", "fos-study");
const CANDIDATES_CONFIG = join(CONFIG, "study-pack-candidates.json");
const HISTORY_PATH = join(RUNTIME, "topic-inventory-history.jsonl");
const RUNTIME_JSON = join(RUNTIME, "study-topic-candidate-refresh.json");
const RUNTIME_MD = join(RUNTIME, "study-topic-candidate-refresh.md");

// ── helpers ───────────────────────────────────────────────────────────────────

function safeLoad<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

interface HistoryEntry {
  generatedAt?: string;
  keys?: string[];
  [key: string]: unknown;
}

// ── input loader ──────────────────────────────────────────────────────────────

function loadHistoryInputs(): {
  recentHistoryEntries: number;
  dominantRecentDomains: string[];
} {
  if (!existsSync(HISTORY_PATH)) {
    return { recentHistoryEntries: 0, dominantRecentDomains: [] };
  }

  const entries: HistoryEntry[] = [];
  try {
    const lines = readFileSync(HISTORY_PATH, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        entries.push(JSON.parse(trimmed) as HistoryEntry);
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    return { recentHistoryEntries: 0, dominantRecentDomains: [] };
  }

  const recent = entries.slice(-7);
  const domainCounts = new Map<string, number>();
  for (const e of recent) {
    for (const key of e.keys ?? []) {
      const domain = (key as string).split("-")[0] ?? "unknown";
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    }
  }

  const sortedDomains = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([d]) => d);

  return { recentHistoryEntries: recent.length, dominantRecentDomains: sortedDomains };
}

function loadRemainingCandidates(): number {
  const file = safeLoad<{ topics?: Array<Record<string, unknown>> }>(
    CANDIDATES_CONFIG,
    { topics: [] }
  );
  const topics = file.topics ?? [];
  return topics.filter(
    (t) => t.source === "llm-candidate-refresh" && t.status === "active"
  ).length;
}

// ── decision builder ──────────────────────────────────────────────────────────

function buildDecisions(
  proposals: CandidateRefreshProposal[],
  fosStudyPaths: string[]
): CandidateRefreshDecision[] {
  const dedupeInputs: DuplicateCandidateInput[] = proposals.map((p) => ({
    key: p.key,
    candidatePath: p.promotionTarget.outputPath,
  }));

  const dedupeResult = deterministicDedupe(dedupeInputs, fosStudyPaths);

  const exactKeys = new Map(
    dedupeResult.exactPathMatches.map((m) => [m.key, m])
  );
  const normalizedKeys = new Map(
    dedupeResult.normalizedPathMatches.map((m) => [m.key, m])
  );
  const possibleKeys = new Map(
    dedupeResult.possibleDuplicates.map((m) => [m.key, m])
  );

  return proposals.map((p): CandidateRefreshDecision => {
    const candidatePath = p.promotionTarget.outputPath;

    if (exactKeys.has(p.key)) {
      const match = exactKeys.get(p.key)!;
      return {
        key: p.key,
        decision: "update-existing",
        candidatePath,
        matchedPath: match.matchedPath,
        reason: "exact path already exists in fos-study",
      };
    }
    if (normalizedKeys.has(p.key)) {
      const match = normalizedKeys.get(p.key)!;
      return {
        key: p.key,
        decision: "update-existing",
        candidatePath,
        matchedPath: match.matchedPath,
        reason: "normalized path already exists in fos-study",
      };
    }
    if (possibleKeys.has(p.key)) {
      const match = possibleKeys.get(p.key)!;
      return {
        key: p.key,
        decision: "needs-confirmation",
        candidatePath,
        matchedPath: match.matchedPath,
        reason: match.reason,
      };
    }
    return {
      key: p.key,
      decision: "new",
      candidatePath,
      matchedPath: null,
      reason: "no existing fos-study file match",
    };
  });
}

// ── markdown render ───────────────────────────────────────────────────────────

function renderMarkdown(report: CandidateRefreshReport): string {
  const { generatedAt, trigger, inputs, proposals, decisions, applied } = report;

  const newDecisions = decisions.filter((d) => d.decision === "new");
  const updateDecisions = decisions.filter((d) => d.decision === "update-existing");
  const confirmDecisions = decisions.filter((d) => d.decision === "needs-confirmation");
  const skipDecisions = decisions.filter((d) => d.decision === "skip");

  const proposalMap = new Map(proposals.map((p) => [p.key, p]));

  const lines: string[] = [
    `# 학습 후보 Refresh 결과`,
    ``,
    `생성: ${generatedAt}`,
    `트리거: ${trigger.kind} — ${trigger.reason}`,
    ``,
    `## 입력 요약`,
    ``,
    `- fos-study 마크다운: ${inputs.fosStudyMarkdownCount}개`,
    `- 최근 히스토리: ${inputs.recentHistoryEntries}회`,
    `- 현재 active 후보: ${inputs.remainingNewCandidates}개`,
    ...(inputs.dominantRecentDomains.length > 0
      ? [`- 최근 반복 도메인: ${inputs.dominantRecentDomains.join(", ")}`]
      : []),
    ``,
    `## 결정 요약`,
    ``,
    `| 분류 | 수 |`,
    `|---|---|`,
    `| new (config 반영) | ${newDecisions.length} |`,
    `| update-existing | ${updateDecisions.length} |`,
    `| needs-confirmation | ${confirmDecisions.length} |`,
    `| skip | ${skipDecisions.length} |`,
    ``,
  ];

  if (applied.added.length > 0 || applied.updated.length > 0 || applied.staled.length > 0) {
    lines.push(`## config 반영 결과`, ``);
    if (applied.added.length > 0) {
      lines.push(`**추가**: ${applied.added.join(", ")}`);
    }
    if (applied.updated.length > 0) {
      lines.push(`**갱신**: ${applied.updated.join(", ")}`);
    }
    if (applied.staled.length > 0) {
      lines.push(`**stale 처리**: ${applied.staled.join(", ")}`);
    }
    lines.push(``);
  }

  if (newDecisions.length > 0) {
    lines.push(`## 새 후보 (config 반영)`, ``);
    for (const d of newDecisions) {
      const p = proposalMap.get(d.key);
      if (!p) continue;
      lines.push(`### ${p.title}`);
      lines.push(`- key: \`${p.key}\``);
      lines.push(
        `- domain: ${p.domain} / tag: ${p.tag} / 난이도: ${p.difficulty} / 예상: ${p.estMinutes}분`
      );
      if (p.whyNow.length > 0) {
        lines.push(`- 이유: ${p.whyNow[0]}`);
      }
      lines.push(``);
    }
  }

  if (confirmDecisions.length > 0) {
    lines.push(`## 확인 필요 후보`, ``);
    for (const d of confirmDecisions) {
      const p = proposalMap.get(d.key);
      const title = p?.title ?? d.key;
      lines.push(`- **${title}** (\`${d.key}\`) — ${d.reason}`);
      if (d.matchedPath) lines.push(`  - 기존 파일: \`${d.matchedPath}\``);
    }
    lines.push(``);
  }

  if (updateDecisions.length > 0) {
    lines.push(`## 기존 문서 보강 후보 (config 미반영)`, ``);
    for (const d of updateDecisions) {
      const p = proposalMap.get(d.key);
      const title = p?.title ?? d.key;
      lines.push(`- **${title}** (\`${d.key}\`) — ${d.reason}`);
      if (d.matchedPath) lines.push(`  - 기존 파일: \`${d.matchedPath}\``);
    }
    lines.push(``);
  }

  if (skipDecisions.length > 0) {
    lines.push(`## 제외 후보`, ``);
    for (const d of skipDecisions) {
      lines.push(`- \`${d.key}\` — ${d.reason}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}

// ── render-only mode ──────────────────────────────────────────────────────────

function renderOnly(): void {
  mkdirSync(RUNTIME, { recursive: true });
  if (!existsSync(RUNTIME_JSON)) {
    console.error(
      "render-only error: study-topic-candidate-refresh.json 없음 — 먼저 일반 refresh를 실행하세요."
    );
    process.exit(1);
  }

  const report = JSON.parse(
    readFileSync(RUNTIME_JSON, "utf-8")
  ) as CandidateRefreshReport;
  const md = renderMarkdown(report);
  writeFileSync(RUNTIME_MD, md + "\n", "utf-8");

  const newCount = report.decisions.filter((d) => d.decision === "new").length;
  const updateCount = report.decisions.filter((d) => d.decision === "update-existing").length;
  const confirmCount = report.decisions.filter((d) => d.decision === "needs-confirmation").length;

  console.log(
    JSON.stringify(
      {
        mode: "render-only",
        runtimeJson: RUNTIME_JSON,
        runtimeMd: RUNTIME_MD,
        decisions: {
          new: newCount,
          updateExisting: updateCount,
          needsConfirmation: confirmCount,
        },
      },
      null,
      0
    )
  );
}

// ── usage ─────────────────────────────────────────────────────────────────────

function printHelp(): void {
  process.stdout.write(
    [
      "Usage: bun scripts/study-topic-recommender/refresh_candidate_pool.ts [options]",
      "",
      "ADR-070 LLM 후보 refresh entrypoint.",
      "proposals JSON 을 읽어 deterministic 검증 후 new 후보만 config 에 반영한다.",
      "",
      "Options:",
      "  --help                        이 메시지 출력",
      "  --render-only                 기존 runtime JSON 에서 markdown 만 재생성 (config 수정 없음)",
      "  --dry-run                     검증 + 리포트 생성만, config write 없음",
      "  --proposals <path>            LLM proposal JSON 파일 경로 ('-' = stdin)",
      "  --trigger-kind <kind>         on-demand | cron-health-check | recommendation-needs-refresh",
      "                                (기본값: on-demand)",
      "  --trigger-reason <text>       trigger 사유 (기본값: 'manual invocation')",
      "  --context <text>              관심사 맥락 요약 (민감 본문 제외)",
      "",
      "출력:",
      "  data/runtime/study-topic-candidate-refresh.json",
      "  data/runtime/study-topic-candidate-refresh.md",
      "  stdout: JSON summary",
      "",
      "결정 분류:",
      "  new               -> config/study-pack-candidates.json 자동 반영",
      "  update-existing   -> runtime report 에만 (config 미반영)",
      "  needs-confirmation -> runtime report 에만 (config 미반영)",
      "  skip              -> runtime report 에만 (config 미반영)",
      "",
      "Examples:",
      "  bun scripts/study-topic-recommender/refresh_candidate_pool.ts \\",
      "    --proposals /tmp/proposals.json --trigger-reason '새 관심사 등록'",
      "",
      "  echo '[...]' | bun scripts/study-topic-recommender/refresh_candidate_pool.ts \\",
      "    --proposals - --dry-run",
      "",
      "  bun scripts/study-topic-recommender/refresh_candidate_pool.ts --render-only",
      "",
    ].join("\n")
  );
}

// ── arg parsing ───────────────────────────────────────────────────────────────

interface ParsedArgs {
  help: boolean;
  renderOnly: boolean;
  dryRun: boolean;
  proposalsPath: string | null;
  triggerKind: TriggerKind;
  triggerReason: string;
  context: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = {
    help: false,
    renderOnly: false,
    dryRun: false,
    proposalsPath: null,
    triggerKind: "on-demand",
    triggerReason: "manual invocation",
    context: "",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--render-only") {
      result.renderOnly = true;
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--proposals") {
      result.proposalsPath = args[++i] ?? null;
    } else if (arg === "--trigger-kind") {
      const val = args[++i];
      if (
        val === "on-demand" ||
        val === "cron-health-check" ||
        val === "recommendation-needs-refresh"
      ) {
        result.triggerKind = val;
      }
    } else if (arg === "--trigger-reason") {
      result.triggerReason = args[++i] ?? result.triggerReason;
    } else if (arg === "--context") {
      result.context = args[++i] ?? "";
    }
  }

  return result;
}

// ── main ──────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    printHelp();
    return;
  }

  if (opts.renderOnly) {
    renderOnly();
    return;
  }

  // cron 하루 1회 제한 (ADR-070 D10): cron-health-check trigger는 오늘 이미 실행됐으면 skip
  if (opts.triggerKind === "cron-health-check" && !opts.dryRun) {
    if (existsSync(RUNTIME_JSON)) {
      const existing = safeLoad<{ generatedAt?: string }>(RUNTIME_JSON, {});
      if (existing.generatedAt) {
        const existingDate = existing.generatedAt.slice(0, 10); // YYYY-MM-DD
        const todayDate = new Date().toISOString().slice(0, 10);
        if (existingDate === todayDate) {
          console.log(
            JSON.stringify({
              skipped: true,
              reason: "cron daily limit: already ran today",
              lastRun: existing.generatedAt,
            })
          );
          return;
        }
      }
    }
  }

  if (!opts.proposalsPath) {
    process.stderr.write(
      "오류: --proposals <path> 또는 --render-only 가 필요합니다.\n--help 로 사용법을 확인하세요.\n"
    );
    process.exit(1);
  }

  mkdirSync(RUNTIME, { recursive: true });

  // 1. single fos-study scan
  const fosInventory: FosStudyInventory = scanFosStudyInventory({ root: FOS_STUDY_ROOT });

  // 2. load supporting inputs
  const { recentHistoryEntries, dominantRecentDomains } = loadHistoryInputs();
  const remainingNewCandidates = loadRemainingCandidates();

  const inputs: CandidateRefreshInputs = {
    fosStudyMarkdownCount: fosInventory.scannedMarkdownCount,
    recentHistoryEntries,
    remainingNewCandidates,
    dominantRecentDomains,
  };

  // 3. read proposals JSON
  let rawProposalsText: string;
  if (opts.proposalsPath === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    rawProposalsText = Buffer.concat(chunks).toString("utf-8");
  } else {
    if (!existsSync(opts.proposalsPath)) {
      process.stderr.write(`오류: proposals 파일 없음 — ${opts.proposalsPath}\n`);
      process.exit(1);
    }
    rawProposalsText = readFileSync(opts.proposalsPath, "utf-8");
  }

  let rawProposals: unknown;
  try {
    rawProposals = JSON.parse(rawProposalsText);
  } catch (e) {
    process.stderr.write(`오류: proposals JSON 파싱 실패 — ${(e as Error).message}\n`);
    process.exit(1);
  }

  // 4. validate proposals
  const { valid: proposals, invalid } = parseProposals(rawProposals);
  if (invalid.length > 0) {
    process.stderr.write(
      `경고: ${invalid.length}개 proposal 검증 실패\n`
    );
    for (const err of invalid) {
      process.stderr.write(`  [${err.index}] ${err.errors.join("; ")}\n`);
    }
  }

  // 5. deterministic decision
  const decisions = buildDecisions(proposals, fosInventory.markdownPathsRelative);

  // 6. build trigger
  const trigger: CandidateRefreshTrigger = {
    kind: opts.triggerKind,
    reason: opts.triggerReason,
    sourceMessage: opts.context || null,
  };

  const generatedAt = new Date().toISOString();

  // 7. apply new candidates (skip on --dry-run)
  const applied = opts.dryRun
    ? { configPath: CANDIDATES_CONFIG, added: [], updated: [], staled: [] }
    : applyNewCandidates(CANDIDATES_CONFIG, proposals, decisions, generatedAt);

  // 8. write runtime report
  const report: CandidateRefreshReport = {
    generatedAt,
    trigger,
    inputs,
    proposals,
    decisions,
    applied,
  };

  writeFileSync(RUNTIME_JSON, JSON.stringify(report, null, 2) + "\n", "utf-8");

  const md = renderMarkdown(report);
  writeFileSync(RUNTIME_MD, md + "\n", "utf-8");

  // 9. stdout summary
  const newCount = decisions.filter((d) => d.decision === "new").length;
  const updateCount = decisions.filter((d) => d.decision === "update-existing").length;
  const confirmCount = decisions.filter((d) => d.decision === "needs-confirmation").length;
  const skipCount = decisions.filter((d) => d.decision === "skip").length;

  console.log(
    JSON.stringify(
      {
        generatedAt,
        runtimeJson: RUNTIME_JSON,
        runtimeMd: RUNTIME_MD,
        dryRun: opts.dryRun,
        proposals: proposals.length,
        invalid: invalid.length,
        decisions: {
          new: newCount,
          updateExisting: updateCount,
          needsConfirmation: confirmCount,
          skip: skipCount,
        },
        applied: {
          added: applied.added.length,
          updated: applied.updated.length,
          staled: applied.staled.length,
        },
      },
      null,
      0
    )
  );
}

if (import.meta.main) {
  main().catch((err) => {
    process.stderr.write(`refresh_candidate_pool error: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
