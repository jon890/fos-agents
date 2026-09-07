import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  morningReadingReportSchema,
  type MorningReadingReport,
} from "../reading_contracts.js";
import { buildMorningHtml, morningHtmlFilename } from "./html.js";

export function writeReportArtifacts(input: {
  report: MorningReadingReport;
  outputDir: string;
}): { htmlPath: string } {
  mkdirSync(input.outputDir, { recursive: true });
  const htmlPath = join(input.outputDir, morningHtmlFilename(input.report.generatedAt));
  writeFileSync(htmlPath, buildMorningHtml(input.report), "utf8");
  return { htmlPath };
}

export function renderExistingReport(input: {
  stateDir: string;
  outputDir: string;
}): { reportPath: string; htmlPath: string } {
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
      outputDir: input.outputDir,
    }),
  };
}
