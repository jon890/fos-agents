#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  REQUIRED_HEADINGS,
  REQUIRED_PACKAGE_FILES,
  SUBMISSION_LEAK_PATTERNS,
} from "./package_contract.ts";
import { loadApplicationInterviewQuestions } from "../../../../scripts/interview-drill/application_question_schema.ts";

export type PackageValidation = {
  passed: boolean;
  applicationDirectory: string;
  readiness?: "ready" | "needs_user_input" | "revise" | "do_not_apply";
  errors: string[];
};

function read(path: string): string {
  return readFileSync(path, "utf8");
}

export function validateApplicationPackage(applicationDirectory: string): PackageValidation {
  const directory = resolve(applicationDirectory);
  const errors: string[] = [];

  for (const file of REQUIRED_PACKAGE_FILES) {
    if (!existsSync(join(directory, file))) errors.push(`필수 파일이 없습니다: ${file}`);
  }
  if (errors.length > 0) return { passed: false, applicationDirectory: directory, errors };

  try {
    loadApplicationInterviewQuestions(directory);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  for (const [file, headings] of Object.entries(REQUIRED_HEADINGS)) {
    const content = read(join(directory, file));
    for (const heading of headings) {
      if (!content.includes(heading)) errors.push(`${file}에 필수 섹션이 없습니다: ${heading}`);
    }
  }

  const packageText = read(join(directory, "application-package.md"));
  const opening = packageText.split(/\r?\n/).slice(0, 10).join("\n");
  const readinessMatch = opening.match(
    /^- readiness:\s*(ready|needs_user_input|revise|do_not_apply)\s*$/m,
  );
  if (!readinessMatch) errors.push("application-package.md 첫 10줄에 readiness 판정이 필요합니다.");
  if (!/^- evidence:\s*(safe|revise|blocked)\s*$/m.test(opening)) {
    errors.push("application-package.md 첫 10줄에 evidence 판정이 필요합니다.");
  }

  if (!/https?:\/\//.test(packageText)) {
    errors.push("application-package.md에 공고 또는 회사 공식 URL이 필요합니다.");
  }
  if (!/sources\/fos-study\//.test(packageText)) {
    errors.push("application-package.md에 후보자 근거 경로가 필요합니다.");
  }

  for (const file of ["resume-draft.md", "application-answers.md"] as const) {
    if (!existsSync(join(directory, file))) continue;
    const content = read(join(directory, file));
    for (const pattern of SUBMISSION_LEAK_PATTERNS) {
      if (pattern.test(content)) errors.push(`${file}에 제출용이 아닌 내부 정보가 있습니다: ${pattern}`);
    }
  }

  return {
    passed: errors.length === 0,
    applicationDirectory: directory,
    readiness: readinessMatch?.[1] as PackageValidation["readiness"],
    errors,
  };
}

if (import.meta.main) {
  const directory = process.argv[2];
  if (!directory) {
    console.error(JSON.stringify({ passed: false, error: "사용법: validate_application_package.ts <application-directory>" }, null, 2));
    process.exit(2);
  }
  const result = validateApplicationPackage(directory);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}
