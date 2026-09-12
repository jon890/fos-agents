#!/usr/bin/env bun

import { existsSync, readFileSync, statSync } from "node:fs";
import { runCli } from "../../../../scripts/lib/cli.ts";
import { basename, join, resolve } from "node:path";
import { artifactTextSha256 } from "./artifact_identity.ts";
import { validateClaimLedger } from "./validate_claim_ledger.ts";
import {
  REQUIRED_CAREER_DESCRIPTION_FILES,
  REQUIRED_RESUME_SUBMISSION_FILES,
} from "./resume_submission_contract.ts";
import { fileSha256, SubmissionManifestSchema } from "./submission_manifest.ts";
import { STATUS_FILE } from "../../application-package-writer/scripts/package_contract.ts";

export type SubmissionBundleValidation = {
  passed: boolean;
  applicationDirectory: string;
  errors: string[];
  warnings: string[];
  artifacts: string[];
};

function packageStatus(directory: string): { readiness?: string; evidence?: string; humanConfirmation?: string } {
  const path = join(directory, STATUS_FILE);
  if (!existsSync(path)) return {};
  const opening = readFileSync(path, "utf8").split(/\r?\n/).slice(0, 10).join("\n");
  return {
    readiness: opening.match(/^- readiness:\s*(\S+)\s*$/m)?.[1],
    evidence: opening.match(/^- evidence:\s*(\S+)\s*$/m)?.[1],
    humanConfirmation: opening.match(/^- human-confirmation:\s*(\S+)\s*$/m)?.[1],
  };
}

function requireFiles(directory: string, files: readonly string[], errors: string[]): void {
  for (const file of files) {
    const path = join(directory, file);
    if (!existsSync(path)) errors.push(`제출 묶음 파일이 없습니다: ${file}`);
    else if (statSync(path).size === 0) errors.push(`제출 묶음 파일이 비어 있습니다: ${file}`);
  }
}

function validateScorecard(
  directory: string,
  artifactName: string,
  scorecardName: string,
  errors: string[],
): void {
  const artifactPath = join(directory, artifactName);
  const scorecardPath = join(directory, scorecardName);
  if (!existsSync(artifactPath) || !existsSync(scorecardPath)) return;

  const scorecard = readFileSync(scorecardPath, "utf8");
  const recordedArtifact = scorecard.match(/^- artifact:\s*`?([^`\n]+)`?\s*$/m)?.[1];
  const recordedHash = scorecard.match(/^- artifactTextSha256:\s*`?([0-9a-f]{64})`?\s*$/m)?.[1];
  const verdict = scorecard.match(/^- verdict:\s*`?(pass|revise|blocked)`?\s*$/m)?.[1];

  if (recordedArtifact !== basename(artifactPath)) {
    errors.push(`${scorecardName}의 artifact가 현재 제출 파일과 다릅니다.`);
  }
  if (recordedHash !== artifactTextSha256(artifactPath)) {
    errors.push(`${scorecardName}가 현재 제출 문구 해시와 연결되지 않았습니다.`);
  }
  if (verdict !== "pass") errors.push(`${scorecardName}의 verdict가 pass가 아닙니다.`);
}

function validateAuditedArtifact(
  directory: string,
  artifactName: string,
  ledgerName: string,
  scorecardName: string,
  errors: string[],
  warnings: string[],
): void {
  const artifactPath = join(directory, artifactName);
  const ledgerPath = join(directory, ledgerName);
  if (existsSync(artifactPath) && existsSync(ledgerPath)) {
    const ledger = validateClaimLedger(ledgerPath, artifactPath);
    errors.push(...ledger.errors.map((error) => `${ledgerName}: ${error}`));
    warnings.push(...ledger.warnings.map((warning) => `${ledgerName}: ${warning}`));
  }
  validateScorecard(directory, artifactName, scorecardName, errors);
}

function validateManifest(directory: string, hasCareerDescription: boolean, errors: string[]): void {
  const manifestPath = join(directory, "review", "submission-manifest.json");
  if (!existsSync(manifestPath)) return;

  const parsed = SubmissionManifestSchema.safeParse(JSON.parse(readFileSync(manifestPath, "utf8")));
  if (!parsed.success) {
    errors.push(...parsed.error.issues.map((issue) => `review/submission-manifest.json ${issue.path.join(".")}: ${issue.message}`));
    return;
  }

  const expected = [
    { kind: "resume", file: "resume.pdf", sourceHtml: "review/resume.html" },
    ...(hasCareerDescription
      ? [
          { kind: "career_description", file: "career-description.pdf", sourceHtml: "review/career-description.html" },
          { kind: "combined", file: "submission.pdf" },
        ]
      : []),
  ] as const;

  for (const item of expected) {
    const artifact = parsed.data.artifacts.find((candidate) => candidate.kind === item.kind);
    const filePath = join(directory, item.file);
    if (!artifact) {
      errors.push(`review/submission-manifest.json에 ${item.kind} 항목이 없습니다.`);
      continue;
    }
    if (artifact.file !== item.file || !existsSync(filePath) || artifact.sha256 !== fileSha256(filePath)) {
      errors.push(`review/submission-manifest.json의 ${item.file} 해시가 현재 파일과 다릅니다.`);
    }
    if ("sourceHtml" in item && item.sourceHtml) {
      const htmlPath = join(directory, item.sourceHtml);
      if (!existsSync(htmlPath)) continue;
      if (artifact.sourceHtml !== item.sourceHtml || artifact.sourceTextSha256 !== artifactTextSha256(htmlPath)) {
        errors.push(`review/submission-manifest.json의 ${item.file} 원본 HTML 해시가 현재 문구와 다릅니다.`);
      }
      if (existsSync(filePath) && statSync(filePath).mtimeMs < statSync(htmlPath).mtimeMs) {
        errors.push(`${item.file}이 원본 HTML보다 오래됐습니다.`);
      }
    }
  }
}

export function validateSubmissionBundle(applicationDirectory: string): SubmissionBundleValidation {
  const directory = resolve(applicationDirectory);
  const errors: string[] = [];
  const warnings: string[] = [];
  const status = packageStatus(directory);

  if (status.readiness !== "ready") {
    errors.push(`${STATUS_FILE}의 readiness가 ready가 아닙니다.`);
  }
  if (status.evidence !== "safe") {
    errors.push(`${STATUS_FILE}의 evidence가 safe가 아닙니다.`);
  }
  if (status.humanConfirmation !== "complete") {
    errors.push(`${STATUS_FILE}의 human-confirmation이 complete가 아닙니다.`);
  }

  requireFiles(directory, REQUIRED_RESUME_SUBMISSION_FILES, errors);
  validateAuditedArtifact(directory, "review/resume.html", "review/claim-ledger.json", "review/resume-scorecard.md", errors, warnings);

  const hasCareerDescription = [
    "evidence/career-description-draft.md",
    ...REQUIRED_CAREER_DESCRIPTION_FILES,
  ].some((file) => existsSync(join(directory, file)));
  if (hasCareerDescription) {
    requireFiles(directory, REQUIRED_CAREER_DESCRIPTION_FILES, errors);
    validateAuditedArtifact(
      directory,
      "review/career-description.html",
      "review/career-description-claim-ledger.json",
      "review/career-description-scorecard.md",
      errors,
      warnings,
    );
  }
  validateManifest(directory, hasCareerDescription, errors);

  const artifacts = [
    ...REQUIRED_RESUME_SUBMISSION_FILES,
    ...(hasCareerDescription ? REQUIRED_CAREER_DESCRIPTION_FILES : []),
  ].filter((file) => existsSync(join(directory, file)));

  return { passed: errors.length === 0, applicationDirectory: directory, errors, warnings, artifacts };
}

if (import.meta.main) {
  await runCli(
    {
      name: "validate_submission_bundle.ts",
      summary: "제출 묶음의 파일과 해시가 manifest 와 맞는지 검사한다.",
      positional: [{ name: "<application-directory>", description: "지원 디렉터리" }],
    },
    ({ positional }) => validateSubmissionBundle(positional[0]),
  );
}
