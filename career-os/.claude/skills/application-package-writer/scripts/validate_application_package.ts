#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  ALLOWED_PACKAGE_FILES,
  EVIDENCE_DIRECTORY,
  EVIDENCE_FILES,
  REQUIRED_HEADINGS,
  REQUIRED_PACKAGE_FILES,
  REDUNDANT_PACKAGE_FILES,
  REVIEW_DIRECTORY,
  REVIEW_FILES,
  SUBMISSION_LEAK_PATTERNS,
  TOP_LEVEL_FILES,
} from "./package_contract.ts";
import { loadApplicationForm } from "./application_form_schema.ts";
import { loadApplicationInterviewQuestions } from "../../../../scripts/interview-drill/application_question_schema.ts";

export type PackageValidation = {
  passed: boolean;
  applicationDirectory: string;
  readiness?: "ready" | "needs_user_input" | "revise" | "do_not_apply";
  humanConfirmation?: "complete" | "needs_input";
  errors: string[];
};

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const EXPECTED_PATH_BY_NAME: ReadonlyMap<string, string> = new Map([
  ...TOP_LEVEL_FILES.map((file) => [file, file] as const),
  ...EVIDENCE_FILES.map((file) => [file, `${EVIDENCE_DIRECTORY}/${file}`] as const),
  ...REVIEW_FILES.map((file) => [file, `${REVIEW_DIRECTORY}/${file}`] as const),
]);

/** 디렉터리 최상위와 두 층 디렉터리의 파일을 층 접두사가 붙은 상대 경로로 모은다. */
function collectPackageFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name !== EVIDENCE_DIRECTORY && entry.name !== REVIEW_DIRECTORY) continue;
      for (const child of readdirSync(join(directory, entry.name), { withFileTypes: true })) {
        if (child.isFile()) files.push(`${entry.name}/${child.name}`);
      }
      continue;
    }
    if (entry.isFile()) files.push(entry.name);
  }
  return files;
}

export function validateApplicationPackage(applicationDirectory: string): PackageValidation {
  const directory = resolve(applicationDirectory);
  const errors: string[] = [];

  for (const file of REQUIRED_PACKAGE_FILES) {
    if (!existsSync(join(directory, file))) errors.push(`필수 파일이 없습니다: ${file}`);
  }
  for (const file of REDUNDANT_PACKAGE_FILES) {
    for (const layer of ["", `${EVIDENCE_DIRECTORY}/`, `${REVIEW_DIRECTORY}/`]) {
      const relativePath = `${layer}${file}`;
      if (existsSync(join(directory, relativePath))) {
        errors.push(`중복 중간 문서는 보존하지 않습니다: ${relativePath}`);
      }
    }
  }
  const allowedFiles = new Set<string>(ALLOWED_PACKAGE_FILES);
  for (const relativePath of collectPackageFiles(directory)) {
    const name = basename(relativePath);
    if (name === "application-answers.md") continue;
    if (allowedFiles.has(relativePath)) continue;
    const expectedPath = EXPECTED_PATH_BY_NAME.get(name);
    if (expectedPath) {
      errors.push(`지원 패키지 파일의 층이 어긋났습니다: ${relativePath}에 있지만 ${expectedPath}에 있어야 합니다.`);
      continue;
    }
    errors.push(`지원 패키지 계약에 없는 파일입니다: ${relativePath}`);
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

  const packageText = read(join(directory, EVIDENCE_DIRECTORY, "application-package.md"));
  const opening = packageText.split(/\r?\n/).slice(0, 10).join("\n");
  const readinessMatch = opening.match(
    /^- readiness:\s*(ready|needs_user_input|revise|do_not_apply)\s*$/m,
  );
  if (!readinessMatch) errors.push("evidence/application-package.md 첫 10줄에 readiness 판정이 필요합니다.");
  if (!/^- evidence:\s*(safe|revise|blocked)\s*$/m.test(opening)) {
    errors.push("evidence/application-package.md 첫 10줄에 evidence 판정이 필요합니다.");
  }
  const humanConfirmationMatch = opening.match(
    /^- human-confirmation:\s*(complete|needs_input)\s*$/m,
  );
  if (!humanConfirmationMatch) {
    errors.push("evidence/application-package.md 첫 10줄에 human-confirmation 판정이 필요합니다.");
  }
  if (readinessMatch?.[1] === "ready" && humanConfirmationMatch?.[1] !== "complete") {
    errors.push("readiness가 ready이면 human-confirmation은 complete여야 합니다.");
  }

  if (!/https?:\/\//.test(packageText)) {
    errors.push("evidence/application-package.md에 공고 또는 회사 공식 URL이 필요합니다.");
  }
  if (!/sources\/fos-study\//.test(packageText)) {
    errors.push("evidence/application-package.md에 후보자 근거 경로가 필요합니다.");
  }

  const legacyAnswersPath = join(directory, EVIDENCE_DIRECTORY, "application-answers.md");
  if (existsSync(legacyAnswersPath)) {
    errors.push("application-answers.md는 사용하지 않습니다. 지원서 입력값과 서술형 답변을 evidence/application-form.json으로 옮겨야 합니다.");
  }

  const applicationFormPath = join(directory, EVIDENCE_DIRECTORY, "application-form.json");
  if (existsSync(applicationFormPath)) {
    try {
      const form = loadApplicationForm(applicationFormPath);
      for (const question of form.questions) {
        for (const pattern of SUBMISSION_LEAK_PATTERNS) {
          if (pattern.test(question.answer)) {
            errors.push(`evidence/application-form.json의 ${question.id} 답변에 제출용이 아닌 내부 정보가 있습니다: ${pattern}`);
          }
        }
      }
    } catch (error) {
      errors.push(`evidence/application-form.json 형식이 올바르지 않습니다: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const file of [`${EVIDENCE_DIRECTORY}/resume-draft.md`] as const) {
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
    humanConfirmation: humanConfirmationMatch?.[1] as PackageValidation["humanConfirmation"],
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
