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

const DEFAULT_APPLICATION_DIR = 'data/applications/tossplace/applied-ai-engineer';
const DEFAULT_DESIGN_PATH = 'config/resume-design.md';

function parseArgs(args: string[]): Options {
  let applicationDir = DEFAULT_APPLICATION_DIR;
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
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
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
      html.push(`<h${level}>${inlineMarkdown(heading[2].trim())}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      if (list !== 'ul') {
        closeList();
        list = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${inlineMarkdown(unordered[1].trim())}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      if (list !== 'ol') {
        closeList();
        list = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${inlineMarkdown(ordered[1].trim())}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inlineMarkdown(line.trim())}</p>`);
  }

  closeList();
  return html.join('\n');
}

function extractCss(designMarkdown: string): string {
  const match = designMarkdown.match(/```css\s*([\s\S]*?)```/);
  if (match?.[1]?.trim()) return match[1].trim();

  return `
@page { size: A4; margin: 14mm; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif; color: #18181b; line-height: 1.45; }
main { max-width: 760px; margin: 0 auto; }
h1 { font-size: 24pt; margin: 0 0 8px; }
h2 { font-size: 12pt; margin: 18px 0 8px; border-bottom: 1px solid #d4d4d8; color: #047857; }
li { margin: 3px 0; }
`;
}

function renderHtml(resumeMarkdown: string, designMarkdown: string, opts: Options): string {
  const css = extractCss(designMarkdown);
  const body = renderMarkdown(resumeMarkdown);
  const generatedAt = new Date().toISOString();

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Resume</title>
  <style>
${css}
  </style>
</head>
<body>
  <main>
    <div class="resume-meta">Generated: ${escapeHtml(generatedAt)} · Source: ${escapeHtml(opts.resumePath)} · Design: ${escapeHtml(opts.designPath)}</div>
${body}
    <section class="design-note" aria-hidden="true">
      <h2>Design Contract</h2>
      <pre>${escapeHtml(designMarkdown)}</pre>
    </section>
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
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
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
  const html = renderHtml(resumeMarkdown, designMarkdown, opts);

  writeHtml(opts.htmlPath, html);
  renderPdf(opts);

  console.log(`html: ${opts.htmlPath}`);
  console.log(`pdf: ${opts.pdfPath}`);
  console.log('external submission automation: not performed');
}

function showHelp(): void {
  console.log(`Resume export helper

Usage:
  bun scripts/application-agent/export_resume.ts --application-dir data/applications/<company>/<role>

Options:
  --resume <path>       Markdown source. Default: <application-dir>/resume-draft.md
  --design <path>       design.md source. Default: <application-dir>/design.md, fallback config/resume-design.md
  --html <path>         HTML output. Default: <application-dir>/resume.html
  --pdf <path>          PDF output. Default: <application-dir>/resume.pdf
  --chrome-bin <path>   Chrome/Chromium binary. Default: CHROME_BIN or common system paths
`);
}

main();
