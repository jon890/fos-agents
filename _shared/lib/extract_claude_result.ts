#!/usr/bin/env bun
// extract_claude_result.ts — Claude --output-format json → markdown extractor
// Usage: extract_claude_result.ts <claude_json> <output_md> [usage_json]
// ADR-022 TS 마이그레이션
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { ClaudeUsage } from "../types/index.ts";

const [, , src, out, usageOut] = process.argv;

if (!src || !out) {
  process.stderr.write(
    "usage: extract_claude_result.ts <claude_json> <output_md> [usage_json]\n"
  );
  process.exit(2);
}

const data: ClaudeUsage = JSON.parse(readFileSync(src, "utf-8"));
const result = data.result;

if (typeof result !== "string" || !result.trim()) {
  process.stderr.write(
    `Claude result JSON has no non-empty string 'result': ${src}\n`
  );
  process.exit(1);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, result.trimEnd() + "\n", "utf-8");

if (usageOut) {
  mkdirSync(dirname(usageOut), { recursive: true });
  writeFileSync(usageOut, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
