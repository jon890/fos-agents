#!/usr/bin/env node
// 포지션 추천 JSON에서 Discord 첨부용 HTML 미리보기를 생성한다.
// 전체 report.html은 render_recommendation.ts가 담당하고, 이 파일은 후보 링크 중심 preview 전용이다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { RecommendationRun, type RecommendationRunType, type PositionItemType } from "./recommendation_schema.ts";

type PreviewTier = "강력 추천" | "도전 추천" | "보류·주의" | "전체 후보";

interface PreviewRow {
  tier: PreviewTier;
  company: string;
  title: string;
  url: string;
  why: string;
  keywords: string[];
}

export interface CandidatePreviewOptions {
  limit?: number | null;
  title?: string;
  postingsMarkdown?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function positionRow(tier: PreviewTier, item: PositionItemType): PreviewRow {
  return {
    tier,
    company: item.company,
    title: item.title,
    url: item.postingUrl,
    why: item.whyFit,
    keywords: item.searchKeywords,
  };
}

function rowsFromRun(run: RecommendationRunType): PreviewRow[] {
  return [
    ...run.tiers.strong.map((item) => positionRow("강력 추천", item)),
    ...run.tiers.stretch.map((item) => positionRow("도전 추천", item)),
    ...run.tiers.hold
      .filter((item) => item.link && item.link !== "-")
      .map((item) => ({
        tier: "보류·주의" as const,
        company: item.company,
        title: item.title,
        url: item.link,
        why: item.reason,
        keywords: ["보류", "확인 필요"],
      })),
  ];
}

function parseLivePostingRows(markdown: string): PreviewRow[] {
  const rows: PreviewRow[] = [];
  let current: { company: string; title: string; fields: Record<string, string>; raw: string[] } | null = null;

  function flush(): void {
    if (!current) return;
    const status = (current.fields.posting_status ?? "").toLowerCase();
    const linkType = (current.fields.link_type ?? "").toLowerCase();
    const url = current.fields.url ?? "";
    if ((status === "active" || status === "open") && linkType === "direct_posting" && url && !isExcludedPreviewPosting(current)) {
      const skills = splitCsv(current.fields.skills ?? "").slice(0, 8);
      const why = summarizeText(firstNonEmpty([
        current.fields.main_tasks,
        current.fields.requirements,
        current.fields.preferred,
        "개별 active/open 공고로 수집된 전체 후보입니다.",
      ]));
      rows.push({
        tier: "전체 후보",
        company: current.company,
        title: current.title,
        url,
        why,
        keywords: skills.length > 0 ? skills : [current.fields.source ?? "수집 공고"],
      });
    }
    current = null;
  }

  for (const line of markdown.split(/\r?\n/)) {
    const header = line.match(/^- \[([^\]]+)\] (.+)$/);
    if (header) {
      flush();
      current = { company: header[1].trim(), title: header[2].trim(), fields: {}, raw: [line] };
      continue;
    }
    if (!current) continue;
    current.raw.push(line);
    const field = line.trim().match(/^- ([a-zA-Z0-9_]+):\s*(.*)$/);
    if (field) current.fields[field[1]] = field[2].trim();
  }
  flush();
  return rows;
}

function splitCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function firstNonEmpty(values: Array<string | undefined>): string {
  return values.find((value) => value && value.trim())?.trim() ?? "개별 active/open 공고로 수집된 전체 후보입니다.";
}

function summarizeText(value: string, maxLength = 260): string {
  const sanitized = value.replace(/CTO/g, "기술 조직").replace(/\s+/g, " ").trim();
  if (sanitized.length <= maxLength) return sanitized;
  return `${sanitized.slice(0, maxLength - 1)}…`;
}

function isExcludedPreviewPosting(posting: { company: string; title: string; fields: Record<string, string>; raw: string[] }): boolean {
  const text = [posting.company, posting.title, ...Object.values(posting.fields), ...posting.raw].join(" ").toLowerCase();
  if (/cto|chief technology officer|기술\s*총괄|기술총괄/.test(text)) return true;
  if (/tech\s*lead|server\s*lead|technical\s*lead|테크\s*리드|기술\s*리드/.test(text)) return true;
  if (/ai engineer\s*\(model\)|ai\s*model\s*research|model\s*research|research\s*scientist|applied\s*scientist|ai\s*research|모델\s*연구/.test(text)) return true;

  const company = posting.company.toLowerCase();
  const title = posting.title.toLowerCase();
  const isTossRootCompany = company === "토스" || company === "toss";
  const isGenericTossServer = /^server developer(?:\s*\([^)]+\)|\s*\[[^\]]+\].*)?$/i.test(posting.title.trim());
  if (isTossRootCompany && isGenericTossServer) return true;
  return false;
}

function applyLimit(rows: PreviewRow[], limit: number | null | undefined): PreviewRow[] {
  if (limit == null) return rows;
  return rows.slice(0, Math.max(1, limit));
}

function badgeClass(tier: PreviewTier): string {
  if (tier === "강력 추천") return "strong";
  if (tier === "도전 추천") return "stretch";
  if (tier === "보류·주의") return "hold";
  return "all";
}

function codeList(values: string[]): string {
  return values.map((value) => `<code>${escapeHtml(value)}</code>`).join(" ");
}

export function renderCandidatePreviewHtml(run: RecommendationRunType, options: CandidatePreviewOptions = {}): string {
  const effectiveLimit = options.limit === undefined ? 10 : options.limit;
  const rows = applyLimit(options.postingsMarkdown ? parseLivePostingRows(options.postingsMarkdown) : rowsFromRun(run), effectiveLimit);
  const title = options.title ?? `${run.reportDate} 포지션 추천 미리보기`;
  const rowHtml = rows
    .map(
      (row, index) => `<tr>
  <td class="rank">${index + 1}</td>
  <td><span class="badge ${badgeClass(row.tier)}">${escapeHtml(row.tier)}</span></td>
  <td>
    <a class="title" href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.company)} — ${escapeHtml(row.title)}</a>
    <div class="url">${escapeHtml(row.url)}</div>
  </td>
  <td class="keywords">${codeList(row.keywords)}</td>
  <td class="note">${escapeHtml(row.why)}</td>
</tr>`,
    )
    .join("\n");

  const conclusion = run.conclusion.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #172033; background: #f7f8fb; }
    main { max-width: 1180px; margin: 32px auto; background: white; padding: 32px; border-radius: 18px; box-shadow: 0 10px 30px rgba(20,30,60,.08); }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .meta { color: #667085; margin-bottom: 20px; line-height: 1.55; }
    .conclusion { background: #f6f8fb; border: 1px solid #e6e8ef; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; }
    .conclusion ul { margin: 0; padding-left: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 12px 10px; border-bottom: 1px solid #e6e8ef; vertical-align: top; }
    th { text-align: left; background: #f1f4f9; color: #344054; position: sticky; top: 0; }
    .rank { width: 44px; text-align: right; color: #667085; font-variant-numeric: tabular-nums; }
    .title { font-weight: 750; color: #155eef; text-decoration: none; }
    .title:hover { text-decoration: underline; }
    .url { margin-top: 5px; color: #667085; font-size: 12px; overflow-wrap: anywhere; }
    .note { color: #344054; line-height: 1.55; min-width: 260px; }
    .keywords code { display: inline-block; margin: 0 4px 4px 0; padding: 2px 6px; border-radius: 999px; background: #eef4ff; color: #3538cd; font-size: 12px; }
    .badge { display: inline-block; min-width: 64px; text-align: center; border-radius: 999px; padding: 4px 8px; font-size: 12px; font-weight: 700; }
    .badge.strong { background: #ecfdf3; color: #027a48; }
    .badge.stretch { background: #eff8ff; color: #175cd3; }
    .badge.hold { background: #fff7ed; color: #b54708; }
    .badge.all { background: #f2f4f7; color: #344054; }
  </style>
</head>
<body>
<main>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">생성일: ${escapeHtml(run.reportDate)} · 공고명을 클릭하면 개별 공고 페이지로 이동합니다. · 표시 후보 ${rows.length}개</div>
  <section class="conclusion"><ul>${conclusion}</ul></section>
  <table>
    <thead><tr><th class="rank">순위</th><th>구분</th><th>공고 링크</th><th>키워드</th><th>핵심 판단</th></tr></thead>
    <tbody>
${rowHtml}
    </tbody>
  </table>
</main>
</body>
</html>
`;
}

function usage(): never {
  console.error("usage: render_candidate_preview.ts --input <recommendation.json> --output <preview.html> [--limit N|all] [--title <title>] [--postings <live-position-postings.md>]");
  process.exit(2);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let input = "";
  let output = "";
  let limit: number | null = 10;
  let title = "";
  let postings = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input") input = args[++i] ?? "";
    else if (args[i] === "--output") output = args[++i] ?? "";
    else if (args[i] === "--limit") {
      const value = args[++i] ?? "10";
      limit = value === "all" ? null : Number(value) || 10;
    }
    else if (args[i] === "--title") title = args[++i] ?? "";
    else if (args[i] === "--postings") postings = args[++i] ?? "";
  }
  if (!input || !output) usage();

  const raw = JSON.parse(readFileSync(resolve(input), "utf-8"));
  const parsed = RecommendationRun.safeParse(raw);
  if (!parsed.success) {
    console.error("recommendation.json schema 검증 실패:");
    for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    process.exit(1);
  }

  const postingsMarkdown = postings ? readFileSync(resolve(postings), "utf-8") : undefined;
  const html = renderCandidatePreviewHtml(parsed.data, { limit, title: title || undefined, postingsMarkdown });
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(resolve(output), html, "utf-8");
  console.log(`candidate preview html: ${resolve(output)}`);
}
