#!/usr/bin/env bun
/**
 * record_metrics.ts — position-recommender 지표 기록 helper (ADR-099 phase-03)
 *
 * Usage:
 *   bun record_metrics.ts --snapshot <live-postings.md> [--recommendation <recommendation.json>] [--output logs/position-metrics.jsonl]
 *
 * Collection 지표는 snapshot diagnostics에서 파싱한다.
 * Recommendation 지표는 --recommendation 인자가 있을 때만 계산한다.
 * 한 줄 JSON을 --output 파일에 append한다.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const DEFAULT_OUTPUT = resolve(REPO_ROOT, "career-os/logs/position-metrics.jsonl");
const TARGETS_CONFIG = resolve(REPO_ROOT, "career-os/config/verified-company-research-targets.json");

// 14개 content 라벨 — structural 필드(rank, postingUrl, exploreLink) 제외
const CONTENT_LABELS_14 = [
  "company",
  "title",
  "linkEvidenceLevel",
  "postingPeriod",
  "searchKeywords",
  "whyFit",
  "candidateEvidence",
  "jdKeywords",
  "companyUpside",
  "welfareLearning",
  "techBlogSignal",
  "businessRisk",
  "ambiguity",
  "prepAction",
] as const;

// ---- CLI ----------------------------------------------------------------

interface CliArgs {
  snapshotPath: string;
  recommendationPath: string | null;
  outputPath: string;
}

function parseArgs(argv: string[]): CliArgs {
  let snapshotPath: string | null = null;
  let recommendationPath: string | null = null;
  let outputPath = DEFAULT_OUTPUT;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === "--snapshot" || arg === "--snap") && argv[i + 1]) {
      snapshotPath = resolve(argv[++i]);
    } else if ((arg === "--recommendation" || arg === "--rec") && argv[i + 1]) {
      recommendationPath = resolve(argv[++i]);
    } else if ((arg === "--output" || arg === "--out") && argv[i + 1]) {
      outputPath = resolve(argv[++i]);
    }
  }

  if (!snapshotPath) {
    console.error("PHASE_FAILED: --snapshot <live-postings.md> 인자가 필요합니다.");
    process.exit(1);
  }
  if (!existsSync(snapshotPath)) {
    console.error(`PHASE_FAILED: snapshot 파일이 없습니다: ${snapshotPath}`);
    process.exit(1);
  }

  return { snapshotPath, recommendationPath, outputPath };
}

// ---- Collection diagnostics 파싱 ----------------------------------------

interface SourceCountMap {
  [source: string]: number;
}

interface CollectionMetrics {
  activeDirectPostings: number;
  sourceCounts: SourceCountMap;
  rejectCounts: SourceCountMap;
  adapterCoverage: number;
}

function parseSourceCounts(line: string): SourceCountMap {
  // "- source_counts: wanted=12, toss-careers=5, kakaopay=3"
  const result: SourceCountMap = {};
  const match = line.match(/source_counts:\s*(.+)/);
  if (!match || match[1].trim() === "-") return result;
  for (const part of match[1].split(",")) {
    const [key, val] = part.trim().split("=");
    if (key && val) result[key.trim()] = parseInt(val.trim(), 10) || 0;
  }
  return result;
}

function parseSourceDiagnostics(line: string): SourceCountMap {
  // "- source_diagnostics: kakaopay:ok collected=5 imported=3 skipped=2 failed=0 reason=... | toss-careers:..."
  // skipped=N + failed=N per source → rejectCounts
  const result: SourceCountMap = {};
  const match = line.match(/source_diagnostics:\s*(.+)/);
  if (!match || match[1].trim() === "-") return result;

  for (const entry of match[1].split("|")) {
    const sourceMatch = entry.match(/^(\S+?):/);
    if (!sourceMatch) continue;
    const source = sourceMatch[1].trim();

    const skippedMatch = entry.match(/skipped=(\d+)/);
    const failedMatch = entry.match(/failed=(\d+)/);
    const skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
    const total = skipped + failed;
    if (total > 0) result[source] = total;
  }
  return result;
}

function parseAdapterCoverage(): number {
  if (!existsSync(TARGETS_CONFIG)) return 0;
  try {
    const raw = JSON.parse(readFileSync(TARGETS_CONFIG, "utf-8"));
    const companies: Array<{ hasAdapter?: boolean }> = raw.priorityCompanies ?? [];
    if (companies.length === 0) return 0;
    const withAdapter = companies.filter((c) => c.hasAdapter === true).length;
    return Math.round((withAdapter / companies.length) * 100) / 100;
  } catch {
    return 0;
  }
}

function parseCollectionMetrics(snapshotPath: string): CollectionMetrics {
  const content = readFileSync(snapshotPath, "utf-8");
  const lines = content.split("\n");

  let activeDirectPostings = 0;
  let sourceCounts: SourceCountMap = {};
  let rejectCounts: SourceCountMap = {};

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("- direct_active_or_open_postings:")) {
      const match = trimmed.match(/direct_active_or_open_postings:\s*(\d+)/);
      if (match) activeDirectPostings = parseInt(match[1], 10);
    } else if (trimmed.startsWith("- source_counts:")) {
      sourceCounts = parseSourceCounts(trimmed.slice(2));
    } else if (trimmed.startsWith("- source_diagnostics:")) {
      rejectCounts = parseSourceDiagnostics(trimmed.slice(2));
    }
  }

  const adapterCoverage = parseAdapterCoverage();

  return { activeDirectPostings, sourceCounts, rejectCounts, adapterCoverage };
}

// ---- Recommendation 지표 파싱 -------------------------------------------

interface TierDist {
  strong: number;
  stretch: number;
  hold: number;
}

interface RecommendationMetrics {
  strongActive: number;
  newRatio: null;
  tierDist: TierDist;
  labelCompleteness: number;
}

function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0 && value.trim() !== "-";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function computeLabelCompleteness(items: unknown[]): number {
  if (items.length === 0) return 1;
  let filled = 0;
  let total = 0;
  for (const item of items) {
    for (const label of CONTENT_LABELS_14) {
      total++;
      const val = (item as Record<string, unknown>)[label];
      if (isNonEmpty(val)) filled++;
    }
  }
  return total > 0 ? Math.round((filled / total) * 100) / 100 : 1;
}

function parseRecommendationMetrics(recPath: string): RecommendationMetrics {
  const raw = JSON.parse(readFileSync(recPath, "utf-8"));
  const tiers = raw.tiers ?? {};
  const strong: unknown[] = tiers.strong ?? [];
  const stretch: unknown[] = tiers.stretch ?? [];
  const hold: unknown[] = tiers.hold ?? [];

  const tierDist: TierDist = {
    strong: strong.length,
    stretch: stretch.length,
    hold: hold.length,
  };

  const totalRecommended = strong.length + stretch.length + hold.length;
  const strongActive =
    totalRecommended > 0
      ? Math.round((strong.length / totalRecommended) * 100) / 100
      : 0;

  const labelCompleteness = computeLabelCompleteness([...strong, ...stretch]);

  return { strongActive, newRatio: null, tierDist, labelCompleteness };
}

// ---- 날짜 (Asia/Seoul) --------------------------------------------------

function todaySeoul(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

// ---- 메인 --------------------------------------------------------------

interface MetricsRecord {
  date: string;
  collection: CollectionMetrics;
  recommendation: RecommendationMetrics | null;
}

async function main(): Promise<void> {
  const { snapshotPath, recommendationPath, outputPath } = parseArgs(process.argv.slice(2));

  const collection = parseCollectionMetrics(snapshotPath);

  let recommendation: RecommendationMetrics | null = null;
  if (recommendationPath) {
    if (!existsSync(recommendationPath)) {
      console.error(`PHASE_FAILED: recommendation 파일이 없습니다: ${recommendationPath}`);
      process.exit(1);
    }
    try {
      recommendation = parseRecommendationMetrics(recommendationPath);
    } catch (e) {
      console.error(`PHASE_FAILED: recommendation JSON 파싱 실패 — ${e}`);
      process.exit(1);
    }
  }

  const record: MetricsRecord = {
    date: todaySeoul(),
    collection,
    recommendation,
  };

  const line = JSON.stringify(record) + "\n";

  mkdirSync(dirname(outputPath), { recursive: true });
  appendFileSync(outputPath, line, "utf-8");

  console.log(`지표 기록 완료: ${outputPath}`);
  console.log(JSON.stringify(record, null, 2));
}

main().catch((e) => {
  console.error(`PHASE_FAILED: ${e}`);
  process.exit(1);
});
