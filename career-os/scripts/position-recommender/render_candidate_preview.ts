#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadPostingCandidatePool } from "./live-postings/candidate_pool.ts";
import type { PostingCandidatePool } from "./live-postings/contracts.ts";
import { RecommendationRun, type PositionItemType, type RecommendationRunType } from "./recommendation_schema.ts";
import { validateRecommendationAgainstPool } from "./validate_recommendation.ts";

type PreviewTier = "강력 추천" | "도전 추천" | "보류·주의" | "전체 후보";

interface PreviewRow {
  rank: number;
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
    rank: item.rank,
    tier,
    company: item.company,
    title: item.title,
    url: item.postingUrl,
    why: item.whyFit,
    keywords: item.jdKeywords,
  };
}

function recommendationRows(run: RecommendationRunType): PreviewRow[] {
  const selected = [
    ...run.tiers.strong.map((item) => positionRow("강력 추천", item)),
    ...run.tiers.stretch.map((item) => positionRow("도전 추천", item)),
  ];
  const nextRank = selected.reduce((highest, item) => Math.max(highest, item.rank), 0) + 1;
  return [
    ...selected,
    ...run.tiers.hold.filter((item) => item.link !== "-").map((item, index) => ({
      rank: nextRank + index,
      tier: "보류·주의" as const,
      company: item.company,
      title: item.title,
      url: item.link,
      why: item.reason,
      keywords: ["보류"],
    })),
  ].sort((a, b) => a.rank - b.rank);
}

function candidateRows(pool: PostingCandidatePool, run: RecommendationRunType): PreviewRow[] {
  const byId = new Map(pool.candidates.map((candidate) => [candidate.id, candidate]));
  return run.candidateRanking
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .flatMap((ranking) => {
      const candidate = byId.get(ranking.candidateId);
      if (!candidate) return [];
      return [{
        rank: ranking.rank,
        tier: "전체 후보" as const,
        company: candidate.company,
        title: candidate.title,
        url: candidate.url,
        why: ranking.oneLineReason,
        keywords: candidate.skills.length > 0 ? candidate.skills.slice(0, 8) : ["기술 정보 없음"],
      }];
    });
}

function applyLimit(rows: PreviewRow[], limit: number | null | undefined): PreviewRow[] {
  return limit == null ? rows : rows.slice(0, Math.max(1, limit));
}

function tierClass(tier: PreviewTier): string {
  if (tier === "강력 추천") return "tier-strong";
  if (tier === "도전 추천") return "tier-stretch";
  if (tier === "보류·주의") return "tier-hold";
  return "tier-all";
}

function renderChips(row: PreviewRow, limit = 5): string {
  return `<div class="chips">${row.keywords.slice(0, limit).map((keyword) => `<span class="chip">${escapeHtml(keyword)}</span>`).join("")}</div>`;
}

function formatCollectedAt(value: string): { short: string; full: string } {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { short: "확인 필요", full: "확인 필요" };
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((item) => item.type === type)?.value ?? "";
  return {
    short: `${part("month")}.${part("day")} ${part("hour")}:${part("minute")}`,
    full: `${part("year")}.${part("month")}.${part("day")} ${part("hour")}:${part("minute")} KST`,
  };
}

function renderCandidateArchive(rows: PreviewRow[]): string {
  const candidates = rows.map((row) => `<article class="candidate-row" data-search="${escapeHtml([row.company, row.title, row.why, ...row.keywords].join(" ").toLowerCase())}">
  <span class="candidate-rank">${row.rank}</span>
  <div class="candidate-copy"><a href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.company)} — ${escapeHtml(row.title)}</a><p>${escapeHtml(row.why)}</p></div>
  ${renderChips(row, 4)}
</article>`).join("\n");
  return `<details class="archive"><summary><span><span class="archive-title">전체 후보 적합도 순위 ${rows.length}건</span><span class="archive-note">LLM의 한 줄 판단과 함께 필요할 때 펼쳐보세요.</span></span></summary>
  <div class="candidate-search"><label for="candidate-filter">회사, 공고명, 기술이나 판단 검색</label><input id="candidate-filter" type="search" placeholder="예: 카카오, Spring, AI Platform" autocomplete="off"><p id="filter-status" aria-live="polite">전체 ${rows.length}건</p><div class="quick-filters" aria-label="빠른 필터"><button type="button" data-filter="" aria-pressed="true">전체</button><button type="button" data-filter="ai|rag|agent|llm" aria-pressed="false">AI·RAG</button><button type="button" data-filter="java|spring" aria-pressed="false">Java·Spring</button><button type="button" data-filter="platform|플랫폼" aria-pressed="false">플랫폼</button><button type="button" data-filter="kotlin" aria-pressed="false">Kotlin</button></div></div>
  <div class="candidate-list">${candidates}</div></details>`;
}

function candidateFilterScript(): string {
  return `<script>
const filter = document.querySelector('#candidate-filter');
const rows = [...document.querySelectorAll('.candidate-row')];
const status = document.querySelector('#filter-status');
const buttons = [...document.querySelectorAll('.quick-filters button')];
let activeTerms = [];
const updateCandidates = () => {
  const query = filter?.value.trim().toLowerCase() ?? '';
  let visible = 0;
  for (const row of rows) {
    const text = row.dataset.search ?? '';
    const matchesQuery = !query || text.includes(query);
    const matchesFilter = activeTerms.length === 0 || activeTerms.some((term) => text.includes(term));
    row.hidden = !(matchesQuery && matchesFilter);
    if (!row.hidden) visible += 1;
  }
  if (status) status.textContent = query || activeTerms.length ? visible + '건 검색됨' : '전체 ' + rows.length + '건';
};
filter?.addEventListener('input', updateCandidates);
for (const button of buttons) button.addEventListener('click', () => {
  activeTerms = button.dataset.filter ? button.dataset.filter.split('|') : [];
  for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
  updateCandidates();
});
</script>`;
}

export function renderCandidatePreviewHtml(
  run: RecommendationRunType,
  options: CandidatePreviewOptions = {},
): string {
  const limit = options.limit === undefined ? 10 : options.limit;
  const recommended = recommendationRows(run);
  const candidates = options.candidatePool ? applyLimit(candidateRows(options.candidatePool, run), limit) : [];
  const title = options.title ?? `${run.reportDate} 포지션 추천`;
  const strong = recommended.filter((row) => row.tier === "강력 추천");
  const stretch = recommended.filter((row) => row.tier === "도전 추천");
  const prioritized = recommended.filter((row) => row.tier === "강력 추천" || row.tier === "도전 추천");
  const featured = prioritized.slice(0, 3);
  const additionalRecommended = prioritized.slice(3);
  const holds = recommended.filter((row) => row.tier === "보류·주의");
  const recommendationCount = prioritized.length;
  const collectionRunId = options.candidatePool?.collectionRunId ?? run.sourceSnapshot.collectionRunId;
  const collected = formatCollectedAt(options.candidatePool?.collectedAt ?? run.generatedAt);
  const runType = collectionRunId.match(/^(.+?)-\d{4}-\d{2}-\d{2}T/)?.[1] ?? "position-postings";
  const conclusions = run.conclusion.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const renderBoardRows = (rows: PreviewRow[]): string => rows.map((row) => `<article class="board-row ${tierClass(row.tier)}"><span class="board-rank">${row.rank}</span><span class="tier-label">${escapeHtml(row.tier)}</span><div class="board-copy"><p>${escapeHtml(row.company)}</p><h3><a href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.title)}</a></h3><span>${escapeHtml(row.why)}</span></div>${renderChips(row, 3)}</article>`).join("");
  const heroCards = featured.length > 0
    ? featured.map((row) => `<article class="hero-card ${tierClass(row.tier)}"><div class="hero-rank">${row.rank}</div><span class="tier-label">${escapeHtml(row.tier)}</span><p class="company">${escapeHtml(row.company)}</p><h3>${escapeHtml(row.title)}</h3><p class="rationale">${escapeHtml(row.why)}</p>${renderChips(row)}<a href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">공고 열기 ↗</a></article>`).join("")
    : `<p class="empty-state">오늘 기준을 통과한 추천 공고가 없습니다.</p>`;
  const additionalSection = additionalRecommended.length > 0
    ? `<div class="section-head"><h2>추가 추천</h2><span class="count">${additionalRecommended.length}건</span></div><section class="board additional-recommendations">${renderBoardRows(additionalRecommended)}</section>`
    : "";
  const holdSection = holds.length > 0
    ? `<div class="section-head"><h2>보류·주의</h2><span class="count">${holds.length}건</span></div><section class="board hold-recommendations">${renderBoardRows(holds)}</section>`
    : "";
  const archive = options.candidatePool ? renderCandidateArchive(candidates) : "";
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>
:root{color-scheme:light;--paper:#f4f7fa;--surface:#fff;--ink:#162033;--muted:#667085;--line:#dce3ea;--strong:#087a4b;--strong-soft:#eaf7f0;--stretch:#2457c5;--stretch-soft:#edf3ff;--hold:#9a5b13;--hold-soft:#fff5e8}*{box-sizing:border-box}html{background:var(--paper)}body{margin:0;color:var(--ink);background:var(--paper);font-family:"Pretendard Variable",Pretendard,"Apple SD Gothic Neo",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;line-height:1.62;word-break:keep-all}a{color:inherit;overflow-wrap:anywhere}a:focus-visible,summary:focus-visible,input:focus-visible,button:focus-visible{outline:3px solid #84adff;outline-offset:3px}.shell{width:min(100% - 32px,1080px);margin:0 auto;padding:28px 0 64px}h1,h2,h3,p{overflow-wrap:anywhere}h1{margin:0;font-size:clamp(29px,5vw,48px);line-height:1.08;letter-spacing:-.035em}h2{margin:0;font-size:clamp(22px,3vw,30px);line-height:1.2;letter-spacing:-.025em}h3{margin:0;font-size:18px;line-height:1.38;letter-spacing:-.012em}.eyebrow{margin:0 0 8px;color:var(--stretch);font:760 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}.masthead{padding:10px 0 26px;border-bottom:1px solid #aeb8c5}.masthead-top{display:flex;align-items:start;justify-content:space-between;gap:28px}.title-line{display:flex;align-items:center;gap:16px}.recommendation-count{display:inline-flex;align-items:baseline;gap:7px;flex:none;padding-left:14px;border-left:3px solid var(--strong);color:var(--strong);font-size:13px;font-weight:800;white-space:nowrap}.recommendation-count strong{font:840 28px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.meta-group{flex:none;text-align:right}.compact-meta{display:flex;justify-content:end;gap:6px 12px;margin:6px 0 0;color:var(--muted);font-size:14px}.compact-meta span+span:before{content:"·";margin-right:12px;color:#a6b0bf}.provenance{margin-top:4px;color:var(--muted);font-size:12px}.provenance summary{display:inline-flex;align-items:center;min-height:32px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}.provenance>div{display:grid;justify-items:end;gap:3px}.conclusion{margin-top:24px}.conclusion ul{margin:0;padding-left:20px;columns:2;column-gap:36px;color:#3a475b}.section-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:44px 0 16px}.count{color:var(--muted);font-size:14px;white-space:nowrap}.priority-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.hero-card{position:relative;display:flex;flex-direction:column;min-height:360px;padding:20px;border:1px solid var(--line);border-top:4px solid var(--strong);background:var(--surface)}.hero-rank{position:absolute;top:16px;right:18px;color:#d6dce4;font:850 54px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.tier-label{display:inline-flex;align-items:center;min-height:26px;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:800;line-height:1}.tier-strong .tier-label{color:var(--strong);background:var(--strong-soft)}.tier-stretch .tier-label{color:var(--stretch);background:var(--stretch-soft)}.tier-hold .tier-label{color:var(--hold);background:var(--hold-soft)}.hero-card .tier-label{align-self:flex-start;position:relative}.company{margin:34px 0 3px;color:var(--muted);font-size:13px;font-weight:760}.rationale{flex:1;color:#3a475b}.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}.chip{max-width:100%;padding:3px 8px;border:1px solid var(--line);border-radius:6px;color:#455269;background:#f8fafc;font:650 12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.hero-card>a{display:flex;align-items:center;min-height:44px;margin-top:18px;font-weight:800;text-underline-offset:4px}.board{border-top:2px solid var(--ink)}.board-row{display:grid;grid-template-columns:42px 88px minmax(220px,1fr) minmax(180px,.7fr);gap:14px;align-items:center;padding:15px 4px;border-bottom:1px solid var(--line)}.board-rank{font:760 18px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.board-copy>p{margin:0;color:var(--muted);font-size:12px;font-weight:760}.board-copy h3{font-size:16px}.board-copy h3 a{display:inline-flex;align-items:center;min-height:44px;text-underline-offset:3px}.board-copy>span{display:block;margin-top:3px;color:#596579;font-size:13px}.board-row .chips{justify-content:end;margin:0}.archive{margin-top:48px;border:1px solid var(--line);border-radius:14px;background:var(--surface);overflow:clip}.archive>summary{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:72px;padding:16px 20px;cursor:pointer;list-style:none}.archive>summary::-webkit-details-marker{display:none}.archive>summary:after{content:"＋";color:var(--muted);font-size:24px}.archive[open]>summary:after{content:"−"}.archive-title{display:block;font-weight:820}.archive-note{display:block;color:var(--muted);font-size:13px;font-weight:500}.candidate-search{display:grid;grid-template-columns:1fr auto;gap:9px 12px;padding:16px 20px;border-top:1px solid var(--line);background:#f8fafc}.candidate-search label{grid-column:1/-1;font-size:13px;font-weight:760}.candidate-search input{width:100%;min-height:44px;padding:9px 12px;border:1px solid #b9c2cf;border-radius:8px;background:#fff;font:inherit}.candidate-search p{margin:0;align-self:center;color:var(--muted);font-size:13px}.quick-filters{display:flex;flex-wrap:wrap;gap:7px;grid-column:1/-1}.quick-filters button{min-height:36px;padding:6px 10px;border:1px solid #c7d0dc;border-radius:999px;color:#405069;background:#fff;font:700 12px/1.2 inherit;cursor:pointer}.quick-filters button[aria-pressed="true"]{border-color:var(--stretch);color:#fff;background:var(--stretch)}.candidate-list{border-top:1px solid var(--line)}.candidate-row{display:grid;grid-template-columns:42px minmax(260px,1fr) minmax(180px,.7fr);gap:14px;align-items:start;padding:15px 20px;border-bottom:1px solid #edf0f3}.candidate-row:last-child{border-bottom:0}.candidate-rank{padding-top:11px;color:var(--muted);font:760 15px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.candidate-copy a{display:flex;align-items:center;min-height:44px;font-weight:720;text-decoration-thickness:1px;text-underline-offset:3px}.candidate-copy p{margin:2px 0 0;color:#596579;font-size:13px}.candidate-row .chips{justify-content:end;margin:8px 0 0}@media(max-width:820px){.priority-grid{grid-template-columns:1fr}.hero-card{min-height:0}.conclusion ul{columns:1}.board-row{grid-template-columns:34px 82px 1fr}.board-row .chips{grid-column:3;justify-content:start}}@media(max-width:640px){.shell{width:min(100% - 24px,1080px);padding-top:20px}.masthead-top{display:block}.title-line{display:grid;gap:10px}.recommendation-count{justify-self:start;min-height:36px}.meta-group{margin-top:14px;text-align:left}.compact-meta{display:grid;justify-content:start;gap:2px;margin-top:0}.compact-meta span+span:before{content:none}.provenance>div{justify-items:start}.section-head{align-items:start;margin-top:36px}.section-head .count{white-space:normal;text-align:right}.board-row{grid-template-columns:30px 1fr}.board-row .tier-label{grid-column:2;justify-self:start}.board-row .board-copy,.board-row .chips{grid-column:2}.candidate-row{grid-template-columns:30px 1fr;gap:9px;padding:14px 16px}.candidate-row .chips{grid-column:2;justify-content:start}.archive>summary{padding:15px 16px}.candidate-search{grid-template-columns:1fr;padding:14px 16px}.candidate-search p{justify-self:start}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition:none!important}}
</style><style>.recommendation-count{align-items:center}.recommendation-label{display:inline-grid;gap:1px;line-height:1.15}.recommendation-label small{color:var(--muted);font-size:11px;font-weight:700}.hero-card.tier-stretch{border-top-color:var(--stretch)}.empty-state{grid-column:1/-1;margin:0;padding:24px;border:1px solid var(--line);background:var(--surface);color:var(--muted)}.candidate-row[hidden]{display:none}</style></head><body><main class="shell"><header class="masthead"><div class="masthead-top"><div><p class="eyebrow">POSITION RECOMMENDATION</p><div class="title-line"><h1>${escapeHtml(title)}</h1><span class="recommendation-count"><strong>${recommendationCount}</strong><span class="recommendation-label"><span>추천 공고</span><small>강력 ${strong.length} · 도전 ${stretch.length}</small></span></span></div></div><div class="meta-group"><p class="compact-meta"><span>${escapeHtml(run.reportDate.replace(/-/g, "."))} 생성</span><span>${escapeHtml(collected.short)} 수집</span></p><details class="provenance" data-run-id="${escapeHtml(collectionRunId)}"><summary>수집 정보</summary><div><span>${escapeHtml(collected.full)} 수집</span><span>${escapeHtml(runType)} 실행</span></div></details></div></div><section class="conclusion" aria-label="오늘의 추천 요약"><ul>${conclusions}</ul></section></header>
<div class="section-head"><h2>우선 검토</h2><span class="count">상위 ${featured.length}건</span></div><section class="priority-grid">${heroCards}</section>
${additionalSection}
${holdSection}
${archive}</main>${options.candidatePool ? candidateFilterScript() : ""}</body></html>`;
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
