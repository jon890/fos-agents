#!/usr/bin/env bun
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { firstOptionValue } from "../lib/cli.ts";
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

export function validateMorningReadingOutputs(root: string): { status: "ok"; report: string; html: string } {
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

  return {
    status: "ok",
    report: reportPath,
    html: htmlPath,
  };
}

if (import.meta.main) {
  try {
    const root = resolveStudyRunRoot(process.env, firstOptionValue(process.argv, "--run-dir"));
    console.log(JSON.stringify(validateMorningReadingOutputs(root), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(error instanceof StudyRunPathError ? error.exitCode : 1);
  }
}
