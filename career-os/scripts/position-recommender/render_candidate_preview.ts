#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { firstOptionValue } from "../lib/cli.ts";
import type { RecommendationRunType } from "./recommendation_schema.ts";
import { validateRecommendationFiles } from "./validate_recommendation.ts";
import { renderCandidatePreview, type CandidatePreviewOptions } from "./candidate_preview_html.ts";
import { loadRenderAssets } from "./render_assets.ts";
import { formatSeoulDisplayTime } from "../lib/date-format.ts";

export type { CandidatePreviewOptions } from "./candidate_preview_html.ts";

export function renderCandidatePreviewHtml(
  run: RecommendationRunType,
  options: CandidatePreviewOptions = {},
): string {
  return renderCandidatePreview(
    run,
    options,
    loadRenderAssets("preview"),
    formatSeoulDisplayTime(options.candidatePool?.collectedAt ?? run.generatedAt),
  );
}

export function writeCandidatePreview(
  input: string,
  candidates: string,
  output: string,
  limitValue?: string,
): { passed: true; outputPath: string } | { passed: false; errors: string[] } {
  const result = validateRecommendationFiles(input, candidates);
  if (!result.passed) return result;
  const limit = limitValue === "all" ? null : limitValue ? Number(limitValue) : 10;
  const outputPath = resolve(output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    renderCandidatePreviewHtml(result.run, { candidatePool: result.pool, limit }),
    "utf8",
  );
  return { passed: true, outputPath };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const input = firstOptionValue(args, "--input");
  const output = firstOptionValue(args, "--output");
  const candidates = firstOptionValue(args, "--candidates");
  if (!input || !output || !candidates) {
    console.error(
      "사용법: render_candidate_preview.ts --input <recommendation.json> --candidates <posting-candidates.json> --output <report.html> [--limit all|N]",
    );
    process.exit(2);
  }
  const result = writeCandidatePreview(
    input,
    candidates,
    output,
    firstOptionValue(args, "--limit"),
  );
  if (!result.passed) {
    result.errors.forEach((error) => console.error(error));
    process.exit(1);
  }
  console.log(`포지션 추천 HTML: ${result.outputPath}`);
}
