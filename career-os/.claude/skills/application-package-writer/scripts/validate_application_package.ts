#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runCli } from "../../../../scripts/lib/cli.ts";
import { EVIDENCE_DIRECTORY, SUBMISSION_LEAK_PATTERNS } from "./package_contract.ts";
import { loadApplicationForm } from "./application_form_schema.ts";

export type PackageValidation = {
  passed: boolean;
  applicationDirectory: string;
  errors: string[];
};

/** 외부로 제출되는 문서. 이 둘만 유출 검사 대상이다. */
const SUBMITTED_DOCUMENTS = [
  `${EVIDENCE_DIRECTORY}/resume-draft.md`,
  `${EVIDENCE_DIRECTORY}/career-description-draft.md`,
] as const;

/**
 * 제출 문서에 내부 정보가 남았는지만 본다.
 * 무엇을 어떤 절에 담을지는 스킬의 지침이 정한다. 검사기가 모양을 정하지 않는다.
 */
export function validateApplicationPackage(applicationDirectory: string): PackageValidation {
  const directory = resolve(applicationDirectory);
  const errors: string[] = [];

  for (const file of SUBMITTED_DOCUMENTS) {
    const path = join(directory, file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    for (const pattern of SUBMISSION_LEAK_PATTERNS) {
      if (pattern.test(content)) errors.push(`${file}에 제출용이 아닌 내부 정보가 있습니다: ${pattern}`);
    }
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

  return { passed: errors.length === 0, applicationDirectory: directory, errors };
}

if (import.meta.main) {
  await runCli(
    {
      name: "validate_application_package.ts",
      summary: "제출 문서에 내부 정보가 남았는지 검사한다.",
      positional: [{ name: "<application-directory>", description: "검사할 지원 디렉터리" }],
    },
    ({ positional }) => validateApplicationPackage(positional[0]),
  );
}
