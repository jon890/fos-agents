import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  morningReadingReportSchema,
  type MorningReadingReport,
} from "../reading_contracts.js";
import { buildMorningHtml, morningHtmlFilename } from "./html.js";
import { buildMorningMarkdown } from "./markdown.js";

export function writeReportArtifacts(input: {
  report: MorningReadingReport;
  reportsDir: string;
  downloadsDir: string;
}): { markdownPath: string; htmlPath: string } {
  mkdirSync(input.reportsDir, { recursive: true });
  mkdirSync(input.downloadsDir, { recursive: true });
  const markdownPath = join(input.reportsDir, "morning-reading.md");
  const htmlPath = join(input.downloadsDir, morningHtmlFilename(input.report.generatedAt));
  writeFileSync(markdownPath, buildMorningMarkdown(input.report), "utf8");
  writeFileSync(htmlPath, buildMorningHtml(input.report), "utf8");
  return { markdownPath, htmlPath };
}

export function renderExistingReport(input: {
  stateDir: string;
  reportsDir: string;
  downloadsDir: string;
}): { reportPath: string; markdownPath: string; htmlPath: string } {
  const reportPath = join(input.stateDir, "morning-reading.json");
  if (!existsSync(reportPath)) {
    throw new Error("morning-reading.json이 없다. 먼저 추천 실행을 완료해야 한다.");
  }
  const report = morningReadingReportSchema.parse(
    JSON.parse(readFileSync(reportPath, "utf8")) as unknown
  );
  return {
    reportPath,
    ...writeReportArtifacts({
      report,
      reportsDir: input.reportsDir,
      downloadsDir: input.downloadsDir,
    }),
  };
}
