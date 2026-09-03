import type { MorningReadingReport, ReadingCareerValue, ReadingRecommendation } from "../reading_contracts.js";

const CAREER_VALUE_LABELS: Record<ReadingCareerValue, string> = {
  "current-work": "현재 업무 적용",
  "target-role": "목표 역할 준비",
  "engineering-judgment": "엔지니어링 판단",
  "product-business": "제품·사업 관점",
};

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
  const published = item.published ? `<span>게시 ${escapeHtml(item.published)}</span>` : "";
  return `<article class="card">
    <div class="meta"><span>${escapeHtml(item.sourceName)}</span><span>${escapeHtml(item.category)}</span>${published}</div>
    <h3><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h3>
    <p class="career-value">${escapeHtml(CAREER_VALUE_LABELS[item.careerValue])}</p>
    <p class="summary">${escapeHtml(item.summary)}</p>
    <p class="reason"><strong>추천 이유</strong>${escapeHtml(item.reason)}</p>
  </article>`;
}

function renderTopics(report: MorningReadingReport): string {
  if (report.topics.length === 0) {
    return '<section class="empty"><h2>오늘은 새로운 추천이 없습니다</h2><p>이미 추천한 자료를 다시 채우지 않았습니다.</p></section>';
  }
  return report.topics.map((topic, index) => `<section class="topic">
    <div class="topic-heading"><span>${String(index + 1).padStart(2, "0")}</span><div><h2>${escapeHtml(topic.title)}</h2><p>${escapeHtml(topic.careerQuestion)}</p></div></div>
    <div class="grid">${topic.items.map(renderCard).join("\n")}</div>
  </section>`).join("\n");
}

export function morningHtmlFilename(generatedAt: string): string {
  return `morning-reading-${kstDate(generatedAt)}.html`;
}

export function buildMorningHtml(report: MorningReadingReport): string {
  const date = kstDate(report.generatedAt);
  const recommendationCount = report.topics.reduce((count, topic) => count + topic.items.length, 0);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(date)} 커리어 인사이트를 위한 아침 공부 주제">
  <title>${escapeHtml(date)} 오늘 아침 공부 주제</title>
  <style>
    :root { color-scheme:light; --ink:#14213d; --muted:#64748b; --line:#dbe3ef; --paper:#f4f7fb; --card:#fff; --accent:#4f46e5; --accent-soft:#eef2ff; --green:#0f766e; }
    * { box-sizing:border-box; }
    body { margin:0; background:linear-gradient(145deg,#eef2ff,#f8fafc 44%,#ecfdf5); color:var(--ink); font-family:Pretendard,"Noto Sans KR",system-ui,-apple-system,sans-serif; line-height:1.65; }
    main { width:min(1040px,calc(100% - 32px)); margin:0 auto; padding:52px 0 80px; }
    .hero { padding:42px; border:1px solid rgba(255,255,255,.88); border-radius:28px; background:rgba(255,255,255,.86); box-shadow:0 24px 70px rgba(46,61,97,.12); backdrop-filter:blur(16px); }
    .eyebrow { margin:0 0 6px; color:var(--accent); font-size:.78rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
    h1 { margin:0; font-size:clamp(2rem,6vw,4rem); line-height:1.08; letter-spacing:-.055em; }
    .lead { max-width:720px; margin:18px 0 0; color:var(--muted); font-size:1.05rem; }
    .overview { display:flex; flex-wrap:wrap; gap:10px; margin-top:28px; }
    .overview span { padding:9px 14px; border-radius:999px; background:var(--accent-soft); color:var(--accent); font-size:.86rem; font-weight:800; }
    .topic { margin-top:54px; }
    .topic-heading { display:grid; grid-template-columns:48px 1fr; gap:14px; align-items:start; margin-bottom:18px; }
    .topic-heading>span { display:grid; width:42px; height:42px; place-items:center; border-radius:14px; background:var(--ink); color:white; font-weight:800; }
    h2 { margin:0; font-size:1.7rem; letter-spacing:-.035em; }
    .topic-heading p { margin:6px 0 0; color:var(--muted); }
    .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
    .card { min-width:0; padding:22px; border:1px solid var(--line); border-radius:20px; background:var(--card); box-shadow:0 10px 28px rgba(43,55,82,.06); }
    .meta { display:flex; flex-wrap:wrap; gap:8px; color:var(--green); font-size:.78rem; font-weight:750; }
    .card h3 { margin:12px 0 0; font-size:1.08rem; line-height:1.45; letter-spacing:-.02em; }
    .card a { color:inherit; text-decoration-color:#a9b5ff; text-underline-offset:4px; }
    .card a:hover { color:var(--accent); }
    .career-value { display:inline-block; margin:12px 0 0; padding:5px 9px; border-radius:8px; background:var(--accent-soft); color:var(--accent); font-size:.78rem; font-weight:800; }
    .summary { margin:16px 0 0; color:var(--muted); font-size:.93rem; }
    .reason { margin:14px 0 0; padding-top:14px; border-top:1px solid var(--line); color:var(--muted); font-size:.88rem; }
    .reason strong { display:block; margin-bottom:3px; color:var(--ink); font-size:.78rem; }
    .empty { margin-top:54px; padding:32px; border:1px solid var(--line); border-radius:20px; background:white; }
    .empty p { margin:8px 0 0; color:var(--muted); }
    .note { margin-top:48px; padding:20px 22px; border-left:4px solid var(--accent); border-radius:0 14px 14px 0; background:rgba(255,255,255,.72); color:var(--muted); }
    footer { margin-top:28px; color:var(--muted); font-size:.82rem; }
    @media (max-width:760px) { main { padding-top:24px; } .hero { padding:28px 22px; } .grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
<main>
  <header class="hero">
    <p class="eyebrow">Career OS · ${escapeHtml(date)}</p>
    <h1>오늘 아침 공부 주제</h1>
    <p class="lead">현재 업무와 다음 역할에서 써볼 수 있는 판단을 중심으로 자료를 묶었습니다.</p>
    <div class="overview"><span>${report.topics.length}개 주제</span><span>${recommendationCount}개 자료</span><span>${report.counts.collectedArticles}개 검토</span><span>${report.counts.sourcesWithCandidates}/${report.counts.activeSources}개 소스 응답</span></div>
  </header>
  ${renderTopics(report)}
  <aside class="note">추천은 이 실행에서 수집한 외부 자료만 사용하고, 이전에 추천한 자료는 제외했습니다.</aside>
  <footer>이 리포트에는 공개 URL과 공개 가능한 추천 설명만 포함합니다.</footer>
</main>
</body>
</html>
`;
}
