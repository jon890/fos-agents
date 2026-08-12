#!/usr/bin/env bun
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { morningReadingReportSchema } from "./reading_contracts.js";
import { morningHtmlFilename } from "./render/html.js";

const ROOT = process.env.CAREER_OS_ROOT
  ? resolve(process.env.CAREER_OS_ROOT)
  : resolve(import.meta.dir, "..", "..");
const reportPath = resolve(ROOT, "state", "morning-reading.json");
const markdownPath = resolve(ROOT, "reports", "morning-reading.md");
const forbiddenHtmlPatterns = [
  /\/Users\//,
  /\/home\//,
  /\/opt\/data\//,
  /file:\/\//i,
  /http:\/\//i,
  /javascript:/i,
];

function requireFile(path: string): void {
  if (!existsSync(path) || statSync(path).size === 0) {
    throw new Error(`산출물이 없거나 비어 있다: ${path}`);
  }
}

function main(): void {
  requireFile(reportPath);
  requireFile(markdownPath);
  const report = morningReadingReportSchema.parse(
    JSON.parse(readFileSync(reportPath, "utf8")) as unknown
  );
  const markdownLines = readFileSync(markdownPath, "utf8").split(/\r?\n/).length;
  if (markdownLines < 10) throw new Error(`마크다운이 너무 짧다: ${markdownLines}줄`);

  const htmlPath = resolve(
    ROOT,
    "reports",
    "downloads",
    morningHtmlFilename(report.generatedAt)
  );
  requireFile(htmlPath);
  const html = readFileSync(htmlPath, "utf8");
  if (!html.includes("<title>") || !html.includes("오늘 아침 읽을거리")) {
    throw new Error("HTML 제목이나 주요 본문이 없다.");
  }
  for (const pattern of forbiddenHtmlPatterns) {
    if (pattern.test(html)) throw new Error(`HTML 공개 경계 위반: ${pattern}`);
  }

  console.log(JSON.stringify({
    status: "ok",
    report: reportPath,
    markdown: markdownPath,
    html: htmlPath,
    markdownLines,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
