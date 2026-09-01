#!/usr/bin/env bun
/**
 * 포지션 추천에 사용할 공개 채용공고를 수집한다.
 *
 * Structure:
 * - Source adapters: per-source fetch + source-specific active checks (Wanted, Toss).
 * - Common active validator: enforces the active-snapshot invariant across all sources.
 * - Renderer: sorts and writes the markdown snapshot.
 *
 * Sources:
 * - Wanted public navigation/jobs API + detail API status check.
 * - Toss careers: the career article feed is used only to DISCOVER job-detail CTA
 *   URLs (https://toss.im/career/job-detail?job_id=...). Each job-detail page is
 *   fetched and parsed, and only individual postings with verified JD content +
 *   apply evidence are kept. Career articles themselves are never rendered.
 *
 * 결과는 Zod로 검증한 JSON 후보풀 하나로 저장한다.
 *
 * Usage:
 *   bun collect_live_postings.ts --output <output-json>
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  AdapterCollectionResult,
  CollectionDiagnostics,
  Posting,
  CliArgs,
  SourceDiagnostic,
  SourceSelection,
} from "./live-postings/types.ts";
import {
  createPostingEligibilityPolicy,
  dedupe,
  filterEligiblePostings,
} from "./live-postings/validator.ts";
import { configuredSourceIds, selectAdapters } from "./live-postings/adapters/index.ts";
import { buildPostingCandidatePool } from "./live-postings/candidate_pool.ts";

// ---- CLI ----------------------------------------------------------------

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export function parseArgs(argv: string[]): CliArgs {
  let jsonOut: string | undefined;
  let source: SourceSelection = "all";
  let targetRoleOnly = true;
  let wantedLimit = 120;
  let includeTossArticles = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === "--out" || arg === "--output" || arg === "--json-output") && argv[i + 1]) {
      jsonOut = argv[++i];
    } else if (arg === "--source" && argv[i + 1]) {
      const s = argv[++i];
      if (
        s === "wanted" ||
        s === "toss" ||
        s === "toss-careers" ||
        s === "coupang" ||
        s === "coupang-careers" ||
        s === "kakaobank" ||
        s === "kakaobank-careers" ||
        s === "kurly" ||
        s === "kurly-careers" ||
        s === "krafton" ||
        s === "krafton-careers" ||
        s === "kakaopay" ||
        s === "kakaopay-securities" ||
        s === "kakaomobility" ||
        s === "naver-careers" ||
        s === "samsung" ||
        s === "samsung-careers" ||
        s === "sk" ||
        s === "sk-careers" ||
        s === "cj" ||
        s === "cj-careers" ||
        s === "all"
      ) source = s;
    } else if (arg === "--max-wanted" && argv[i + 1]) {
      wantedLimit = parseInt(argv[++i], 10);
    } else if (arg === "--all-development-roles" || arg === "--no-server-only") {
      targetRoleOnly = false;
    } else if (arg === "--include-toss-articles") {
      includeTossArticles = true;
    }
  }
  if (!jsonOut) {
    throw new CliUsageError("--output <output-json> is required");
  }
  return { jsonOut, source, targetRoleOnly, wantedLimit, includeTossArticles };
}

function isAdapterCollectionResult(value: Posting[] | AdapterCollectionResult): value is AdapterCollectionResult {
  return !Array.isArray(value);
}

function importedCountsBySource(posts: Posting[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const post of posts) counts.set(post.source, (counts.get(post.source) ?? 0) + 1);
  return counts;
}

async function main(): Promise<number> {
  const { jsonOut, source, targetRoleOnly, wantedLimit, includeTossArticles } = parseArgs(process.argv.slice(2));
  const collected: Posting[] = [];
  const errors: string[] = [];
  const sourceDiagnostics: SourceDiagnostic[] = [];

  for (const adapter of selectAdapters(source, includeTossArticles)) {
    try {
      const result = await adapter.collect({ targetRoleOnly, wantedLimit });
      if (isAdapterCollectionResult(result)) {
        collected.push(...result.postings);
        sourceDiagnostics.push({ ...result.diagnostics, importedCount: 0 });
        errors.push(...(result.errors ?? []));
      } else {
        collected.push(...result);
        sourceDiagnostics.push({
          source: adapter.id,
          status: "ok",
          collectedCount: result.length,
          importedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          discoveryModes: [],
          message: adapter.note ?? `${adapter.name}: collected=${result.length}`,
        });
      }
      if (adapter.note) errors.push(adapter.note);
    } catch (e) {
      const message = `${adapter.name}: ${e}`;
      errors.push(message);
      sourceDiagnostics.push({
        source: adapter.id,
        status: "failed",
        collectedCount: 0,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 1,
        discoveryModes: [],
        message,
      });
    }
  }

  const eligibility = filterEligiblePostings(
    dedupe(collected),
    new Date(),
    createPostingEligibilityPolicy({ targetRoleOnly }),
  );
  const activePosts = eligibility.eligible;
  const importedCounts = importedCountsBySource(activePosts);
  const normalizedDiagnostics = sourceDiagnostics.map((diagnostic) => ({
    ...diagnostic,
    importedCount: importedCounts.get(diagnostic.source) ?? 0,
    skippedCount: diagnostic.skippedCount + (eligibility.rejectedBySource.get(diagnostic.source) ?? 0),
  }));
  const collectedAt = new Date().toISOString();
  const diagnostics = {
    collectionRunId: `position-postings-${collectedAt}`,
    collectedAt,
    requestedSource: source,
    configuredSources: configuredSourceIds(source),
    wantedLimit,
    includeTossArticles,
    sourceDiagnostics: normalizedDiagnostics,
    errors: [
      ...errors,
      ...Object.entries(eligibility.rejectedCounts).map(([reason, count]) => `lifecycle:${reason}=${count}`),
    ],
  } satisfies CollectionDiagnostics;
  const { pool, validationErrors } = buildPostingCandidatePool(activePosts, diagnostics);
  mkdirSync(dirname(resolve(jsonOut)), { recursive: true });
  writeFileSync(resolve(jsonOut), `${JSON.stringify(pool, null, 2)}\n`, "utf8");
  console.log(`posting candidate pool: ${resolve(jsonOut)} (${pool.candidates.length}건)`);
  if (validationErrors.length > 0) {
    console.error(`WARN posting schema errors: ${validationErrors.join("; ")}`);
  }
  if (errors.length > 0) {
    console.error(`WARN source errors: ${errors.join("; ")}`);
  }
  return 0;
}

if (import.meta.main) {
  main().then(process.exit).catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(e instanceof CliUsageError ? 2 : 1);
  });
}
