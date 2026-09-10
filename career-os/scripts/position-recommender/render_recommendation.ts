#!/usr/bin/env bun
import { formatSeoulDateTime } from "../lib/date-format.ts";
// 검증된 추천 JSON에서 독립 HTML 파일을 만든다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RecommendationRun, type RecommendationRunType } from "./recommendation_schema.ts";

import { loadRenderAssets } from "./render_assets.ts";
import { renderRecommendationHtml, renderReportContent } from "./recommendation_html.ts";

const DEFAULT_TEMPLATE = resolve(dirname(fileURLToPath(import.meta.url)), "templates/report.html");

export function toReportHtml(run: RecommendationRunType): string {
  return renderReportContent(run, loadRenderAssets("report"));
}

export function toHtml(run: RecommendationRunType, templatePath: string): string {
  const assets = loadRenderAssets("report");
  assets.templates.report = readFileSync(templatePath, "utf8");
  return renderRecommendationHtml(run, assets, formatSeoulDateTime(new Date()));
}

function usage(): never {
  console.error(
    "usage: render_recommendation.ts --input <recommendation.json> --format <html> --output <path> [--template <template.html>]",
  );
  process.exit(2);
}

export type RecommendationRenderResult =
  | { status: "written"; outputPath: string }
  | { status: "invalid"; errors: string[] }
  | { status: "unsupported-format" };

export function writeRecommendation(
  input: string,
  output: string,
  format: string,
  template = DEFAULT_TEMPLATE,
): RecommendationRenderResult {
  const raw = JSON.parse(readFileSync(resolve(input), "utf-8"));
  const parsed = RecommendationRun.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "invalid",
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }
  let content: string;
  if (format === "html") content = toHtml(parsed.data, resolve(template));
  else return { status: "unsupported-format" };

  const outputPath = resolve(output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content, "utf-8");
  return { status: "written", outputPath };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let input = "";
  let output = "";
  let format = "";
  let template = DEFAULT_TEMPLATE;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input") input = args[++i] ?? "";
    else if (args[i] === "--output") output = args[++i] ?? "";
    else if (args[i] === "--format") format = args[++i] ?? "";
    else if (args[i] === "--template") template = args[++i] ?? "";
  }
  if (!input || !output || !format) usage();

  const result = writeRecommendation(input, output, format, template);
  if (result.status === "invalid") {
    console.error("recommendation.json schema 검증 실패:");
    result.errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }
  if (result.status === "unsupported-format") usage();
  console.log(`recommendation ${format}: ${result.outputPath}`);
}
