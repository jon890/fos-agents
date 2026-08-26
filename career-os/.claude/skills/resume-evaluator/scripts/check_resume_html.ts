#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  SUBMISSION_HTML_CONTRACTS,
  type SubmissionDocumentKind,
} from "./resume_html_contract.ts";

export type Check = {
  name: string;
  passed: boolean;
  detail: string;
};

export function inferDocumentKind(path: string): SubmissionDocumentKind {
  return basename(path) === "career-description.html" ? "career-description" : "resume";
}

export function checkResumeHtml(
  path: string,
  documentKind: SubmissionDocumentKind = inferDocumentKind(path),
) {
  const html = readFileSync(path, "utf8");
  const contract = SUBMISSION_HTML_CONTRACTS[documentKind];
  const pageCount = [...html.matchAll(/class=["'][^"']*\bresume-page\b[^"']*["']/g)].length;
  const checks: Check[] = [
  {
    name: '한국어 문서 선언',
    passed: /<html[^>]+lang=["']ko["']/i.test(html),
    detail: 'html lang="ko"가 필요합니다.',
  },
  {
    name: '독립 실행 메타데이터',
    passed: /<meta[^>]+charset=["']?utf-8/i.test(html) && /<meta[^>]+name=["']viewport["']/i.test(html),
    detail: 'UTF-8 charset과 viewport가 필요합니다.',
  },
  {
    name: 'A4 인쇄 규칙',
    passed: /@page\s*{[^}]*size\s*:\s*A4/is.test(html) && /@media\s+print/i.test(html),
    detail: '@page size: A4와 @media print가 필요합니다.',
  },
  {
    name: '2쪽 페이지 구조',
    passed: pageCount === contract.pageCount,
    detail: `${contract.label}의 resume-page가 ${contract.pageCount}개여야 합니다. 현재 ${pageCount}개입니다.`,
  },
  {
    name: '필수 섹션',
    passed: contract.requiredSectionIds.every((id) =>
      new RegExp(`id=["']${id}["']`).test(html)),
    detail: `${contract.label} 필수 id: ${contract.requiredSectionIds.join(", ")}`,
  },
  {
    name: '연락 수단',
    passed: /mailto:[^"']+@[^"']+/i.test(html) && /https:\/\/github\.com\//i.test(html),
    detail: '이메일과 GitHub 링크가 필요합니다.',
  },
  {
    name: '외부 렌더 자산 없음',
    passed:
      !/<script[^>]+src=["']https?:/i.test(html) &&
      !/<link[^>]+href=["']https?:/i.test(html) &&
      !/url\(\s*["']?https?:/i.test(html),
    detail: '외부 스크립트, 스타일시트, 글꼴 URL에 의존하지 않아야 합니다.',
  },
  {
    name: '내부 근거 경로 비노출',
    passed: contract.internalLeakPatterns.every((pattern) => !pattern.test(html)),
    detail: '로컬 경로, 근거 저장소명, 내부 검토 토큰을 제출물에 포함하지 않습니다.',
  },
  {
    name: '인쇄 색상 보존',
    passed: /print-color-adjust\s*:\s*exact/i.test(html),
    detail: '인쇄 시 강조색이 유지되도록 print-color-adjust를 설정합니다.',
  },
  ];

  const failed = checks.filter((check) => !check.passed);
  return {
    passed: failed.length === 0,
    file: path,
    documentKind,
    checks,
    summary: {
      passed: checks.length - failed.length,
      failed: failed.length,
      total: checks.length,
    },
  };
}

if (import.meta.main) {
  const path = process.argv[2];
  if (!path || !existsSync(path)) {
    console.error(JSON.stringify({ passed: false, error: "제출 HTML 경로를 찾을 수 없습니다." }, null, 2));
    process.exit(2);
  }

  const kindIndex = process.argv.indexOf("--document-type");
  const explicitKind = kindIndex >= 0 ? process.argv[kindIndex + 1] : undefined;
  if (explicitKind && explicitKind !== "resume" && explicitKind !== "career-description") {
    console.error(JSON.stringify({ passed: false, error: "document-type은 resume 또는 career-description이어야 합니다." }, null, 2));
    process.exit(2);
  }

  const result = checkResumeHtml(path, explicitKind as SubmissionDocumentKind | undefined);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}
