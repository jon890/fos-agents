#!/usr/bin/env node
// 포지션 추천 JSON과 live posting snapshot에서 Discord 첨부용 전체 공고 HTML을 생성한다.
// 전체 report.html은 render_recommendation.ts가 담당하고, 이 파일은 공고 링크 중심 HTML 전용이다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

interface LivePostingCandidate {
  company: string;
  title: string;
  fields: Record<string, string>;
  raw: string[];
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

function recommendationOpinionByUrl(run: RecommendationRunType): Map<string, string> {
  const entries = [
    ...run.tiers.strong.map((item) => [item.postingUrl, item.whyFit] as const),
    ...run.tiers.stretch.map((item) => [item.postingUrl, `${item.whyFit} ${item.stretchGap}`] as const),
    ...run.tiers.hold.filter((item) => item.link && item.link !== "-").map((item) => [item.link, item.reason] as const),
  ];
  return new Map(entries.map(([url, opinion]) => [url, summarizeOpinion(opinion)]));
}

/**
 * config/position-filters.json 의 suppressedPostings URL 집합을 읽는다 (ADR-111).
 * 추천 시점 필터라 수집은 그대로 두고 전체 공고 HTML에서만 해당 URL을 숨긴다.
 * config를 못 읽으면 억제 없이 진행한다(HTML 생성 자체를 막지 않는다).
 */
let previewFilterCache: { suppressedUrls: Set<string>; excludedCompanies: Set<string> } | null = null;
function normalizeCompany(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

function loadPreviewFilters(): { suppressedUrls: Set<string>; excludedCompanies: Set<string> } {
  if (previewFilterCache) return previewFilterCache;
  const suppressedUrls = new Set<string>();
  const excludedCompanies = new Set<string>();
  try {
    const path = resolve(dirname(fileURLToPath(import.meta.url)), "../../config/position-filters.json");
    const config = JSON.parse(readFileSync(path, "utf8"));
    for (const item of config?.suppressedPostings ?? []) {
      if (item?.url) suppressedUrls.add(String(item.url));
    }
    for (const company of config?.excludedCompanies ?? []) excludedCompanies.add(normalizeCompany(String(company)));
  } catch (e) {
    console.error(`WARN position-filters config load failed, proceeding without posting suppression: ${e}`);
  }
  previewFilterCache = { suppressedUrls, excludedCompanies };
  return previewFilterCache;
}

function parseLivePostingRows(markdown: string, run: RecommendationRunType): PreviewRow[] {
  const rows: PreviewRow[] = [];
  let current: LivePostingCandidate | null = null;
  const opinionByUrl = recommendationOpinionByUrl(run);
  const { suppressedUrls, excludedCompanies } = loadPreviewFilters();

  function flush(): void {
    if (!current) return;
    const status = (current.fields.posting_status ?? "").toLowerCase();
    const linkType = (current.fields.link_type ?? "").toLowerCase();
    const url = current.fields.url ?? "";
    if ((status === "active" || status === "open") && linkType === "direct_posting" && url && !suppressedUrls.has(url) && !excludedCompanies.has(normalizeCompany(current.company)) && !isExcludedPreviewPosting(current)) {
      const skills = splitCsv(current.fields.skills ?? "").slice(0, 8);
      const why = opinionByUrl.get(url) ?? buildFallbackOpinion(current);
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
  return sortLivePreviewRows(rows);
}

function aiInterestScore(row: PreviewRow): number {
  const text = [row.company, row.title, row.why, ...row.keywords].join(" ").toLowerCase();
  const highSignals = ["rag", "vector", "벡터", "opensearch", "llm", "agent", "에이전트", "ax", "ai transformation", "ai 플랫폼", "ai platform", "llmops", "mlops", "model router", "gateway", "workflow", "tool calling"];
  const serverSignals = ["backend", "백엔드", "server", "서버", "spring", "java", "kotlin", "api", "platform", "플랫폼"];
  const researchOnlySignals = ["research scientist", "applied scientist", "model research", "모델 연구", "논문"];
  const high = highSignals.reduce((sum, signal) => sum + (text.includes(signal) ? 3 : 0), 0);
  const server = serverSignals.reduce((sum, signal) => sum + (text.includes(signal) ? 1 : 0), 0);
  const researchPenalty = researchOnlySignals.some((signal) => text.includes(signal)) ? 20 : 0;
  return high + Math.min(server, 4) - researchPenalty;
}

function companyScaleScore(company: string): number {
  const normalized = company.toLowerCase();
  const highScaleSignals = ["토스", "toss", "쿠팡", "coupang", "카카오", "kakao", "네이버", "naver", "크래프톤", "krafton", "컬리", "kurly", "cj올리브네트웍스", "cj one", "티맵", "tmap"];
  return highScaleSignals.some((signal) => normalized.includes(signal)) ? 10 : 0;
}

function sortLivePreviewRows(rows: PreviewRow[]): PreviewRow[] {
  return rows
    .map((row, index) => ({ row, index, score: companyScaleScore(row.company) + aiInterestScore(row) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.row);
}

function splitCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function firstNonEmpty(values: Array<string | undefined>): string {
  return values.find((value) => value && value.trim())?.trim() ?? "개별 active/open 공고로 수집된 전체 후보입니다.";
}

function summarizeText(value: string, maxLength = 220): string {
  const sanitized = value.replace(/CTO/g, "기술 조직").replace(/\s+/g, " ").trim();
  if (sanitized.length <= maxLength) return sanitized;
  return `${sanitized.slice(0, maxLength - 1)}…`;
}

function sentenceLimit(value: string, maxSentences = 3): string {
  const sanitized = summarizeText(value, 360);
  const sentences = sanitized
    .split(/(?<=[.!?。！？])\s+|(?<=다\.)\s+|(?<=요\.)\s+|(?<=임\.)\s+|(?<=음\.)\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return summarizeText((sentences.length ? sentences : [sanitized]).slice(0, maxSentences).join(" "), 260);
}

function summarizeOpinion(value: string): string {
  return sentenceLimit(value, 3);
}

function buildFallbackOpinion(posting: LivePostingCandidate): string {
  const roleSummary = sentenceLimit(firstNonEmpty([posting.fields.main_tasks, posting.fields.requirements, posting.fields.summary]), 2);
  const risk = sentenceLimit(firstNonEmpty([posting.fields.career_upside_risk_flags, posting.fields.preferred, "세부 JD와 seniority 기대치를 확인해야 합니다."]), 1);
  return summarizeText(`추천 티어에는 올리지 않았지만 active/open 후보로 유지할 만한 공고입니다. ${roleSummary} 확인 포인트는 ${risk}`, 280);
}

function isExcludedPreviewPosting(posting: LivePostingCandidate): boolean {
  const text = [posting.company, posting.title, ...Object.values(posting.fields), ...posting.raw].join(" ").toLowerCase();
  const title = posting.title.toLowerCase();
  if (/\bcto\b|chief technology officer|기술\s*총괄|기술총괄/.test(text)) return true;
  if (/tech\s*lead|server\s*lead|technical\s*lead|테크\s*리드|기술\s*리드/.test(text)) return true;
  if (/ai engineer\s*\(model\)|ai\s*model\s*research|model\s*research|research\s*scientist|applied\s*scientist|ai\s*research|모델\s*연구/.test(text)) return true;
  if (/cj\s*foodville|cj\s*푸드빌|cj푸드빌|씨제이푸드빌|cj\s*olive\s*young|cj올리브영|씨제이올리브영/.test(text)) return true;
  if (/전문계약직|계약직|임시직|프리랜서|인턴|contractor|\bcontract\b|\bintern(ship)?\b/.test(text)) return true;
  if (/data\s*(engineer|pipeline|platform|analyst)|데이터\s*(엔지니어|파이프라인|플랫폼|분석)|ai\s*dba|\bdba\b/.test(title)) return true;
  if (/data\s*(pipeline|warehouse|lake)|데이터\s*(파이프라인|웨어하우스|레이크)|airflow|kafka\s*connect/.test(text)) return true;
  if (/model\s*router|mcp\s*gateway|long[ -]?term\s*memory|multi[ -]?agent|agent\s*orchestration|에이전트\s*오케스트레이션|ai\s*agent\s*sdk|agent\s*(gym|platform)/.test(text)) return true;
  if (/\bml\s*engineer\b|ml\s*infrastructure|model\s*serving|llm\s*serving|ai\s*engineer\s*\((platform|serving|ads|commerce)\)|모델\s*서빙|ml\s*인프라/.test(text)) return true;
  if (/\b(staff|senior staff)\b/.test(title)) return true;
  if (/applied\s*ai\s*engineer|ai[ -]?native\s*(engineer|개발자)|ai\s*platform\s*engineer|\bai\s*engineer\b.*\(r&d\)|자율주행\s*ai\s*엔지니어/.test(title)) return true;
  if (/\b(sre|site reliability|devops|network|security researcher|technical account|technical program|account manager|asset manager|purchasing|compliance|hrbp|modeler)\b|\b(it manager|it planning|it governance|sox manager|call infra|financial systems|business partnership|category md|search engineer)\b|데이터\s*분석가|채널영업|총무|general affairs|보안\s*연구|네트워크\s*엔지니어|외환\s*상품|자문\s*상품|인프라\s*담당자|컴플라이언스/.test(title)) return true;

  const company = posting.company.toLowerCase();
  const isTossRootCompany = company === "토스" || company === "toss";
  const isGenericTossServer = /^server developer(?:\s*\([^)]+\)|\s*\[[^\]]+\].*)?$/i.test(posting.title.trim());
  const isGenericTossNode = /^node\.js developer$/i.test(posting.title.trim());
  if (isTossRootCompany && (isGenericTossServer || isGenericTossNode)) return true;
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
  const rows = applyLimit(options.postingsMarkdown ? parseLivePostingRows(options.postingsMarkdown, run) : rowsFromRun(run), effectiveLimit);
  const title = options.title ?? (options.postingsMarkdown ? `${run.reportDate} 조건 통과 수집 공고` : `${run.reportDate} 포지션 추천 후보`);
  // 전체 공고 목록(--postings)은 모든 행이 "전체 후보" 단일 티어라 구분 뱃지가 정보를 담지 못한다.
  // 이 모드에서는 뱃지 컬럼을 숨기고, 추천 티어에서 직접 렌더할 때만 표시한다.
  const showTierColumn = !options.postingsMarkdown;
  const rowHtml = rows
    .map(
      (row, index) => `<tr>
  <td class="rank">${index + 1}</td>
${showTierColumn ? `  <td class="tier"><span class="badge ${badgeClass(row.tier)}">${escapeHtml(row.tier)}</span></td>\n` : ""}  <td>
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
    main { max-width: 1180px; margin: 32px auto; background: white; padding: 32px; border-radius: 18px; box-shadow: 0 10px 30px rgba(20,30,60,.08); overflow: hidden; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .meta { color: #667085; margin-bottom: 20px; line-height: 1.55; }
    .conclusion { background: #f6f8fb; border: 1px solid #e6e8ef; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; }
    .conclusion ul { margin: 0; padding-left: 20px; }
    .table-scroll { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; border: 1px solid #e6e8ef; border-radius: 12px; }
    .table-scroll:focus { outline: 2px solid #84caff; outline-offset: 2px; }
    table { width: 100%; min-width: 920px; border-collapse: collapse; font-size: 14px; }
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
    @media (max-width: 720px) {
      body { background: white; }
      main { margin: 0; padding: 22px 16px; border-radius: 0; box-shadow: none; overflow: visible; }
      h1 { font-size: 24px; line-height: 1.25; word-break: keep-all; }
      .meta { font-size: 14px; }
      .conclusion { padding: 12px 14px; }
      .table-scroll { margin: 0 -16px; width: calc(100% + 32px); border-left: 0; border-right: 0; border-radius: 0; }
      table { min-width: 760px; font-size: 13px; }
      th, td { padding: 10px 8px; }
      th:nth-child(2), td.tier { display: none; }
      .note { min-width: 280px; max-width: 340px; }
      .url { font-size: 11px; }
    }
  </style>
</head>
<body>
<main>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">생성일: ${escapeHtml(run.reportDate)} · 현재 후보자의 역할·고용 형태·핵심 기술 조건을 통과한 active/open 공고입니다. · 대규모·검증 회사 공고를 먼저 정렬합니다. · 공고명을 클릭하면 개별 공고 페이지로 이동합니다. · 표시 공고 ${rows.length}개</div>
  <section class="conclusion"><ul>${conclusion}</ul></section>
  <div class="table-scroll" tabindex="0" aria-label="공고 목록 가로 스크롤 영역">
    <table>
      <thead><tr><th class="rank">순위</th>${showTierColumn ? "<th>구분</th>" : ""}<th>공고 링크</th><th>키워드</th><th>핵심 판단</th></tr></thead>
      <tbody>
${rowHtml}
      </tbody>
    </table>
  </div>
</main>
</body>
</html>
`;
}

function usage(): never {
  console.error("usage: render_candidate_preview.ts --input <recommendation.json> --postings <live-position-postings.md> --limit all --output <all-postings.html> [--title <title>]");
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
