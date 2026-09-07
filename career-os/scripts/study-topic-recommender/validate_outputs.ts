#!/usr/bin/env bun
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { morningReadingReportSchema } from "./reading_contracts.js";
import { morningHtmlFilename } from "./render/html.js";
import { resolveStudyRunRoot, StudyRunPathError } from "./runtime-paths.js";

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

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function main(): void {
  const root = resolveStudyRunRoot(process.env, argumentValue("--run-dir"));
  const reportPath = join(root, "state", "morning-reading.json");
  requireFile(reportPath);
  const report = morningReadingReportSchema.parse(
    JSON.parse(readFileSync(reportPath, "utf8")) as unknown
  );

  const htmlPath = join(root, morningHtmlFilename(report.generatedAt));
  requireFile(htmlPath);
  const html = readFileSync(htmlPath, "utf8");
  if (!html.includes("<title>") || !html.includes("오늘 아침 공부 주제")) {
    throw new Error("HTML 제목이나 주요 본문이 없다.");
  }
  for (const pattern of forbiddenHtmlPatterns) {
    if (pattern.test(html)) throw new Error(`HTML 공개 경계 위반: ${pattern}`);
  }

  console.log(JSON.stringify({
    status: "ok",
    report: reportPath,
    html: htmlPath,
  }, null, 2));
}

try {
  main();
} catch (error) {
  if (error instanceof StudyRunPathError) {
    console.error(error.message);
    process.exit(error.exitCode);
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
