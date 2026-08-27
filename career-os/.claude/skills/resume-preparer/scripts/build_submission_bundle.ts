#!/usr/bin/env bun

import { existsSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { artifactTextSha256 } from "./artifact_identity.ts";
import { fileSha256, type SubmissionManifest } from "./submission_manifest.ts";

function requireCurrentPdf(htmlPath: string, pdfPath: string): void {
  if (!existsSync(htmlPath) || !existsSync(pdfPath)) {
    throw new Error(`HTML·PDF 제출 문서가 모두 필요합니다: ${htmlPath}, ${pdfPath}`);
  }
  if (statSync(pdfPath).mtimeMs < statSync(htmlPath).mtimeMs) {
    throw new Error(`PDF가 HTML보다 오래됐습니다. PDF를 다시 만드세요: ${pdfPath}`);
  }
}

export function buildSubmissionBundle(applicationDirectory: string): string {
  const directory = resolve(applicationDirectory);
  const resumeHtml = join(directory, "resume.html");
  const resumePdf = join(directory, "resume.pdf");
  requireCurrentPdf(resumeHtml, resumePdf);

  const careerHtml = join(directory, "career-description.html");
  const careerPdf = join(directory, "career-description.pdf");
  const hasCareerDescription = existsSync(careerHtml) || existsSync(careerPdf);
  const artifacts: SubmissionManifest["artifacts"] = [{
    kind: "resume",
    file: "resume.pdf",
    sha256: fileSha256(resumePdf),
    sourceHtml: "resume.html",
    sourceTextSha256: artifactTextSha256(resumeHtml),
  }];

  if (hasCareerDescription) {
    requireCurrentPdf(careerHtml, careerPdf);
    const submissionPdf = join(directory, "submission.pdf");
    const pdfunite = process.env.PDFUNITE_BIN ?? "pdfunite";
    const merged = spawnSync(pdfunite, [resumePdf, careerPdf, submissionPdf], { encoding: "utf8" });
    if (merged.status !== 0 || !existsSync(submissionPdf)) {
      throw new Error(merged.stderr || merged.stdout || "통합 PDF를 만들지 못했습니다.");
    }
    artifacts.push(
      {
        kind: "career_description",
        file: "career-description.pdf",
        sha256: fileSha256(careerPdf),
        sourceHtml: "career-description.html",
        sourceTextSha256: artifactTextSha256(careerHtml),
      },
      {
        kind: "combined",
        file: "submission.pdf",
        sha256: fileSha256(submissionPdf),
      },
    );
  }

  const manifest: SubmissionManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    artifacts,
  };
  const output = join(directory, "submission-manifest.json");
  writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return output;
}

if (import.meta.main) {
  const directory = process.argv[2];
  if (!directory) {
    console.error("사용법: build_submission_bundle.ts <application-directory>");
    process.exit(2);
  }
  try {
    console.log(buildSubmissionBundle(directory));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
