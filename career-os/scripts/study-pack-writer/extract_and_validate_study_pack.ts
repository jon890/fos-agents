#!/usr/bin/env bun
// extract_and_validate_study_pack.ts — Claude JSON → validated study-pack markdown
// Usage: extract_and_validate_study_pack.ts <raw-json> <output-md>
// ADR-022 TS 마이그레이션
import { readFileSync, writeFileSync } from "fs";

const BAD_PREFIXES = [
  "The hook warning",
  "The file is at",
  "파일이 생성되었다",
  "문서 구성",
  "문서 구성 요약",
  "다음과 같다",
  "아래와 같다",
  "`database/",
];
const MIN_LINES = 80;

function stripToMarkdownBody(rawText: string): string {
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

function escapeTildeRanges(content: string): string {
  const out: string[] = [];
  let inFence = false;
  let inlineCode = false;

  for (const line of content.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    const chars: string[] = [];
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "`") {
        inlineCode = !inlineCode;
        chars.push(ch);
      } else if (ch === "~" && !inlineCode) {
        const prevCh = i > 0 ? line[i - 1] : "";
        chars.push(prevCh === "\\" ? ch : "\\~");
      } else {
        chars.push(ch);
      }
    }
    out.push(chars.join(""));
  }
  return out.join("\n");
}

function validateCodeFenceLanguages(content: string): void {
  let inFence = false;
  const lines = content.split("\n");
  for (let lineNo = 1; lineNo <= lines.length; lineNo++) {
    const stripped = lines[lineNo - 1].trimStart();
    if (!stripped.startsWith("```")) continue;
    if (!inFence) {
      const language = stripped.slice(3).trim();
      if (!language) {
        process.stderr.write(
          `study-pack validation failed: code fence opened without language tag at line ${lineNo}\n`
        );
        process.exit(1);
      }
      inFence = true;
    } else {
      inFence = false;
    }
  }
}

function validate(content: string): void {
  if (!content) {
    process.stderr.write("study-pack validation failed: generated file is empty\n");
    process.exit(1);
  }
  if (!content.startsWith("#")) {
    process.stderr.write(
      "study-pack validation failed: generated file does not start with markdown heading\n"
    );
    process.exit(1);
  }
  if (BAD_PREFIXES.some((prefix) => content.startsWith(prefix))) {
    process.stderr.write(
      "study-pack validation failed: generated file looks like a summary report, not the full document\n"
    );
    process.exit(1);
  }
  if (content.split("\n").length < MIN_LINES) {
    process.stderr.write(
      "study-pack validation failed: generated file is too short, likely not a full study pack\n"
    );
    process.exit(1);
  }
  validateCodeFenceLanguages(content);
}

const [, , src, out] = process.argv;

if (!src || !out) {
  process.stderr.write(
    "usage: extract_and_validate_study_pack.ts <raw-json> <output-md>\n"
  );
  process.exit(1);
}

const raw = readFileSync(src, "utf-8").trim();
if (!raw) {
  process.stderr.write("study-pack validation failed: claude JSON output is empty\n");
  process.exit(1);
}

const payload = JSON.parse(raw);
const text: string = payload.result ?? "";
let content = stripToMarkdownBody(text);
validate(content);
content = escapeTildeRanges(content);

writeFileSync(out, content.trimEnd() + "\n", "utf-8");
console.log(`Wrote study pack: ${out}`);
