import type {
  MorningReadingReport,
  ReadingRecommendation,
} from "../reading_contracts.js";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHttpsUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`HTTPS가 아닌 추천 URL: ${value}`);
  return url.toString();
}

function kstDate(generatedAt: string): string {
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) throw new Error(`유효하지 않은 generatedAt: ${generatedAt}`);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function renderCard(item: ReadingRecommendation): string {
  const url = safeHttpsUrl(item.url);
  const published = item.published
    ? `<p class="published">게시 ${escapeHtml(item.published)}</p>`
    : "";
  return `<article class="card">
    <h3><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h3>
    <p class="meta">${escapeHtml(item.sourceName)}</p>
    ${published}
    <p class="summary">${escapeHtml(item.summary)}</p>
    <p class="reason"><strong>추천 이유</strong>${escapeHtml(item.reason)}</p>
  </article>`;
}

function renderSection(
  id: string,
  title: string,
  description: string,
  items: ReadingRecommendation[]
): string {
  const cards = items.length > 0
    ? items.map(renderCard).join("\n")
    : '<p class="empty">이번 실행에서 추천할 글을 찾지 못했습니다.</p>';
  return `<section id="${escapeHtml(id)}">
    <div class="section-heading">
      <div><p class="eyebrow">${escapeHtml(description)}</p><h2>${escapeHtml(title)}</h2></div>
      <span class="count">${items.length}</span>
    </div>
    <div class="grid">${cards}</div>
  </section>`;
}

export function morningHtmlFilename(generatedAt: string): string {
  return `morning-reading-${kstDate(generatedAt)}.html`;
}

export function buildMorningHtml(report: MorningReadingReport): string {
  const date = kstDate(report.generatedAt);
  const recommendationCount =
    report.recommendations.techBlog.length + report.recommendations.geek.length;

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
    .published { margin:4px 0 0; color:var(--muted); font-size:.78rem; }
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
    <p class="lead">등록된 외부 소스에서 오늘 읽을 만한 글을 골랐습니다. 회사 기술 블로그를 먼저 읽고 개발 동향을 이어서 살펴보세요.</p>
    <div class="overview">
      <span>${recommendationCount}개 추천</span>
      <span>${report.counts.collectedArticles}개 글 검토</span>
      <span>${report.counts.sourcesWithCandidates}/${report.counts.activeSources}개 소스 응답</span>
    </div>
  </header>
  ${renderSection("tech-blog", "회사 기술 블로그", "먼저 읽는 운영 사례", report.recommendations.techBlog)}
  ${renderSection("geek", "GeekNews와 개발 동향", "다음으로 훑는 업계 신호", report.recommendations.geek)}
  <aside class="note">추천은 이 실행에서 외부 소스로부터 수집한 글만 사용했습니다.</aside>
  <footer>이 리포트에는 공개 URL과 공개 가능한 추천 설명만 포함합니다.</footer>
</main>
</body>
</html>
`;
}
