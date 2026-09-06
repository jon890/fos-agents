import { describe, expect, test } from "bun:test";
import {
  CHROME_PDF_FLAGS,
  DEFAULT_DESIGN_PATH,
  PAGE_BREAK_MARKER,
  countHtmlPages,
  extractCss,
  readPdfPageCount,
  renderHtml,
  renderMarkdownPages,
} from "./export_resume.ts";
import { checkResumeHtml } from "./check_resume_html.ts";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const designCss = `
@page { size: A4; margin: 14mm; }
@media print { * { print-color-adjust: exact; } .resume-page { break-after: page; } }
`;
const designMarkdown = `\`\`\`css${designCss}\`\`\``;

const resume = `# 홍길동

[email](mailto:user@example.com) · [GitHub](https://github.com/user)

## 프로필

백엔드와 AI 플랫폼 개발자입니다.

## 주요 프로젝트

- 반복 가능한 품질 평가 환경을 만들었습니다.

## 경력

### 회사 A · 백엔드 개발

2025.01 - 현재

- 제품 백엔드를 운영했습니다.

## 기술

- Java, Spring Boot, OpenSearch
`;

describe("resume exporter", () => {
  test("기본 분할로 만든 HTML이 evaluator 계약을 만족한다", () => {
    const directory = mkdtempSync(join(tmpdir(), "resume-export-"));
    try {
      const path = join(directory, "resume.html");
      writeFileSync(path, renderHtml(resume, designMarkdown, "design.md"));
      expect(checkResumeHtml(path).passed).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("PDF에 로컬 경로와 인쇄 시각을 노출하지 않는다", () => {
    expect(CHROME_PDF_FLAGS).toContain("--no-pdf-header-footer");
  });

  test("생성된 PDF의 실제 페이지 트리에서 페이지 수를 읽는다", () => {
    const directory = mkdtempSync(join(tmpdir(), "resume-pdf-pages-"));
    try {
      const path = join(directory, "resume.pdf");
      writeFileSync(path, "%PDF-1.4\n<</Type /Pages\n/Count 2\n>>", "latin1");
      expect(readPdfPageCount(path)).toBe(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("기본값은 경력 섹션부터 두 번째 페이지에 배치한다", () => {
    const [firstPage, secondPage] = renderMarkdownPages(resume);
    expect(firstPage).not.toContain('id="career"');
    expect(secondPage).toContain('id="career"');
    expect(secondPage).toContain('class="period"');
  });

  test("공고별 디자인이 없으면 스킬 CSS를 기본값으로 사용한다", () => {
    const directory = mkdtempSync(join(tmpdir(), "resume-design-default-"));
    try {
      const designCss = readFileSync(DEFAULT_DESIGN_PATH, "utf-8");
      const path = join(directory, "resume.html");
      writeFileSync(path, renderHtml(resume, designCss, DEFAULT_DESIGN_PATH));

      expect(checkResumeHtml(path).passed).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("CSS 원문을 디자인 입력으로 사용할 수 있다", () => {
    const directory = mkdtempSync(join(tmpdir(), "resume-design-local-"));
    try {
      const path = join(directory, "resume.html");
      writeFileSync(path, renderHtml(resume, designCss, "design.css"));
      expect(checkResumeHtml(path).passed).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("빈 디자인 입력은 거부한다", () => {
    expect(() => extractCss("")).toThrow("design CSS가 비어 있습니다.");
  });

  test("css 코드 블록이 없는 Markdown 디자인은 거부한다", () => {
    expect(() => extractCss("# 디자인\n\n본문 설명", "design.md")).toThrow(
      "Markdown 디자인 파일에는 css 코드 블록이 필요합니다.",
    );
  });

  test("CLI는 css 코드 블록이 없는 Markdown 디자인을 오류로 종료한다", () => {
    const directory = mkdtempSync(join(tmpdir(), "resume-design-cli-"));
    try {
      const resumePath = join(directory, "evidence", "resume-draft.md");
      const designPath = join(directory, "design.md");
      const htmlPath = join(directory, "review", "resume.html");
      mkdirSync(join(directory, "evidence"), { recursive: true });
      writeFileSync(resumePath, resume);
      writeFileSync(designPath, "# 디자인\n\n본문 설명");

      const result = Bun.spawnSync({
        cmd: [
          "bun",
          join(import.meta.dir, "export_resume.ts"),
          "--application-dir",
          directory,
          "--design",
          designPath,
          "--html",
          htmlPath,
          "--chrome-bin",
          "/not-used",
        ],
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr.toString()).toContain("Markdown 디자인 파일에는 css 코드 블록이 필요합니다.");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("명시적 구분은 경력 항목 사이에서 페이지를 나누고 연속 표지를 만든다", () => {
    const markedResume = resume.replace(
      "## 기술",
      `${PAGE_BREAK_MARKER}\n\n### 회사 B · 백엔드 개발\n\n2022.01 - 2024.12\n\n- API를 운영했습니다.\n\n기술: Java, Spring Boot\n\n## 기술`,
    );
    const [firstPage, secondPage] = renderMarkdownPages(markedResume);

    expect(firstPage).toContain('id="career"');
    expect(firstPage).toContain("회사 A");
    expect(secondPage).toContain('class="section-continuation"');
    expect(secondPage).toContain('data-continuation-label="경력 · 계속"');
    expect(secondPage).toContain("회사 B");
    expect(secondPage).toContain('class="stack"');
    expect(firstPage + secondPage).not.toContain(PAGE_BREAK_MARKER);
  });

  test("여러 페이지 구분을 사용하면 실제 개수에 맞는 표지를 만든다", () => {
    const markedResume = resume
      .replace("## 경력", `${PAGE_BREAK_MARKER}\n\n## 경력`)
      .replace("## 기술", `${PAGE_BREAK_MARKER}\n\n## 기술`);
    const html = renderHtml(markedResume, designMarkdown);

    expect(renderMarkdownPages(markedResume)).toHaveLength(3);
    expect(countHtmlPages(html)).toBe(3);
    expect(html).toContain('data-page="01 / 03"');
    expect(html).toContain('data-page="02 / 03"');
    expect(html).toContain('data-page="03 / 03"');
    expect(html).not.toContain('data-continuation-label="주요 프로젝트 · 계속"');
    expect(html).not.toContain('data-continuation-label="경력 · 계속"');
  });

  test("내용 없는 페이지를 만드는 구분 표시는 거부한다", () => {
    expect(() => renderMarkdownPages(`${PAGE_BREAK_MARKER}\n${resume}`)).toThrow();
    expect(() => renderMarkdownPages(`${resume}\n${PAGE_BREAK_MARKER}`)).toThrow();
  });
});
