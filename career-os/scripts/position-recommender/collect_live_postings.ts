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

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
import { setExcludedCompanies } from "./live-postings/policy.ts";
import { buildPostingCandidatePool } from "./live-postings/candidate_pool.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * 선호제외 회사 목록을 config에서 읽어 수집 필터에 주입한다.
 * 제외 회사는 config/position-filters.json의 excludedCompanies에서 읽는다.
 * config를 못 읽으면 회사 제외 없이 진행한다(수집 자체를 막지 않는다).
 */
function loadPositionFilters(): ReadonlySet<string> {
  try {
    const path = resolve(REPO_ROOT, "career-os/config/position-filters.json");
    const config = JSON.parse(readFileSync(path, "utf8"));
    const companies: string[] = config?.excludedCompanies ?? [];
    setExcludedCompanies(companies);
    const suppressedUrls = (config?.suppressedPostings ?? [])
      .map((posting: { url?: unknown }) => posting.url)
      .filter((url: unknown): url is string => typeof url === "string" && url.length > 0);
    return new Set(suppressedUrls);
  } catch (e) {
    console.error(`WARN position-filters config load failed, proceeding without company exclusion: ${e}`);
    return new Set();
  }
}

// ---- CLI ----------------------------------------------------------------

export function parseArgs(argv: string[]): CliArgs {
  let jsonOut = resolve(REPO_ROOT, "career-os/state/posting-candidates.json");
  let source: SourceSelection = "all";
  let serverOnly = true;
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
    } else if (arg === "--no-server-only") {
      serverOnly = false;
    } else if (arg === "--include-toss-articles") {
      includeTossArticles = true;
    }
  }
  return { jsonOut, source, serverOnly, wantedLimit, includeTossArticles };
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
  const { jsonOut, source, serverOnly, wantedLimit, includeTossArticles } = parseArgs(process.argv.slice(2));
  const suppressedUrls = loadPositionFilters();
  const collected: Posting[] = [];
  const errors: string[] = [];
  const sourceDiagnostics: SourceDiagnostic[] = [];

  for (const adapter of selectAdapters(source, includeTossArticles)) {
    try {
      const result = await adapter.collect({ serverOnly, wantedLimit });
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
    createPostingEligibilityPolicy({ suppressedUrls, serverOnly }),
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
    serverOnly,
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
    console.error(e);
    process.exit(1);
  });
}
