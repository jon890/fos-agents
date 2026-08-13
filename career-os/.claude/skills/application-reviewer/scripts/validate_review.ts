#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  INTERNAL_LEAK_PATTERNS,
  REQUIRED_APPLICATION_FILES,
  REQUIRED_REVIEW_HEADINGS,
} from "./review_contract.ts";

export type ReviewValidation = {
  passed: boolean;
  applicationDirectory: string;
  errors: string[];
};

function section(content: string, heading: string): string {
  const start = content.indexOf(heading);
  if (start < 0) return "";
  const rest = content.slice(start + heading.length);
  const next = rest.search(/^##\s/m);
  return next < 0 ? rest : rest.slice(0, next);
}

export function validateReview(applicationDirectory: string): ReviewValidation {
  const directory = resolve(applicationDirectory);
  const errors: string[] = [];

  for (const file of REQUIRED_APPLICATION_FILES) {
    if (!existsSync(join(directory, file))) errors.push(`필수 입력이 없습니다: ${file}`);
  }

  const reviewPath = join(directory, "review.md");
  if (!existsSync(reviewPath)) {
    errors.push("검토 결과가 없습니다: review.md");
    return { passed: false, applicationDirectory: directory, errors };
  }

  const review = readFileSync(reviewPath, "utf8");
  const lines = review.split(/\r?\n/);
  if (lines.length < 30) errors.push(`review.md는 30줄 이상이어야 합니다. 현재 ${lines.length}줄입니다.`);

  for (const heading of REQUIRED_REVIEW_HEADINGS) {
    if (!review.includes(heading)) errors.push(`필수 섹션이 없습니다: ${heading}`);
  }

  const verdictMatch = review.match(/^- result:\s*(pass|revise|blocked)\s*$/m);
  if (!verdictMatch) errors.push("Verdict에 result: pass|revise|blocked가 필요합니다.");

  const opening = lines.slice(0, 10).join("\n");
  if (!/pass|revise|blocked/.test(opening) || !/권장|다음 행동|수정|진행/.test(opening)) {
    errors.push("첫 10줄 안에 판정과 권장 행동이 필요합니다.");
  }

  if (/needs_evidence/i.test(review)) {
    errors.push("사용자 검토 문서에 내부 상태명 needs_evidence를 노출하지 않습니다.");
  }

  const submissionFiles = ["resume-draft.md", "cover-letter.md"] as const;
  for (const file of submissionFiles) {
    const path = join(directory, file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    for (const pattern of INTERNAL_LEAK_PATTERNS) {
      if (pattern.test(content)) errors.push(`${file}에 내부 검토 정보가 남아 있습니다: ${pattern}`);
    }
  }

  if (verdictMatch?.[1] === "revise") {
    const requests = section(review, "## 수정 요청");
    const bullets = requests.match(/^[-*]\s+/gm)?.length ?? 0;
    if (bullets < 1) errors.push("revise 판정에는 구체적인 수정 요청이 필요합니다.");
  }

  return { passed: errors.length === 0, applicationDirectory: directory, errors };
}

if (import.meta.main) {
  const applicationDirectory = process.argv[2];
  if (!applicationDirectory) {
    console.error(JSON.stringify({ passed: false, error: "사용법: validate_review.ts <application-directory>" }, null, 2));
    process.exit(2);
  }
  const result = validateReview(applicationDirectory);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}
