import { describe, expect, test } from "bun:test";
import {
  CHROME_PDF_FLAGS,
  DEFAULT_DESIGN_PATH,
  PAGE_BREAK_MARKER,
  countHtmlPages,
  describePageOverflow,
  extractCss,
  pageTextLength,
  readPdfPageCount,
  documentTitle,
  renderHtml,
  renderMarkdownPages,
  splitHtmlPages,
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

  test("쪽마다 단독 HTML로 나누고 스타일과 쪽 역할을 그대로 둔다", () => {
    const html = renderHtml(resume, designMarkdown, "design.md");
    const pages = splitHtmlPages(html);

    expect(pages).toHaveLength(countHtmlPages(html));
    for (const page of pages) {
      expect(countHtmlPages(page)).toBe(1);
      expect(page).toContain("<style>");
      expect(page).toContain("</html>");
    }
    expect(pages[0]).toContain("resume-page--first");
    expect(pages[0]).not.toContain('id="career"');
    expect(pages[1]).toContain('id="career"');
  });

  test("쪽 본문 글자 수는 태그와 공백을 빼고 센다", () => {
    expect(pageTextLength("<main><p>백엔드 개발</p></main>")).toBe(5);
  });

  test("넘친 쪽과 쪽별 글자 수를 오류 문구에 담는다", () => {
    const lines = describePageOverflow([
      { page: 1, pdfPages: 1, textLength: 1120 },
      { page: 2, pdfPages: 2, textLength: 1840 },
    ]);

    expect(lines[0]).toBe("2쪽이 PDF 2쪽으로 넘쳤습니다. 이 쪽의 내용을 줄이거나 구분을 추가하세요.");
    expect(lines.at(-1)).toBe("쪽별 본문 글자 수: 1쪽 1120자, 2쪽 1840자");
  });

  test("쪽마다 한 쪽에 들어가면 쪽 사이 규칙을 확인하라고 알린다", () => {
    const lines = describePageOverflow([{ page: 1, pdfPages: 1, textLength: 900 }]);

    expect(lines[0]).toContain("모두 한 쪽에 들어갑니다");
  });

  test("쪽 수를 확인하지 못한 쪽을 따로 알린다", () => {
    const lines = describePageOverflow([{ page: 3, pdfPages: undefined, textLength: 900 }]);

    expect(lines[0]).toContain("쪽 수를 확인하지 못한 쪽: 3쪽");
  });

  test("CLI는 쪽 수가 어긋나면 어느 쪽이 넘쳤는지 낸다", () => {
    const directory = mkdtempSync(join(tmpdir(), "resume-overflow-"));
    try {
      const overflowing = resume.replace(
        "- 제품 백엔드를 운영했습니다.",
        Array.from({ length: 80 }, (_, index) => `- 제품 백엔드를 운영하며 처리한 ${index + 1}번째 과제입니다.`).join("\n"),
      );
      const resumePath = join(directory, "evidence", "resume-draft.md");
      mkdirSync(join(directory, "evidence"), { recursive: true });
      writeFileSync(resumePath, overflowing);

      const result = Bun.spawnSync({
        cmd: ["bun", join(import.meta.dir, "export_resume.ts"), "--application-dir", directory],
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(result.exitCode).toBe(1);
      const stderr = result.stderr.toString();
      expect(stderr).toContain("일치하지 않습니다");
      expect(stderr).toMatch(/\d+쪽이 PDF \d+쪽으로 넘쳤습니다/);
      expect(stderr).toContain("쪽별 본문 글자 수:");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 120000);

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

  test("4단계 제목을 회사 아래 프로젝트 제목으로 렌더링한다", () => {
    const markdown = `# 김테스트

## 주요 프로젝트

### 회사

#### 프로젝트 이름

- 한 일
`;
    const [page] = renderMarkdownPages(markdown);
    expect(page).toContain("<h3>회사</h3>");
    expect(page).toContain("<h4>프로젝트 이름</h4>");
  });

  test("들여쓴 목록을 중첩 목록으로 렌더링한다", () => {
    const markdown = `# 김테스트

## 주요 프로젝트

- 상위 항목
  - 하위 항목
- 다음 상위 항목
`;
    const [page] = renderMarkdownPages(markdown);
    expect(page).toContain("<li>상위 항목</li>\n<ul>\n<li>하위 항목</li>\n</ul>");
    expect(page.match(/<ul>/g)).toHaveLength(2);
    expect(page.match(/<\/ul>/g)).toHaveLength(2);
  });

  test("문서 제목을 첫 번째 제목에서 가져온다", () => {
    expect(documentTitle("# 김테스트 경력기술서\n\n본문")).toBe("김테스트 경력기술서");
    expect(documentTitle("본문만 있는 문서")).toBe("이력서");
    expect(renderHtml("# 김테스트 경력기술서\n\n## 프로필\n\n내용\n", designCss)).toContain(
      "<title>김테스트 경력기술서</title>",
    );
  });
});
