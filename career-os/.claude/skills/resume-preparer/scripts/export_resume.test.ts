import { describe, expect, test } from "bun:test";
import { CHROME_PDF_FLAGS, renderHtml } from "./export_resume.ts";
import { checkResumeHtml } from "./check_resume_html.ts";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const design = `\`\`\`css
@page { size: A4; margin: 14mm; }
@media print { * { print-color-adjust: exact; } .resume-page { break-after: page; } }
\`\`\``;

const resume = `# 홍길동

[email](mailto:user@example.com) · [GitHub](https://github.com/user)

## 프로필

백엔드와 AI 플랫폼 개발자입니다.

## 주요 프로젝트

- 반복 가능한 품질 평가 환경을 만들었습니다.

## 경력

- 제품 백엔드를 운영했습니다.

## 기술

- Java, Spring Boot, OpenSearch
`;

describe("resume exporter", () => {
  test("evaluator 계약을 만족하는 두 페이지 HTML을 만든다", () => {
    const directory = mkdtempSync(join(tmpdir(), "resume-export-"));
    try {
      const path = join(directory, "resume.html");
      writeFileSync(path, renderHtml(resume, design));
      expect(checkResumeHtml(path).passed).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("PDF에 로컬 경로와 인쇄 시각을 노출하지 않는다", () => {
    expect(CHROME_PDF_FLAGS).toContain("--no-pdf-header-footer");
  });
});
