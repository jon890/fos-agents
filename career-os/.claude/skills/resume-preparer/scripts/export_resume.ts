#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { spawnSync } from 'child_process';

type Options = {
  applicationDir: string;
  resumePath: string;
  designPath: string;
  htmlPath: string;
  pdfPath: string;
  chromeBin: string;
};

const SKILL_ROOT = resolve(import.meta.dir, '..');
export const DEFAULT_DESIGN_PATH = join(SKILL_ROOT, 'assets/resume.css');
export const CHROME_PDF_FLAGS = [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--no-pdf-header-footer',
] as const;
export const PAGE_BREAK_MARKER = '<!-- resume-page-break -->';

function parseArgs(args: string[]): Options {
  let applicationDir = '';
  let resumePath = '';
  let designPath = '';
  let htmlPath = '';
  let pdfPath = '';
  let chromeBin = process.env.CHROME_BIN ?? '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--application-dir' && args[i + 1]) applicationDir = args[++i];
    else if (arg === '--resume' && args[i + 1]) resumePath = args[++i];
    else if (arg === '--design' && args[i + 1]) designPath = args[++i];
    else if (arg === '--html' && args[i + 1]) htmlPath = args[++i];
    else if (arg === '--pdf' && args[i + 1]) pdfPath = args[++i];
    else if (arg === '--chrome-bin' && args[i + 1]) chromeBin = args[++i];
    else if (arg === '--help') {
      showHelp();
      process.exit(0);
    }
  }

  if (!applicationDir) {
    console.error('--application-dir가 필요합니다.');
    showHelp();
    process.exit(2);
  }

  resumePath = resumePath || join(applicationDir, 'evidence', 'resume-draft.md');
  designPath = designPath || DEFAULT_DESIGN_PATH;
  htmlPath = htmlPath || join(applicationDir, 'review', 'resume.html');
  pdfPath = pdfPath || join(applicationDir, 'resume.pdf');
  chromeBin = chromeBin || resolveChromeBin();

  return { applicationDir, resumePath, designPath, htmlPath, pdfPath, chromeBin };
}

function resolveChromeBin(): string {
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    console.error('Chrome binary not found. Set CHROME_BIN or pass --chrome-bin.');
    process.exit(2);
  }
  return found;
}

function readRequired(path: string): string {
  if (!existsSync(path)) {
    console.error(`required file not found: ${path}`);
    process.exit(2);
  }
  return readFileSync(path, 'utf-8');
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inlineMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function sectionId(title: string): string | undefined {
  const normalized = title.replace(/[*`_]/g, '').trim();
  if (/^(프로필|제출용 요약|요약)/.test(normalized)) return 'profile';
  if (/^(주요 프로젝트|핵심 경험|선택 경험|맞춤 경력)/.test(normalized)) return 'selected-work';
  if (/^경력/.test(normalized)) return 'career';
  if (/^(지원 동기|지원동기)/.test(normalized)) return 'motivation';
  if (/^(기술|기술 범위|스킬)/.test(normalized)) return 'skills';
  return undefined;
}

export function renderMarkdownPages(markdown: string): string[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const pageBreakIndexes = lines
    .map((line, index) => line.trim() === PAGE_BREAK_MARKER ? index : -1)
    .filter((index) => index >= 0);
  let previousPageBreakIndex = -1;
  for (const pageBreakIndex of pageBreakIndexes) {
    const pageHasContent = lines
      .slice(previousPageBreakIndex + 1, pageBreakIndex)
      .some((line) => line.trim() && line.trim() !== PAGE_BREAK_MARKER);
    if (!pageHasContent) {
      throw new Error(`${PAGE_BREAK_MARKER} 앞에는 페이지에 표시할 내용이 필요합니다.`);
    }
    previousPageBreakIndex = pageBreakIndex;
  }
  if (
    pageBreakIndexes.length > 0 &&
    !lines.slice(previousPageBreakIndex + 1).some((line) => line.trim())
  ) {
    throw new Error(`${PAGE_BREAK_MARKER} 뒤에는 페이지에 표시할 내용이 필요합니다.`);
  }
  const hasExplicitPageBreak = pageBreakIndexes.length > 0;
  const pages: string[][] = [[]];
  let pageIndex = 0;
  const listStack: { tag: 'ul' | 'ol'; indent: number }[] = [];
  let sectionOpen = false;
  let headerOpen = true;
  let headerParagraphIndex = 0;
  let currentSectionId: string | undefined;
  let currentSectionTitle = '';

  const html = () => pages[pageIndex];
  pages[0].push('<header class="resume-header">');

  const closeList = () => {
    while (listStack.length > 0) {
      html().push(`</${listStack.pop()!.tag}>`);
    }
  };

  const openListItem = (tag: 'ul' | 'ol', indent: number, text: string) => {
    while (listStack.length > 0 && indent < listStack[listStack.length - 1].indent) {
      html().push(`</${listStack.pop()!.tag}>`);
    }
    const top = listStack[listStack.length - 1];
    if (!top || indent > top.indent) {
      listStack.push({ tag, indent });
      html().push(`<${tag}>`);
    } else if (top.tag !== tag) {
      html().push(`</${listStack.pop()!.tag}>`);
      listStack.push({ tag, indent });
      html().push(`<${tag}>`);
    }
    html().push(`<li>${inlineMarkdown(text)}</li>`);
  };

  const closeSection = () => {
    closeList();
    if (sectionOpen) {
      html().push('</section>');
      sectionOpen = false;
    }
  };

  const closeHeader = () => {
    if (!headerOpen) return;
    closeList();
    pages[0].push('</header>');
    headerOpen = false;
  };

  const openContinuationSection = () => {
    if (!currentSectionTitle) return;
    const id = currentSectionId ? ` data-section="${currentSectionId}"` : '';
    html().push(
      `<section class="section-continuation"${id} data-continuation-label="${escapeHtml(currentSectionTitle)} · 계속">`,
    );
    sectionOpen = true;
  };

  const startNewPage = (continueCurrentSection: boolean) => {
    closeHeader();
    closeSection();
    pages.push([]);
    pageIndex += 1;
    if (continueCurrentSection) openContinuationSection();
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const line = rawLine.trimEnd();
    if (line.trim() === PAGE_BREAK_MARKER) {
      const nextContentLine = lines.slice(lineIndex + 1).find((candidate) => candidate.trim());
      const startsNewSection = /^##\s+/.test(nextContentLine?.trim() ?? '');
      startNewPage(!startsNewSection);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const title = heading[2].trim();
      if (level === 2) {
        closeHeader();
        closeSection();
        const id = sectionId(title);
        if (!hasExplicitPageBreak && pageIndex === 0 && (id === 'career' || id === 'skills')) {
          startNewPage(false);
        }
        html().push(id ? `<section id="${id}">` : '<section>');
        sectionOpen = true;
        currentSectionId = id;
        currentSectionTitle = title.replace(/[*`_]/g, '').trim();
      }
      html().push(`<h${level}>${inlineMarkdown(title)}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (unordered) {
      openListItem('ul', unordered[1].length, unordered[2].trim());
      continue;
    }

    const ordered = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (ordered) {
      openListItem('ol', ordered[1].length, ordered[2].trim());
      continue;
    }

    closeList();
    const text = line.trim();
    let className = '';
    if (headerOpen) {
      headerParagraphIndex += 1;
      className = /mailto:|https:\/\/github\.com\//i.test(text)
        ? 'contact-line'
        : headerParagraphIndex === 1
          ? 'headline'
          : '';
    } else if (/^재직 기간\s*:/.test(text)) {
      className = 'company-period';
    } else if (/^\d{4}\.\d{2}\s+-\s+(?:\d{4}\.\d{2}|현재)$/.test(text)) {
      className = 'period';
    } else if (/^기술\s*:/.test(text)) {
      className = 'stack';
    }
    const classAttribute = className ? ` class="${className}"` : '';
    html().push(`<p${classAttribute}>${inlineMarkdown(text)}</p>`);
  }

  closeHeader();
  closeSection();
  return pages.map((page) => page.join('\n'));
}

export function extractCss(designSource: string, designPath = ''): string {
  const trimmed = designSource.trim();
  if (!trimmed) {
    throw new Error('design CSS가 비어 있습니다.');
  }

  const match = designSource.match(/```css\s*([\s\S]*?)```/);
  if (match?.[1]?.trim()) return match[1].trim();

  if (/\.md$/i.test(designPath)) {
    throw new Error('Markdown 디자인 파일에는 css 코드 블록이 필요합니다.');
  }
  if (!/[{}]/.test(trimmed)) {
    throw new Error('design 입력은 CSS 원문 또는 css 코드 블록이어야 합니다.');
  }

  return trimmed;
}

export function documentTitle(resumeMarkdown: string): string {
  const heading = resumeMarkdown.match(/^#\s+(.+)$/m);
  return heading ? heading[1].replace(/[*`_]/g, '').trim() : '이력서';
}

export function inlineCompanyPeriod(html: string): string {
  return html.replace(
    /<h3>([\s\S]*?)<\/h3>\s*<p class="company-period">([\s\S]*?)<\/p>/g,
    '<h3>$1<span class="company-period">$2</span></h3>',
  );
}

export function renderHtml(resumeMarkdown: string, designSource: string, designPath = ''): string {
  const css = extractCss(designSource, designPath);
  const title = documentTitle(resumeMarkdown);
  const pages = renderMarkdownPages(resumeMarkdown);
  const pageNumberWidth = Math.max(2, String(pages.length).length);
  const renderedPages = pages.map((page, index) => {
    page = inlineCompanyPeriod(page);
    const ordinal = String(index + 1).padStart(pageNumberWidth, '0');
    const total = String(pages.length).padStart(pageNumberWidth, '0');
    const role = index === 0
      ? 'resume-page--first'
      : index === pages.length - 1
        ? 'resume-page--last'
        : 'resume-page--continuation';
    return `  <main class="resume-page ${role}" data-page="${ordinal} / ${total}">
${page}
  </main>`;
  }).join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
${css}
  </style>
</head>
<body>
${renderedPages}
</body>
</html>
`;
}

export function countHtmlPages(html: string): number {
  return [...html.matchAll(/class=["'][^"']*\bresume-page\b[^"']*["']/g)].length;
}

function writeHtml(path: string, html: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, html, 'utf-8');
}

function renderPdf(opts: Options, expectedPageCount: number): number {
  mkdirSync(dirname(opts.pdfPath), { recursive: true });
  const htmlUrl = `file://${resolve(opts.htmlPath)}`;
  const result = spawnSync(
    opts.chromeBin,
    [
      ...CHROME_PDF_FLAGS,
      `--print-to-pdf=${resolve(opts.pdfPath)}`,
      htmlUrl,
    ],
    { encoding: 'utf-8' },
  );

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || 'Chrome PDF rendering failed');
    process.exit(result.status ?? 1);
  }

  const pageCount = readPdfPageCount(opts.pdfPath);
  if (pageCount !== expectedPageCount) {
    console.error(
      `HTML에서 의도한 ${expectedPageCount}쪽과 PDF의 ${pageCount ?? '확인 불가'}쪽이 일치하지 않습니다.`,
    );
    process.exit(1);
  }
  return pageCount;
}

export function readPdfPageCount(path: string): number | undefined {
  const source = readFileSync(path).toString('latin1');
  const patterns = [
    /\/Type\s*\/Pages\b[\s\S]{0,512}?\/Count\s+(\d+)/g,
    /\/Count\s+(\d+)[\s\S]{0,512}?\/Type\s*\/Pages\b/g,
  ];
  const counts = patterns.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => Number.parseInt(match[1], 10)),
  );
  return counts.length > 0 ? Math.max(...counts) : undefined;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const resumeMarkdown = readRequired(opts.resumePath);
  const designSource = readRequired(opts.designPath);
  let html: string;
  try {
    html = renderHtml(resumeMarkdown, designSource, opts.designPath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
  const expectedPageCount = countHtmlPages(html);

  writeHtml(opts.htmlPath, html);
  const renderedPageCount = renderPdf(opts, expectedPageCount);

  console.log(`HTML 이력서: ${opts.htmlPath}`);
  console.log(`PDF 이력서: ${opts.pdfPath}`);
  console.log(`PDF 페이지: ${renderedPageCount}쪽`);
  console.log('외부 제출 자동화: 실행하지 않음');
}

function showHelp(): void {
  console.log(`이력서 export helper

Usage:
  bun career-os/.claude/skills/resume-preparer/scripts/export_resume.ts \
    --application-dir career-os/applications/<company>/<role>

Options:
  --resume <path>       Markdown 원본. 기본값: <application-dir>/evidence/resume-draft.md
  --design <path>       CSS 또는 css 코드 블록이 있는 Markdown. 기본값: resume-preparer/assets/resume.css
  --html <path>         HTML 출력. 기본값: <application-dir>/review/resume.html
  --pdf <path>          PDF 출력. 기본값: <application-dir>/resume.pdf
  --chrome-bin <path>   Chrome/Chromium binary. 기본값: CHROME_BIN 또는 common system paths

경력기술서는 같은 규칙을 플래그로 지정한다.
  --resume <application-dir>/evidence/career-description-draft.md
  --html <application-dir>/review/career-description.html
  --pdf <application-dir>/career-description.pdf
`);
}

if (import.meta.main) main();
