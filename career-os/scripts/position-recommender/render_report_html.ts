#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMarkdown(value: string): string {
  const links: string[] = [];
  let out = value.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_match, label, href) => {
    const token = `\u0000LINK${links.length}\u0000`;
    links.push(`<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`);
    return token;
  });
  out = escapeHtml(out);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  for (let i = 0; i < links.length; i++) {
    out = out.replace(`\u0000LINK${i}\u0000`, links[i]);
  }
  return out;
}

function closeLists(html: string[], listStack: string[]): void {
  while (listStack.length > 0) {
    html.push(`</${listStack.pop()}>`);
  }
}

function renderMarkdown(markdown: string): string {
  const html: string[] = [];
  const listStack: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        closeLists(html, listStack);
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }
    if (!line.trim()) {
      closeLists(html, listStack);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeLists(html, listStack);
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const ordered = line.match(/^(\d+)\.\s+(.+)$/);
    if (ordered) {
      if (listStack[listStack.length - 1] !== "ol") {
        closeLists(html, listStack);
        listStack.push("ol");
        html.push("<ol>");
      }
      html.push(`<li>${inlineMarkdown(ordered[2])}</li>`);
      continue;
    }

    const unordered = line.match(/^-\s+(.+)$/);
    if (unordered) {
      if (listStack[listStack.length - 1] !== "ul") {
        closeLists(html, listStack);
        listStack.push("ul");
        html.push("<ul>");
      }
      html.push(`<li>${inlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    closeLists(html, listStack);
    html.push(`<p>${inlineMarkdown(line.trim())}</p>`);
  }

  closeLists(html, listStack);
  return html.join("\n");
}

function renderHtml(markdown: string): string {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? "Position Recommendation";
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fa;
      --panel: #ffffff;
      --text: #1b1f24;
      --muted: #58606a;
      --line: #d8dee4;
      --accent: #0a66c2;
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.62;
    }
    main {
      max-width: 920px;
      margin: 0 auto;
      padding: 32px 18px 56px;
    }
    article {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 28px;
    }
    h1, h2, h3 { line-height: 1.28; letter-spacing: 0; }
    h1 { margin: 0 0 20px; font-size: 28px; }
    h2 { margin: 32px 0 12px; padding-top: 18px; border-top: 1px solid var(--line); font-size: 21px; }
    h3 { margin: 24px 0 10px; font-size: 17px; }
    p, ul, ol { margin: 10px 0; }
    li { margin: 6px 0; }
    a { color: var(--accent); word-break: break-all; }
    code {
      padding: 2px 5px;
      border-radius: 5px;
      background: #eef2f6;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.92em;
    }
    pre {
      overflow-x: auto;
      padding: 14px;
      border-radius: 8px;
      background: #111827;
      color: #f9fafb;
    }
    @media (max-width: 640px) {
      main { padding: 16px 10px 36px; }
      article { padding: 18px; }
      h1 { font-size: 23px; }
      h2 { font-size: 19px; }
    }
  </style>
</head>
<body>
  <main>
    <article>
${renderMarkdown(markdown)}
    </article>
  </main>
</body>
</html>
`;
}

function usage(): never {
  console.error("usage: render_report_html.ts --input <report.md> --output <report.html>");
  process.exit(2);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let input = "";
  let output = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input") input = args[++i] ?? "";
    else if (args[i] === "--output") output = args[++i] ?? "";
  }
  if (!input || !output) usage();

  const markdown = readFileSync(resolve(input), "utf-8");
  const html = renderHtml(markdown);
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(resolve(output), html, "utf-8");
  console.log(`HTML position report: ${resolve(output)}`);
}
