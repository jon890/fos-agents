#!/usr/bin/env bun
// ADR-094: recommendation.json 정본 하나에서 Markdown과 HTML을 파생한다.
// 정본이 구조이므로 출력이 깨지지 않고, HTML은 JSON에서 직접 시맨틱 구조로 생성한다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  RecommendationRun,
  type PositionItemType,
  type RecommendationRunType,
} from "./recommendation_schema.ts";

const DEFAULT_TEMPLATE = resolve(import.meta.dir, "templates/report.html");

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ===== Markdown 파생 (사람 읽기용 report.md, freshness 가드 호환) =====

function kw(list: string[]): string {
  return list.map((k) => `\`${k}\``).join(", ");
}

function positionToMarkdown(item: PositionItemType, isStretch: boolean): string {
  const lines: string[] = [];
  lines.push(`${item.rank}. ${item.company} — ${item.title}`);
  lines.push(`   - 공고 링크: ${item.postingUrl}`);
  lines.push(`   - 탐색 링크: ${item.exploreLink}`);
  lines.push(`   - 링크 근거 수준: ${item.linkEvidenceLevel}`);
  lines.push(`   - 공고 기간: ${item.postingPeriod}`);
  lines.push(`   - 검색 키워드: ${kw(item.searchKeywords)}`);
  lines.push(`   - 왜 맞는가: ${item.whyFit}`);
  lines.push(`   - 후보자 경험 근거:`);
  for (const ev of item.candidateEvidence) lines.push(`     - ${ev}`);
  lines.push(`   - JD에서 노려야 할 키워드: ${kw(item.jdKeywords)}`);
  lines.push(`   - 회사/규모 업사이드: ${item.companyUpside.level} — ${item.companyUpside.reason}`);
  lines.push(`   - 복지/학습 환경 판단: ${item.welfareLearning}`);
  lines.push(`   - 기술블로그/엔지니어링 시그널: ${item.techBlogSignal}`);
  lines.push(`   - 사업/조직/seniority 리스크: ${item.businessRisk}`);
  lines.push(`   - 확인해야 할 모호점: ${item.ambiguity}`);
  lines.push(`   - 준비 액션: ${item.prepAction}`);
  if (isStretch && item.stretchGap) lines.push(`   - Stretch gap: ${item.stretchGap}`);
  return lines.join("\n");
}

export function toMarkdown(run: RecommendationRunType): string {
  const out: string[] = [];
  out.push(`# ${run.reportDate} 포지션 추천 리포트`);
  out.push("");
  out.push("## 한 줄 결론");
  for (const c of run.conclusion) out.push(`- ${c}`);
  out.push("");
  out.push("## 추천 배경 요약");
  for (const b of run.background) out.push(`- ${b}`);
  out.push("");
  out.push("## 강력 추천 포지션");
  out.push("");
  run.tiers.strong.forEach((item) => {
    out.push(positionToMarkdown(item, false));
    out.push("");
  });
  out.push("## 도전 추천 포지션");
  out.push("");
  run.tiers.stretch.forEach((item) => {
    out.push(positionToMarkdown(item, true));
    out.push("");
  });
  out.push("## 추가 수집 대상");
  out.push("개별 active 서버 공고 URL을 아직 확보하지 못한 회사다. 다음 수집 범위 결정용이다.");
  out.push("");
  run.additionalTargets.forEach((t, i) => {
    out.push(`${i + 1}. ${t.company}`);
    out.push(`   - 탐색 링크: ${t.exploreLink}`);
    out.push(`   - 추가 수집 이유: ${t.reason}`);
    out.push(`   - 다음 수집 포인트: ${t.nextCollectionPoint}`);
    out.push("");
  });
  out.push("## 보류·주의 포지션");
  out.push("");
  run.tiers.hold.forEach((h, i) => {
    out.push(`${i + 1}. ${h.company} — ${h.title}`);
    out.push(`   - 링크: ${h.link}`);
    out.push(`   - 보류 이유: ${h.reason}`);
    out.push("");
  });
  out.push("## 최근 반복 점검");
  for (const r of run.recentCheck) out.push(`- ${r}`);
  out.push("");
  out.push("## 이번 주 액션 플랜");
  out.push(`- 지원/검색: ${run.weeklyActions.apply}`);
  out.push(`- 이력서 보강: ${run.weeklyActions.resume}`);
  out.push(`- study-pack / question-bank: ${run.weeklyActions.study}`);
  out.push("");
  return out.join("\n");
}

// ===== HTML 파생 (JSON에서 직접 시맨틱 구조 생성) =====

function badgeHtml(level: string): string {
  const map: Record<string, string> = { 강함: "badge-strong", 중간: "badge-mid", 약함: "badge-weak" };
  const cls = map[level] ?? "badge-mid";
  return `<span class="badge ${cls}">${escapeHtml(level)}</span>`;
}

function linkOrText(value: string): string {
  if (/^https?:\/\//.test(value)) {
    return `<a href="${escapeHtml(value)}">${escapeHtml(value)}</a>`;
  }
  return escapeHtml(value);
}

function field(label: string, valueHtml: string): string {
  return `<dt>${escapeHtml(label)}</dt><dd>${valueHtml}</dd>`;
}

function codeList(list: string[]): string {
  return list.map((k) => `<code>${escapeHtml(k)}</code>`).join(", ");
}

function positionCardHtml(item: PositionItemType, isStretch: boolean): string {
  const f: string[] = [];
  f.push(field("공고 링크", linkOrText(item.postingUrl)));
  f.push(field("링크 근거 수준", escapeHtml(item.linkEvidenceLevel)));
  f.push(field("공고 기간", escapeHtml(item.postingPeriod)));
  f.push(field("검색 키워드", codeList(item.searchKeywords)));
  f.push(field("왜 맞는가", escapeHtml(item.whyFit)));
  f.push(
    field(
      "후보자 경험 근거",
      `<ul class="sub">${item.candidateEvidence.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`,
    ),
  );
  f.push(field("JD에서 노려야 할 키워드", codeList(item.jdKeywords)));
  f.push(field("회사/규모 업사이드", `${badgeHtml(item.companyUpside.level)} ${escapeHtml(item.companyUpside.reason)}`));
  f.push(field("복지/학습 환경 판단", escapeHtml(item.welfareLearning)));
  f.push(field("기술블로그/엔지니어링 시그널", escapeHtml(item.techBlogSignal)));
  f.push(field("사업/조직/seniority 리스크", escapeHtml(item.businessRisk)));
  f.push(field("확인해야 할 모호점", escapeHtml(item.ambiguity)));
  f.push(field("준비 액션", escapeHtml(item.prepAction)));
  if (isStretch && item.stretchGap) f.push(field("Stretch gap", escapeHtml(item.stretchGap)));

  return `<li class="card">
  <div class="card-head"><span class="rank">${item.rank}</span><h3>${escapeHtml(item.company)} — ${escapeHtml(item.title)}</h3></div>
  <dl class="fields">${f.join("")}</dl>
</li>`;
}

function tierSectionHtml(title: string, cls: string, items: PositionItemType[], isStretch: boolean): string {
  if (items.length === 0) return `<h2 class="${cls}">${escapeHtml(title)}</h2>\n<p class="empty">해당 없음</p>`;
  const cards = items.map((it) => positionCardHtml(it, isStretch)).join("\n");
  return `<h2 class="${cls}">${escapeHtml(title)}</h2>\n<ol class="cards">\n${cards}\n</ol>`;
}

function bulletList(items: string[]): string {
  return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
}

export function toReportHtml(run: RecommendationRunType): string {
  const parts: string[] = [];
  parts.push(`<h2>한 줄 결론</h2>\n${bulletList(run.conclusion)}`);
  parts.push(`<h2>추천 배경 요약</h2>\n${bulletList(run.background)}`);
  parts.push(tierSectionHtml("강력 추천 포지션", "tier-strong", run.tiers.strong, false));
  parts.push(tierSectionHtml("도전 추천 포지션", "tier-stretch", run.tiers.stretch, true));

  // 추가 수집 대상
  const targets = run.additionalTargets
    .map(
      (t) =>
        `<li class="card lead"><div class="card-head"><h3>${escapeHtml(t.company)}</h3></div><dl class="fields">${field("탐색 링크", linkOrText(t.exploreLink))}${field("추가 수집 이유", escapeHtml(t.reason))}${field("다음 수집 포인트", escapeHtml(t.nextCollectionPoint))}</dl></li>`,
    )
    .join("\n");
  parts.push(`<h2>추가 수집 대상</h2>\n<p class="note">개별 active 공고 URL 미확보 회사 — 다음 수집 범위 결정용.</p>\n<ol class="cards">${targets}</ol>`);

  // 보류·주의
  const holds = run.tiers.hold
    .map(
      (h) =>
        `<li class="card hold"><div class="card-head"><h3>${escapeHtml(h.company)} — ${escapeHtml(h.title)}</h3></div><dl class="fields">${field("링크", linkOrText(h.link))}${field("보류 이유", escapeHtml(h.reason))}</dl></li>`,
    )
    .join("\n");
  parts.push(`<h2 class="tier-hold">보류·주의 포지션</h2>\n<ol class="cards">${holds}</ol>`);

  parts.push(`<h2>최근 반복 점검</h2>\n${bulletList(run.recentCheck)}`);
  parts.push(
    `<h2>이번 주 액션 플랜</h2>\n<dl class="fields">${field("지원/검색", escapeHtml(run.weeklyActions.apply))}${field("이력서 보강", escapeHtml(run.weeklyActions.resume))}${field("study-pack / question-bank", escapeHtml(run.weeklyActions.study))}</dl>`,
  );
  return parts.join("\n");
}

function kstNow(): string {
  return new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function toHtml(run: RecommendationRunType, templatePath: string): string {
  const template = readFileSync(templatePath, "utf-8");
  const replacements: Record<string, string> = {
    title: escapeHtml(`${run.reportDate} 포지션 추천 리포트`),
    generatedAt: escapeHtml(kstNow()),
    reportHtml: toReportHtml(run),
    sourceDiagnosticsHtml: "",
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_m: string, key: string) => {
    if (key in replacements) return replacements[key];
    throw new Error(`Unknown template placeholder: {{${key}}}`);
  });
}

function usage(): never {
  console.error(
    "usage: render_recommendation.ts --input <recommendation.json> --format <md|html> --output <path> [--template <template.html>]",
  );
  process.exit(2);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let input = "";
  let output = "";
  let format = "";
  let template = DEFAULT_TEMPLATE;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input") input = args[++i] ?? "";
    else if (args[i] === "--output") output = args[++i] ?? "";
    else if (args[i] === "--format") format = args[++i] ?? "";
    else if (args[i] === "--template") template = args[++i] ?? "";
  }
  if (!input || !output || !format) usage();

  const raw = JSON.parse(readFileSync(resolve(input), "utf-8"));
  const parsed = RecommendationRun.safeParse(raw);
  if (!parsed.success) {
    console.error("recommendation.json schema 검증 실패:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  const run = parsed.data;

  let content: string;
  if (format === "md") content = toMarkdown(run);
  else if (format === "html") content = toHtml(run, resolve(template));
  else usage();

  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(resolve(output), content, "utf-8");
  console.log(`recommendation ${format}: ${resolve(output)}`);
}
