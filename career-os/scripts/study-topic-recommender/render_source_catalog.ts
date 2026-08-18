#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { externalReadingSources } from "../../config/external-reading-sources.js";
import {
  normalizeReadingSources,
  type ReadingCategory,
  type ReadingSource,
} from "./reading_sources.js";

type ProbeResult = {
  state: "ok" | "failed" | "not-configured" | "not-checked";
  status?: number;
};

export type ReliabilityAssessment = {
  score: number;
  grade: "높음" | "보통" | "낮음";
  sourceType: string;
  reason: string;
};

const ROOT = process.env.CAREER_OS_ROOT
  ? resolve(process.env.CAREER_OS_ROOT)
  : resolve(import.meta.dir, "..", "..");
const DOWNLOADS = resolve(ROOT, "reports", "downloads");
const COMMUNITY_HOSTS = new Set(["news.hada.io", "news.ycombinator.com"]);
const CATEGORY_ORDER: ReadingCategory[] = ["techBlog", "geek", "ai", "video"];

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function dateInKst(date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function sourceHost(source: ReadingSource): string | null {
  const url = safeHttpsUrl(source.url);
  return url ? new URL(url).hostname : null;
}

export function assessReliability(
  source: ReadingSource,
  pageProbe: ProbeResult,
  feedProbe: ProbeResult
): ReliabilityAssessment {
  const host = sourceHost(source);
  const isCommunity = Boolean(host && COMMUNITY_HOSTS.has(host));
  let score = host ? (isCommunity ? 55 : 75) : 25;

  if (host) score += 10;
  if (safeHttpsUrl(source.feedUrl)) score += 5;
  if (pageProbe.state === "ok") score += 5;
  if (feedProbe.state === "ok") score += 5;
  score = Math.min(100, score);

  if (!host) {
    return {
      score,
      grade: "낮음",
      sourceType: "큐레이션 주제",
      reason: "학습 주제는 유효하지만 검증할 원문 URL이 등록되지 않았다.",
    };
  }
  if (isCommunity) {
    return {
      score,
      grade: score >= 60 ? "보통" : "낮음",
      sourceType: "커뮤니티 큐레이션",
      reason: "발견성과 논점 탐색에는 유용하지만 원문의 사실성은 링크된 1차 출처에서 다시 확인해야 한다.",
    };
  }
  return {
    score,
    grade: score >= 85 ? "높음" : "보통",
    sourceType: "발행 주체 원문",
    reason: "회사·프로젝트·제품 문서의 직접 발행 채널이라 구현 사례와 공식 동작 확인에 적합하다.",
  };
}

async function probe(url: unknown, enabled: boolean): Promise<ProbeResult> {
  const safeUrl = safeHttpsUrl(url);
  if (!safeUrl) return { state: "not-configured" };
  if (!enabled) return { state: "not-checked" };
  try {
    const response = await fetch(safeUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
      headers: { "user-agent": "career-os-source-audit/1.0" },
    });
    await response.body?.cancel();
    return response.ok
      ? { state: "ok", status: response.status }
      : { state: "failed", status: response.status };
  } catch {
    return { state: "failed" };
  }
}

function probeLabel(probe: ProbeResult): string {
  if (probe.state === "ok") return `응답 정상${probe.status ? ` · ${probe.status}` : ""}`;
  if (probe.state === "failed") return `확인 실패${probe.status ? ` · ${probe.status}` : ""}`;
  if (probe.state === "not-checked") return "확인 생략";
  return "미등록";
}

function renderCard(
  source: ReadingSource,
  assessment: ReliabilityAssessment,
  pageProbe: ProbeResult,
  feedProbe: ProbeResult
): string {
  const url = safeHttpsUrl(source.url);
  const title = escapeHtml(source.title);
  const heading = url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${title}</a>`
    : title;
  const gradeClass = assessment.grade === "높음"
    ? "high"
    : assessment.grade === "보통" ? "medium" : "low";
  return `<article class="card">
    <div class="card-head"><span class="priority">활성 소스</span><span class="grade ${gradeClass}">${assessment.grade} · ${assessment.score}</span></div>
    <h3>${heading}</h3>
    <p class="type">${escapeHtml(assessment.sourceType)}</p>
    <p class="reason">${escapeHtml(assessment.reason)}</p>
    <dl>
      <div><dt>원문</dt><dd>${escapeHtml(probeLabel(pageProbe))}</dd></div>
      <div><dt>RSS</dt><dd>${escapeHtml(probeLabel(feedProbe))}</dd></div>
    </dl>
  </article>`;
}

export function buildSourceCatalogHtml(input: {
  date: string;
  sources: ReadingSource[];
  assessments: Map<string, ReliabilityAssessment>;
  pageProbes: Map<string, ProbeResult>;
  feedProbes: Map<string, ProbeResult>;
}): string {
  const gradeCounts = { 높음: 0, 보통: 0, 낮음: 0 };
  for (const assessment of input.assessments.values()) gradeCounts[assessment.grade] += 1;
  const categoryLabels: Record<ReadingCategory, string> = {
    techBlog: "회사 기술 블로그",
    geek: "GeekNews와 개발 동향",
    ai: "AI 공식 문서와 연구",
    video: "영상 채널",
  };
  const sections = CATEGORY_ORDER.map((category) => {
    const sources = input.sources.filter((source) => source.category === category);
    if (sources.length === 0) return "";
    const cards = sources.map((source) => renderCard(
      source,
      input.assessments.get(source.key)!,
      input.pageProbes.get(source.key)!,
      input.feedProbes.get(source.key)!
    )).join("\n");
    return `<section><div class="section-head"><div><p class="eyebrow">${escapeHtml(category)}</p><h2>${escapeHtml(categoryLabels[category])}</h2></div><span>${sources.length}개</span></div><div class="grid">${cards}</div></section>`;
  }).join("\n");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="career-os 학습 읽을거리 소스와 추적성 신뢰도 현황">
  <title>${escapeHtml(input.date)} 학습 읽을거리 소스 현황</title>
  <style>
    :root{color-scheme:light;--ink:#172033;--muted:#657087;--line:#dfe5ef;--paper:#f5f7fb;--card:#fff;--blue:#3659e3;--green:#197158;--amber:#a65d00;--red:#b53c43}
    *{box-sizing:border-box}body{margin:0;background:linear-gradient(145deg,#edf2ff,#f8fafc 42%,#edf8f3);color:var(--ink);font-family:Pretendard,"Noto Sans KR",system-ui,sans-serif;line-height:1.6}main{width:min(1160px,calc(100% - 32px));margin:auto;padding:48px 0 80px}.hero{padding:38px;border:1px solid #ffffffcc;border-radius:28px;background:#ffffffdf;box-shadow:0 24px 70px #26385b1a}.eyebrow{margin:0 0 5px;color:var(--blue);font-size:.76rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}h1{margin:0;font-size:clamp(2rem,5vw,3.8rem);line-height:1.08;letter-spacing:-.05em}.lead{max-width:780px;margin:18px 0 0;color:var(--muted)}.metrics{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.metrics span{padding:9px 14px;border-radius:999px;background:#edf1ff;color:var(--blue);font-size:.85rem;font-weight:800}.method{margin-top:18px;padding:16px 18px;border-radius:14px;background:#f7f9fd;color:var(--muted);font-size:.88rem}section{margin-top:52px}.section-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:15px}.section-head h2{margin:0;font-size:1.7rem;letter-spacing:-.035em}.section-head>span{font-weight:800;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{min-width:0;padding:20px;border:1px solid var(--line);border-radius:20px;background:var(--card);box-shadow:0 9px 26px #2c395315}.card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.priority{color:var(--muted);font-size:.76rem}.grade{padding:5px 9px;border-radius:999px;font-size:.75rem;font-weight:850}.grade.high{background:#e6f5ef;color:var(--green)}.grade.medium{background:#fff1dc;color:var(--amber)}.grade.low{background:#fdebed;color:var(--red)}h3{margin:14px 0 0;font-size:1.08rem;line-height:1.4;letter-spacing:-.02em}h3 a{color:inherit;text-decoration-color:#aab8ff;text-underline-offset:4px}.topic{margin:10px 0 0;color:var(--muted);font-size:.88rem}.type{margin:14px 0 0;color:var(--blue);font-size:.78rem;font-weight:800}.reason{margin:7px 0 0;font-size:.86rem;color:var(--muted)}dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0 0;padding-top:14px;border-top:1px solid var(--line)}dl div{min-width:0}dt{font-size:.7rem;color:var(--muted)}dd{margin:2px 0 0;font-size:.8rem;font-weight:750}footer{margin-top:42px;color:var(--muted);font-size:.82rem}@media(max-width:850px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:580px){main{padding-top:20px}.hero{padding:26px 21px}.grid{grid-template-columns:1fr}}
  </style>
</head>
<body><main>
  <header class="hero">
    <p class="eyebrow">Career OS · ${escapeHtml(input.date)}</p>
    <h1>학습 읽을거리 소스 현황</h1>
    <p class="lead">현재 활성화된 기술 블로그, 개발 동향, AI 공식 자료와 영상 채널을 한눈에 정리했습니다.</p>
    <div class="metrics"><span>전체 ${input.sources.length}개</span><span>신뢰도 높음 ${gradeCounts.높음}</span><span>보통 ${gradeCounts.보통}</span><span>낮음 ${gradeCounts.낮음}</span></div>
    <p class="method">신뢰도는 내용의 무조건적인 진실성을 뜻하지 않습니다. 발행 주체의 직접성, HTTPS 원문, RSS 제공, 이번 실행의 HTTP 응답 여부를 합산한 원문 추적성 지표입니다. 커뮤니티 글은 반드시 링크된 1차 출처를 다시 확인해야 합니다.</p>
  </header>
  ${sections}
  <footer>낮음 등급은 학습 주제가 나쁘다는 뜻이 아니라, 현재 설정에 검증 가능한 원문 링크가 없다는 뜻입니다.</footer>
</main></body>
</html>\n`;
}

async function main(): Promise<void> {
  const liveCheck = !process.argv.includes("--offline");
  const readingSources = normalizeReadingSources(externalReadingSources);
  const pageProbes = new Map<string, ProbeResult>();
  const feedProbes = new Map<string, ProbeResult>();

  await Promise.all(readingSources.sources.map(async (source) => {
    const [pageProbe, feedProbe] = await Promise.all([
      probe(source.url, liveCheck),
      probe(source.feedUrl, liveCheck),
    ]);
    pageProbes.set(source.key, pageProbe);
    feedProbes.set(source.key, feedProbe);
  }));

  const assessments = new Map<string, ReliabilityAssessment>();
  for (const source of readingSources.sources) {
    assessments.set(source.key, assessReliability(
      source,
      pageProbes.get(source.key)!,
      feedProbes.get(source.key)!
    ));
  }

  const date = dateInKst();
  mkdirSync(DOWNLOADS, { recursive: true });
  const output = resolve(DOWNLOADS, `study-reading-sources-${date}.html`);
  writeFileSync(output, buildSourceCatalogHtml({
    date,
    sources: readingSources.sources,
    assessments,
    pageProbes,
    feedProbes,
  }));
  console.log(JSON.stringify({
    status: "ok",
    liveCheck,
    sourceCount: readingSources.sources.length,
    output,
    grades: Object.fromEntries(["높음", "보통", "낮음"].map((grade) => [
      grade,
      [...assessments.values()].filter((assessment) => assessment.grade === grade).length,
    ])),
  }, null, 2));
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
