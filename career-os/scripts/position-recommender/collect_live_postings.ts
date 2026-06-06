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
 *   bun collect_live_postings.ts --output <output-md> [--max-wanted N] [--source all|wanted|toss]
 */

import { resolve } from "path";
import type { Posting, CollectionDiagnostics, CliArgs } from "./live-postings/types.ts";
import { dedupe, keepActiveDirectPostings } from "./live-postings/validator.ts";
import { render } from "./live-postings/render.ts";
import { selectAdapters } from "./live-postings/adapters/index.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

// ---- CLI ----------------------------------------------------------------

function parseArgs(argv: string[]): CliArgs {
  let out = resolve(REPO_ROOT, "career-os/data/runtime/live-position-postings.md");
  let source: "all" | "wanted" | "toss" = "all";
  let serverOnly = true;
  let wantedLimit = 120;
  let includeTossArticles = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === "--out" || arg === "--output") && argv[i + 1]) {
      out = argv[++i];
    } else if (arg === "--source" && argv[i + 1]) {
      const s = argv[++i];
      if (s === "wanted" || s === "toss" || s === "all") source = s;
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

async function main(): Promise<number> {
  const { out, source, serverOnly, wantedLimit, includeTossArticles } = parseArgs(process.argv.slice(2));
  const collected: Posting[] = [];
  const errors: string[] = [];

  for (const adapter of selectAdapters(source, includeTossArticles)) {
    try {
      collected.push(...(await adapter.collect({ serverOnly, wantedLimit })));
      if (adapter.note) errors.push(adapter.note);
    } catch (e) {
      errors.push(`${adapter.name}: ${e}`);
    }
  }

  const activePosts = keepActiveDirectPostings(dedupe(collected));
  render(activePosts, out, {
    requestedSource: source,
    serverOnly,
    wantedLimit,
    includeTossArticles,
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
