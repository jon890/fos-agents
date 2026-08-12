import type { BackendItem, Recommendation } from "../transform/types.js";

export interface MorningHtmlInput {
  generatedAt?: string;
  recommendations: BackendItem[];
  techBlogRecommendations: Recommendation[];
  aiRecommendations: Recommendation[];
  geekRecommendations: Recommendation[];
  targetMinutes?: number;
  reviewStatus: string;
  updateExistingCount: number;
}

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

function kstDate(generatedAt?: string): string {
  const parsed = generatedAt ? new Date(generatedAt) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function titleOf(item: BackendItem | Recommendation | null): string {
  if (!item) return "추천 없음";
  const article = "discoveredArticle" in item
    ? (item as Recommendation).discoveredArticle
    : undefined;
  return article?.title || item.title || item.key || "제목 없음";
}

function linkOf(item: Recommendation): string | null {
  return safeHttpsUrl(item.discoveredArticle?.url || item.url);
}

function renderReasons(item: Recommendation): string {
  const reasons = Array.isArray(item.whyNow) ? item.whyNow : [];
  const [summary = "핵심 내용을 빠르게 파악할 수 있는 읽을거리입니다.", ...rest] = reasons;
  const recommendation = rest.length > 0
    ? rest.join(" ")
    : "오늘의 관심 주제와 연결해 읽기 좋은 후보입니다.";
  return `<p class="summary">${escapeHtml(summary)}</p>
    <p class="reason"><strong>추천 이유</strong>${escapeHtml(recommendation)}</p>`;
}

function renderMeta(item: Recommendation, kind: "backend" | "reading"): string {
  const parts: string[] = [];
  if (kind === "backend" && item.domain) parts.push(escapeHtml(item.domain));
  if (item.difficulty) parts.push(`난이도 ${escapeHtml(item.difficulty)}`);
  if (item.estMinutes) parts.push(`${escapeHtml(item.estMinutes)}분`);
  if (item.source) parts.push(escapeHtml(item.source));
  if (item.category) parts.push(escapeHtml(item.category));
  return parts.length > 0 ? `<p class="meta">${parts.join(" · ")}</p>` : "";
}

function renderCard(item: Recommendation, kind: "backend" | "reading"): string {
  const title = escapeHtml(titleOf(item));
  const link = linkOf(item);
  const heading = link
    ? `<a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">${title}</a>`
    : title;
  return `<article class="card">
    <h3>${heading}</h3>
    ${renderMeta(item, kind)}
    ${renderReasons(item)}
  </article>`;
}

function renderSection(
  id: string,
  title: string,
  description: string,
  items: Recommendation[],
  kind: "backend" | "reading"
): string {
  const cards = items.length > 0
    ? items.map((item) => renderCard(item, kind)).join("\n")
    : '<p class="empty">이번 실행에서 추천할 항목을 찾지 못했습니다.</p>';
  return `<section id="${escapeHtml(id)}">
    <div class="section-heading">
      <div><p class="eyebrow">${escapeHtml(description)}</p><h2>${escapeHtml(title)}</h2></div>
      <span class="count">${items.length}</span>
    </div>
    <div class="grid">${cards}</div>
  </section>`;
}

export function morningHtmlFilename(generatedAt?: string): string {
  return `morning-reading-${kstDate(generatedAt)}.html`;
}

export function buildMorningHtml(input: MorningHtmlInput): string {
  const date = kstDate(input.generatedAt);
  const allItems = [
    ...input.recommendations,
    ...input.techBlogRecommendations,
    ...input.aiRecommendations,
    ...input.geekRecommendations,
  ];
  const estimatedMinutes = allItems.reduce(
    (sum, item) => sum + (typeof item.estMinutes === "number" ? item.estMinutes : 0),
    0
  );
  const reviewNote = input.reviewStatus === "ok"
    ? `기존 자료와 겹치는 후보 ${input.updateExistingCount}건은 새 문서보다 보강 대상으로 분류했습니다.`
    : "중복 후보의 의미 검토가 끝나지 않아 기존 자료 보강 판단은 잠정적입니다.";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(date)} 출근길과 아침 시간을 위한 개발 읽을거리">
  <title>${escapeHtml(date)} 오늘 아침 읽을거리</title>
  <style>
    :root { color-scheme: light; --ink:#172033; --muted:#647089; --line:#dfe5ef; --paper:#f6f8fc; --card:#fff; --accent:#4967ff; --accent-soft:#eef1ff; --green:#18795f; }
    * { box-sizing:border-box; }
    body { margin:0; background:linear-gradient(150deg,#eef2ff 0,#f8fafc 38%,#edf8f4 100%); color:var(--ink); font-family:Pretendard,"Noto Sans KR",system-ui,-apple-system,sans-serif; line-height:1.65; }
    main { width:min(1040px,calc(100% - 32px)); margin:0 auto; padding:52px 0 80px; }
    .hero { padding:42px; border:1px solid rgba(255,255,255,.85); border-radius:28px; background:rgba(255,255,255,.86); box-shadow:0 24px 70px rgba(46,61,97,.12); backdrop-filter:blur(16px); }
    .eyebrow { margin:0 0 6px; color:var(--accent); font-size:.78rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
    h1 { margin:0; font-size:clamp(2rem,6vw,4.2rem); line-height:1.08; letter-spacing:-.055em; }
    .lead { max-width:680px; margin:18px 0 0; color:var(--muted); font-size:1.05rem; }
    .overview { display:flex; flex-wrap:wrap; gap:10px; margin-top:28px; }
    .overview span { padding:9px 14px; border-radius:999px; background:var(--accent-soft); color:var(--accent); font-size:.86rem; font-weight:800; }
    section { margin-top:54px; }
    .section-heading { display:flex; align-items:end; justify-content:space-between; gap:20px; margin-bottom:16px; }
    h2 { margin:0; font-size:1.75rem; letter-spacing:-.035em; }
    .count { display:grid; width:38px; height:38px; place-items:center; border-radius:50%; background:var(--ink); color:white; font-weight:800; }
    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
    .card { min-width:0; padding:22px; border:1px solid var(--line); border-radius:20px; background:var(--card); box-shadow:0 10px 28px rgba(43,55,82,.06); }
    .card h3 { margin:0; font-size:1.08rem; line-height:1.45; letter-spacing:-.02em; }
    .card a { color:inherit; text-decoration-color:#a9b5ff; text-underline-offset:4px; }
    .card a:hover { color:var(--accent); }
    .meta { margin:10px 0 0; color:var(--green); font-size:.82rem; font-weight:750; }
    .summary { margin:16px 0 0; color:var(--muted); font-size:.93rem; }
    .reason { margin:14px 0 0; padding-top:14px; border-top:1px solid var(--line); color:var(--muted); font-size:.88rem; }
    .reason strong { display:block; margin-bottom:3px; color:var(--ink); font-size:.78rem; }
    .note { margin-top:48px; padding:20px 22px; border-left:4px solid var(--accent); border-radius:0 14px 14px 0; background:rgba(255,255,255,.72); color:var(--muted); }
    footer { margin-top:28px; color:var(--muted); font-size:.82rem; }
    @media (max-width:760px) { main { padding-top:24px; } .hero { padding:28px 22px; } .grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
<main>
  <header class="hero">
    <p class="eyebrow">Career OS · ${escapeHtml(date)}</p>
    <h1>오늘 아침 읽을거리</h1>
    <p class="lead">출근 후 하루 학습을 시작할 때 읽고 생각할 내용을 카테고리별로 정리했습니다. 모두 읽기보다 오늘 필요한 순서대로 골라 보세요.</p>
    <div class="overview">
      <span>${allItems.length}개 읽을거리</span>
      <span>예상 ${estimatedMinutes}분</span>
      <span>하루 학습 목표 ${escapeHtml(input.targetMinutes ?? 120)}분</span>
    </div>
  </header>
  ${renderSection("tech-blog", "회사 기술 블로그", "먼저 읽는 운영 사례", input.techBlogRecommendations, "reading")}
  ${renderSection("geek", "GeekNews와 개발 동향", "다음으로 훑는 업계 신호", input.geekRecommendations, "reading")}
  ${renderSection("ai", "AI 실전 읽을거리", "제품과 운영 관점", input.aiRecommendations, "reading")}
  ${renderSection("backend", "백엔드 공부 후보", "에이전트가 제안한 심화 주제", input.recommendations, "backend")}
  <aside class="note">${escapeHtml(reviewNote)}</aside>
  <footer>이 리포트는 하루 학습의 시작점을 고르는 공개 가능한 아침 읽을거리입니다.</footer>
</main>
</body>
</html>
`;
}
