#!/usr/bin/env bun
// extract_position_report.ts — Claude JSON → position recommendation markdown
// Usage: extract_position_report.ts <raw-json> <output-md>
// ADR-022 TS 마이그레이션
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

function stripToMarkdown(rawText: string): string {
  let content = rawText.trim();
  content = content.replace(/\n```\s*$/, "");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("#")) {
      return lines.slice(i).join("\n").trim();
    }
  }
  return content;
}

const [, , rawPath, outPath] = process.argv;

if (!rawPath || !outPath) {
  process.stderr.write(
    "usage: extract_position_report.ts <raw-json> <output-md>\n"
  );
  process.exit(1);
}

const payload = JSON.parse(readFileSync(rawPath, "utf-8"));
const content = stripToMarkdown(payload.result ?? "");

if (!content.startsWith("#")) {
  process.stderr.write(
    "position report validation failed: output does not start with #\n"
  );
  process.exit(1);
}
if (content.split("\n").filter((l) => l.trim()).length < 30) {
  process.stderr.write("position report validation failed: output is too short\n");
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, content.trimEnd() + "\n", "utf-8");
console.log(`Wrote position recommendation: ${outPath}`);
