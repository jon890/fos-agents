#!/usr/bin/env bun
/**
 * Collect lightweight public job postings for position recommendation.
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
 * Output: markdown summary for Claude position recommender.
 *
 * Usage:
 *   bun collect_live_postings.ts --output <output-md> [--max-wanted N] [--source all|wanted|toss|coupang]
 */

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
import { dedupe, keepActiveDirectPostings } from "./live-postings/validator.ts";
import { render } from "./live-postings/render.ts";
import { configuredSourceIds, selectAdapters } from "./live-postings/adapters/index.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// ---- CLI ----------------------------------------------------------------

function parseArgs(argv: string[]): CliArgs {
  let out = resolve(REPO_ROOT, "career-os/data/runtime/live-position-postings.md");
  let source: SourceSelection = "all";
  let serverOnly = true;
  let wantedLimit = 120;
  let includeTossArticles = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === "--out" || arg === "--output") && argv[i + 1]) {
      out = argv[++i];
    } else if (arg === "--source" && argv[i + 1]) {
      const s = argv[++i];
      if (
        s === "wanted" ||
        s === "toss" ||
        s === "toss-careers" ||
        s === "coupang" ||
        s === "coupang-careers" ||
        s === "kakaopay" ||
        s === "kakaopay-securities" ||
        s === "kakaomobility" ||
        s === "naver-careers" ||
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
  return { out, source, serverOnly, wantedLimit, includeTossArticles };
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
  const { out, source, serverOnly, wantedLimit, includeTossArticles } = parseArgs(process.argv.slice(2));
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

  const activePosts = keepActiveDirectPostings(dedupe(collected));
  const importedCounts = importedCountsBySource(activePosts);
  const normalizedDiagnostics = sourceDiagnostics.map((diagnostic) => ({
    ...diagnostic,
    importedCount: importedCounts.get(diagnostic.source) ?? 0,
  }));
  render(activePosts, out, {
    requestedSource: source,
    configuredSources: configuredSourceIds(source),
    serverOnly,
    wantedLimit,
    includeTossArticles,
    sourceDiagnostics: normalizedDiagnostics,
    errors,
  } satisfies CollectionDiagnostics);
  if (errors.length > 0) {
    console.error(`WARN source errors: ${errors.join("; ")}`);
  }
  return 0;
}

main().then(process.exit).catch((e) => {
  console.error(e);
  process.exit(1);
});
