#!/usr/bin/env bun
// Interview preparation site collector.
// Supported modes intentionally exclude coffeechat; see ADR-048.
//
// usage: bun collect_interview_sites.ts [--mode <first-round|final-round|offer-chat>] [--outdir <dir>]
//   --mode default: first-round
//   --outdir default: career-os/data/source/<mode.source_dir>/

import { parseMvpTarget, type InterviewSite, type SupportedInterviewMode } from './mvp_target_schema';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const MVP_TARGET_PATH = join(REPO_ROOT, 'career-os/config/mvp-target.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 OpenClaw career-os interview-prep bot',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.7',
};

class TextExtractor {
  private meta: string[] = [];
  private skipTags = new Set(['script', 'style', 'noscript', 'svg']);
  private blockTags = new Set(['p', 'div', 'li', 'br', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'tr']);
  title = '';

  extract(html: string): string {
    const metaRe = /<meta\s+[^>]*(?:name|property)=["']([^"']+)["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
    const relevantMeta = new Set(['description', 'og:title', 'og:description', 'twitter:title', 'twitter:description']);
    for (const m of html.matchAll(metaRe)) {
      if (relevantMeta.has(m[1].toLowerCase())) this.meta.push(`${m[1]}: ${m[2]}`);
    }

    const metaRe2 = /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']([^"']+)["'][^>]*>/gi;
    for (const m of html.matchAll(metaRe2)) {
      if (relevantMeta.has(m[2].toLowerCase())) this.meta.push(`${m[2]}: ${m[1]}`);
    }

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) this.title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

    let stripped = html;
    for (const tag of this.skipTags) {
      stripped = stripped.replace(new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, 'gi'), ' ');
    }
    for (const tag of this.blockTags) {
      stripped = stripped.replace(new RegExp(`<\\/?${tag}[\\s>]`, 'gi'), '\n');
    }

    return stripped
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  }

  buildText(rawExtracted: string): string {
    const lines: string[] = [];
    for (const line of rawExtracted.split('\n')) {
      const trimmed = line.replace(/\s+/g, ' ').trim();
      if (trimmed) lines.push(trimmed);
    }

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

async function fetchSite(site: InterviewSite, outdir: string): Promise<FetchResult> {
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

function normalizeMode(rawMode: string): SupportedInterviewMode {
  const mode = rawMode.replace(/-/g, '_');
  const validModes: SupportedInterviewMode[] = ['first_round', 'final_round', 'offer_chat'];
  if (!validModes.includes(mode as SupportedInterviewMode)) {
    console.error(`Unknown mode: ${rawMode}. Supported: first-round, final-round, offer-chat`);
    process.exit(1);
  }
  return mode as SupportedInterviewMode;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outdirFlagIdx = args.indexOf('--outdir');
  const modeFlagIdx = args.indexOf('--mode');

  const mode = normalizeMode(modeFlagIdx >= 0 && args[modeFlagIdx + 1] ? args[modeFlagIdx + 1] : 'first-round');
  const mvpTarget = parseMvpTarget(MVP_TARGET_PATH);
  const target = mvpTarget.primary.interview?.[mode];

  if (!target) {
    console.error(`primary.interview.${mode} 설정 없음 in mvp-target.json`);
    process.exit(1);
  }

  const outdir =
    outdirFlagIdx >= 0 && args[outdirFlagIdx + 1]
      ? resolve(args[outdirFlagIdx + 1])
      : join(REPO_ROOT, `career-os/data/source/${target.source_dir}`);

  await mkdir(outdir, { recursive: true });

  const results: (FetchResult | { key: string; label: string; url: string; error: string })[] = [];
  let hasErrors = false;

  for (const site of target.sites) {
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

  process.exit(hasErrors ? 2 : 0);
}

main().catch((err) => {
  console.error('collect_interview_sites fatal:', err);
  process.exit(1);
});
