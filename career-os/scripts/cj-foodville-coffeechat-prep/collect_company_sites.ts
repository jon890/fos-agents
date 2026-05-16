#!/usr/bin/env bun
// 회사 사이트 자동 수집 — mvp-target.json `primary.coffeechat.sites` 배열 Read.
// HTML → text 추출. 회사 hard-coded URL 없음.
//
// usage: bun collect_company_sites.ts [--outdir <dir>]
//   default outdir: career-os/data/source/<coffeechat.source_dir>/

import { parseMvpTarget, type CoffeechatSite } from '../../../_shared/lib/mvp_target_schema';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const MVP_TARGET_PATH = join(REPO_ROOT, 'career-os/config/mvp-target.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 OpenClaw career-os interview-prep bot',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.7',
};

// Minimal HTML → text parser (port of Python TextExtractor)
class TextExtractor {
  private parts: string[] = [];
  private meta: string[] = [];
  private skipTags = new Set(['script', 'style', 'noscript', 'svg']);
  private blockTags = new Set(['p', 'div', 'li', 'br', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'tr']);
  title = '';

  extract(html: string): string {
    // Extract meta tags
    const metaRe = /<meta\s+[^>]*(?:name|property)=["']([^"']+)["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
    const relevantMeta = new Set(['description', 'og:title', 'og:description', 'twitter:title', 'twitter:description']);
    for (const m of html.matchAll(metaRe)) {
      if (relevantMeta.has(m[1].toLowerCase())) this.meta.push(`${m[1]}: ${m[2]}`);
    }
    // Also handle reversed attribute order
    const metaRe2 = /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']([^"']+)["'][^>]*>/gi;
    for (const m of html.matchAll(metaRe2)) {
      if (relevantMeta.has(m[2].toLowerCase())) this.meta.push(`${m[2]}: ${m[1]}`);
    }

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) this.title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

    // Strip skip-tag blocks first
    let stripped = html;
    for (const tag of this.skipTags) {
      stripped = stripped.replace(new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, 'gi'), ' ');
    }

    // Insert newlines around block tags
    for (const tag of this.blockTags) {
      stripped = stripped.replace(new RegExp(`<\\/?${tag}[\\s>]`, 'gi'), '\n');
    }

    // Strip all remaining tags
    stripped = stripped.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    stripped = stripped
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

    return stripped;
  }

  buildText(rawExtracted: string): string {
    const lines: string[] = [];
    for (const line of rawExtracted.split('\n')) {
      const trimmed = line.replace(/\s+/g, ' ').trim();
      if (trimmed) lines.push(trimmed);
    }
    // Remove consecutive duplicates (nav/menu markup artifact)
    const deduped: string[] = [];
    let prev = '';
    for (const line of lines) {
      if (line !== prev) deduped.push(line);
      prev = line;
    }
    return [...this.meta, '', ...deduped].join('\n');
  }
}

interface FetchResult {
  key: string;
  label: string;
  url: string;
  final_url: string;
  status: number;
  raw_path: string;
  text_path: string;
  text_chars: number;
  error?: string;
}

async function fetchSite(site: CoffeechatSite, outdir: string): Promise<FetchResult> {
  const resp = await fetch(site.url, { headers: HEADERS, redirect: 'follow' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);

  const html = await resp.text();
  const extractor = new TextExtractor();
  const rawText = extractor.extract(html);
  const body = extractor.buildText(rawText);

  const rawPath = join(outdir, `${site.key}.html`);
  const textPath = join(outdir, `${site.key}.txt`);

  const textContent = [
    `# ${site.label}`,
    `url: ${site.url}`,
    `final_url: ${resp.url}`,
    `status: ${resp.status}`,
    `fetched_at: ${new Date().toISOString()}`,
    `title: ${extractor.title}`,
    '',
    body,
    '',
  ].join('\n');

  await writeFile(rawPath, html, 'utf-8');
  await writeFile(textPath, textContent, 'utf-8');

  return {
    key: site.key,
    label: site.label,
    url: site.url,
    final_url: resp.url,
    status: resp.status,
    raw_path: rawPath,
    text_path: textPath,
    text_chars: body.length,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outdirFlagIdx = args.indexOf('--outdir');

  const mvpTarget = parseMvpTarget(MVP_TARGET_PATH);
  const { coffeechat } = mvpTarget.primary;

  if (!coffeechat) {
    console.error('PHASE_FAILED: mvp-target.json에 primary.coffeechat 설정 없음');
    process.exit(1);
  }

  const outdir =
    outdirFlagIdx >= 0 && args[outdirFlagIdx + 1]
      ? resolve(args[outdirFlagIdx + 1])
      : join(REPO_ROOT, `career-os/data/source/${coffeechat.source_dir}`);

  await mkdir(outdir, { recursive: true });

  const results: (FetchResult | { key: string; label: string; url: string; error: string })[] = [];
  let hasErrors = false;

  for (const site of coffeechat.sites) {
    try {
      const result = await fetchSite(site, outdir);
      results.push(result);
      console.error(`[OK] ${site.key}: ${result.text_chars} chars`);
    } catch (err) {
      hasErrors = true;
      const entry = { key: site.key, label: site.label, url: site.url, error: String(err) };
      results.push(entry);
      console.error(`[FAIL] ${site.key}: ${err}`);
    }
  }

  const manifestPath = join(outdir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(JSON.stringify(results, null, 2));

  // exit 0 = 전체 성공, exit 2 = 일부 실패 (Python 원본과 동일)
  process.exit(hasErrors ? 2 : 0);
}

main().catch((err) => {
  console.error('collect_company_sites fatal:', err);
  process.exit(1);
});
