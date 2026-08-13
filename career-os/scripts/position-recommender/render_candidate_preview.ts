#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadPostingCandidatePool } from "./live-postings/candidate_pool.ts";
import type { PostingCandidatePool } from "./live-postings/contracts.ts";
import { RecommendationRun, type PositionItemType, type RecommendationRunType } from "./recommendation_schema.ts";
import { validateRecommendationAgainstPool } from "./validate_recommendation.ts";

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
  candidatePool?: PostingCandidatePool;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function positionRow(tier: PreviewTier, item: PositionItemType): PreviewRow {
  return {
    tier,
    company: item.company,
    title: item.title,
    url: item.postingUrl,
    why: item.whyFit,
    keywords: item.jdKeywords,
  };
}

function recommendationRows(run: RecommendationRunType): PreviewRow[] {
  return [
    ...run.tiers.strong.map((item) => positionRow("강력 추천", item)),
    ...run.tiers.stretch.map((item) => positionRow("도전 추천", item)),
    ...run.tiers.hold.filter((item) => item.link !== "-").map((item) => ({
      tier: "보류·주의" as const,
      company: item.company,
      title: item.title,
      url: item.link,
      why: item.reason,
      keywords: ["보류"],
    })),
  ];
}

function candidateRows(pool: PostingCandidatePool, run: RecommendationRunType): PreviewRow[] {
  const opinions = new Map<string, string>([
    ...run.tiers.strong.map((item) => [item.candidateId, item.whyFit] as const),
    ...run.tiers.stretch.map((item) => [item.candidateId, `${item.whyFit} ${item.stretchGap}`] as const),
  ]);
  return pool.candidates.map((candidate) => ({
    tier: "전체 후보",
    company: candidate.company,
    title: candidate.title,
    url: candidate.url,
    why: opinions.get(candidate.id) ?? "추천 티어에 선정되지 않은 수집 후보입니다.",
    keywords: candidate.skills.length > 0 ? candidate.skills.slice(0, 8) : ["기술 정보 없음"],
  }));
}

function applyLimit(rows: PreviewRow[], limit: number | null | undefined): PreviewRow[] {
  return limit == null ? rows : rows.slice(0, Math.max(1, limit));
}

function badgeClass(tier: PreviewTier): string {
  if (tier === "강력 추천") return "strong";
  if (tier === "도전 추천") return "stretch";
  if (tier === "보류·주의") return "hold";
  return "all";
}

function renderTable(rows: PreviewRow[], showTier: boolean): string {
  const body = rows.map((row, index) => `<tr>
  <td class="rank">${index + 1}</td>
  ${showTier ? `<td><span class="badge ${badgeClass(row.tier)}">${escapeHtml(row.tier)}</span></td>` : ""}
  <td><a class="title" href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.company)} — ${escapeHtml(row.title)}</a><div class="url">${escapeHtml(row.url)}</div></td>
  <td>${row.keywords.map((keyword) => `<code>${escapeHtml(keyword)}</code>`).join(" ")}</td>
  <td class="note">${escapeHtml(row.why)}</td>
</tr>`).join("\n");
  return `<div class="table-scroll" tabindex="0"><table><thead><tr><th>순위</th>${showTier ? "<th>구분</th>" : ""}<th>공고 링크</th><th>기술</th><th>판단</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

export function renderCandidatePreviewHtml(
  run: RecommendationRunType,
  options: CandidatePreviewOptions = {},
): string {
  const limit = options.limit === undefined ? 10 : options.limit;
  const recommended = recommendationRows(run);
  const candidates = options.candidatePool ? applyLimit(candidateRows(options.candidatePool, run), limit) : [];
  const shown = options.candidatePool ? candidates : applyLimit(recommended, limit);
  const title = options.title ?? `${run.reportDate} 포지션 추천`;
  const collection = options.candidatePool
    ? `${options.candidatePool.collectedAt} · 실행 ${options.candidatePool.collectionRunId}`
    : "후보풀 정보 없음";
  const content = options.candidatePool
    ? `<h2>추천 공고 <span>${recommended.length}건</span></h2>${renderTable(recommended, true)}
       <h2>수집된 전체 후보 <span>${candidates.length}건</span></h2>
       <p class="section-note">고정 선호 키워드로 순위를 매기지 않은 외부 공고 후보풀입니다.</p>${renderTable(candidates, false)}`
    : renderTable(shown, true);
  const conclusions = run.conclusion.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>
body{margin:0;background:#f5f7fb;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1180px;margin:32px auto;padding:32px;background:#fff;border-radius:18px;box-shadow:0 10px 30px #14203c14}h1{margin:0 0 8px}h2{margin:32px 0 8px}h2 span{font-size:13px;color:#667085}.meta,.section-note{color:#667085;line-height:1.6}.conclusion{padding:14px 18px;background:#f6f8fb;border:1px solid #e6e8ef;border-radius:12px}.table-scroll{overflow-x:auto;border:1px solid #e6e8ef;border-radius:12px}table{width:100%;min-width:900px;border-collapse:collapse;font-size:14px}th,td{padding:12px 10px;border-bottom:1px solid #e6e8ef;vertical-align:top;text-align:left}th{background:#f1f4f9}.rank{width:44px;text-align:right;color:#667085}.title{font-weight:750;color:#155eef;text-decoration:none}.url{margin-top:5px;color:#667085;font-size:12px;overflow-wrap:anywhere}.note{min-width:260px;line-height:1.55}code{display:inline-block;margin:0 4px 4px 0;padding:2px 6px;border-radius:999px;background:#eef4ff;color:#3538cd}.badge{display:inline-block;padding:4px 8px;border-radius:999px;font-weight:700}.strong{background:#ecfdf3;color:#027a48}.stretch{background:#eff8ff;color:#175cd3}.hold{background:#fff7ed;color:#b54708}@media(max-width:720px){main{margin:0;padding:22px 16px;border-radius:0}.table-scroll{margin:0 -16px;width:calc(100% + 32px)}}
</style></head><body><main><h1>${escapeHtml(title)}</h1><p class="meta">생성일 ${escapeHtml(run.reportDate)} · 수집 기준 ${escapeHtml(collection)}</p><section class="conclusion"><ul>${conclusions}</ul></section>${content}</main></body></html>`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const value = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const input = value("--input");
  const output = value("--output");
  const candidates = value("--candidates");
  if (!input || !output || !candidates) {
    console.error("사용법: render_candidate_preview.ts --input <recommendation.json> --candidates <posting-candidates.json> --output <report.html> [--limit all|N]");
    process.exit(2);
  }
  const parsed = RecommendationRun.safeParse(JSON.parse(readFileSync(resolve(input), "utf8")) as unknown);
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => console.error(`${issue.path.join(".")}: ${issue.message}`));
    process.exit(1);
  }
  const pool = loadPostingCandidatePool(resolve(candidates));
  const errors = validateRecommendationAgainstPool(parsed.data, pool);
  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }
  const limitValue = value("--limit");
  const limit = limitValue === "all" ? null : limitValue ? Number(limitValue) : 10;
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(resolve(output), renderCandidatePreviewHtml(parsed.data, { candidatePool: pool, limit }), "utf8");
  console.log(`포지션 추천 HTML: ${resolve(output)}`);
}
