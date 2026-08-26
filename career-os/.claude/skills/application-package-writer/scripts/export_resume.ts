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

const CAREER_OS_ROOT = resolve(import.meta.dir, '../../../..');
const DEFAULT_DESIGN_PATH = join(CAREER_OS_ROOT, 'config/resume-design.md');
export const CHROME_PDF_FLAGS = [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--no-pdf-header-footer',
] as const;

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

  resumePath = resumePath || join(applicationDir, 'resume-draft.md');
  designPath = designPath || resolveDesignPath(applicationDir);
  htmlPath = htmlPath || join(applicationDir, 'resume.html');
  pdfPath = pdfPath || join(applicationDir, 'resume.pdf');
  chromeBin = chromeBin || resolveChromeBin();

  return { applicationDir, resumePath, designPath, htmlPath, pdfPath, chromeBin };
}

function resolveDesignPath(applicationDir: string): string {
  const localDesign = join(applicationDir, 'design.md');
  return existsSync(localDesign) ? localDesign : DEFAULT_DESIGN_PATH;
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

export function renderMarkdownPages(markdown: string): [string, string] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const pages: [string[], string[]] = [[], []];
  let pageIndex: 0 | 1 = 0;
  let list: 'ul' | 'ol' | null = null;
  let sectionOpen = false;

  const html = () => pages[pageIndex];

  const closeList = () => {
    if (list) {
      html().push(`</${list}>`);
      list = null;
    }
  };

  const closeSection = () => {
    closeList();
    if (sectionOpen) {
      html().push('</section>');
      sectionOpen = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const title = heading[2].trim();
      if (level === 2) {
        closeSection();
        const id = sectionId(title);
        if (pageIndex === 0 && (id === 'career' || id === 'skills')) pageIndex = 1;
        html().push(id ? `<section id="${id}">` : '<section>');
        sectionOpen = true;
      }
      html().push(`<h${level}>${inlineMarkdown(title)}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      if (list !== 'ul') {
        closeList();
        list = 'ul';
        html().push('<ul>');
      }
      html().push(`<li>${inlineMarkdown(unordered[1].trim())}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      if (list !== 'ol') {
        closeList();
        list = 'ol';
        html().push('<ol>');
      }
      html().push(`<li>${inlineMarkdown(ordered[1].trim())}</li>`);
      continue;
    }

    closeList();
    html().push(`<p>${inlineMarkdown(line.trim())}</p>`);
  }

  closeSection();
  return [pages[0].join('\n'), pages[1].join('\n')];
}

function extractCss(designMarkdown: string): string {
  const match = designMarkdown.match(/```css\s*([\s\S]*?)```/);
  if (match?.[1]?.trim()) return match[1].trim();

  return `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif; color: #18181b; line-height: 1.45; }
.resume-page { max-width: 760px; min-height: 267mm; margin: 0 auto; }
.resume-page + .resume-page { margin-top: 28px; padding-top: 28px; border-top: 1px solid #d4d4d8; }
h1 { font-size: 24pt; margin: 0 0 8px; }
h2 { font-size: 12pt; margin: 18px 0 8px; border-bottom: 1px solid #d4d4d8; color: #047857; }
li { margin: 3px 0; }
@media print {
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { padding: 0; }
  .resume-page { min-height: auto; break-after: page; page-break-after: always; }
  .resume-page:last-child { break-after: auto; page-break-after: auto; }
  .resume-page + .resume-page { margin-top: 0; padding-top: 0; border-top: 0; }
}
`;
}

export function renderHtml(resumeMarkdown: string, designMarkdown: string): string {
  const css = extractCss(designMarkdown);
  const [firstPage, secondPage] = renderMarkdownPages(resumeMarkdown);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>이력서</title>
  <style>
${css}
  </style>
</head>
<body>
  <main class="resume-page">
${firstPage}
  </main>
  <main class="resume-page">
${secondPage}
  </main>
</body>
</html>
`;
}

function writeHtml(path: string, html: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, html, 'utf-8');
}

function renderPdf(opts: Options): void {
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
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const resumeMarkdown = readRequired(opts.resumePath);
  const designMarkdown = readRequired(opts.designPath);
  const html = renderHtml(resumeMarkdown, designMarkdown);

  writeHtml(opts.htmlPath, html);
  renderPdf(opts);

  console.log(`HTML 이력서: ${opts.htmlPath}`);
  console.log(`PDF 이력서: ${opts.pdfPath}`);
  console.log('외부 제출 자동화: 실행하지 않음');
}

function showHelp(): void {
  console.log(`이력서 export helper

Usage:
  bun career-os/.claude/skills/application-package-writer/scripts/export_resume.ts \
    --application-dir career-os/applications/<company>/<role>

Options:
  --resume <path>       Markdown 원본. 기본값: <application-dir>/resume-draft.md
  --design <path>       design.md 원본. 기본값: <application-dir>/design.md, fallback config/resume-design.md
  --html <path>         HTML 출력. 기본값: <application-dir>/resume.html
  --pdf <path>          PDF 출력. 기본값: <application-dir>/resume.pdf
  --chrome-bin <path>   Chrome/Chromium binary. 기본값: CHROME_BIN 또는 common system paths
`);
}

if (import.meta.main) main();
