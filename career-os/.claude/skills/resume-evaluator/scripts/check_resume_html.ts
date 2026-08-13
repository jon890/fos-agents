#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { RESUME_HTML_CONTRACT } from "./resume_html_contract.ts";

export type Check = {
  name: string;
  passed: boolean;
  detail: string;
};

export function checkResumeHtml(path: string) {
  const html = readFileSync(path, "utf8");
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
    passed: pageCount === RESUME_HTML_CONTRACT.pageCount,
    detail: `resume-page가 ${RESUME_HTML_CONTRACT.pageCount}개여야 합니다. 현재 ${pageCount}개입니다.`,
  },
  {
    name: '필수 섹션',
    passed: RESUME_HTML_CONTRACT.requiredSectionIds.every((id) =>
      new RegExp(`id=["']${id}["']`).test(html)),
    detail: `필수 id: ${RESUME_HTML_CONTRACT.requiredSectionIds.join(", ")}`,
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
    passed: RESUME_HTML_CONTRACT.internalLeakPatterns.every((pattern) => !pattern.test(html)),
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
    console.error(JSON.stringify({ passed: false, error: "resume.html 경로를 찾을 수 없습니다." }, null, 2));
    process.exit(2);
  }

  const result = checkResumeHtml(path);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}
