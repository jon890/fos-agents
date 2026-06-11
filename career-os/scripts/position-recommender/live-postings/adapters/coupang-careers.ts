import { XMLParser } from "fast-xml-parser";
import type { AdapterCollectionResult, Posting, SourceAdapter } from "../types.ts";
import {
  cleanDetail,
  classify,
  closeWindow,
  isContractRole,
  isExcludedCompany,
  isNonServerTitle,
  isServerRole,
  norm,
} from "../policy.ts";

const UA = "Mozilla/5.0 (OpenClaw career-os position recommender)";
const SITEMAP_URL = "https://www.coupang.jobs/sitemap.xml";
const MAX_POSTINGS = 40;

interface SitemapUrl {
  loc?: string;
  lastmod?: string;
}

interface SitemapDocument {
  urlset?: {
    url?: SitemapUrl | SitemapUrl[];
  };
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7" },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

function parseSitemap(xml: string): SitemapUrl[] {
  const parsed = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  }).parse(xml) as SitemapDocument;
  const urls = parsed.urlset?.url;
  if (!urls) return [];
  return Array.isArray(urls) ? urls : [urls];
}

function jobIdFromUrl(url: string): string {
  return url.match(/\/jobs\/([0-9]+)\//)?.[1] ?? "";
}

function slugFromUrl(url: string): string {
  const match = url.match(/\/jobs\/[0-9]+\/([^/?#]+)\/?/);
  return match ? decodeURIComponent(match[1]) : "";
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (/^[A-Z0-9]+$/.test(part)) return part;
      if (/^[a-z]+$/i.test(part)) return part.charAt(0).toUpperCase() + part.slice(1);
      return part;
    })
    .join(" ")
    .replace(/\bSr\b/g, "Sr.")
    .replace(/\bLl\b/g, "LL")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bMl\b/g, "ML")
    .replace(/\bQa\b/g, "QA")
    .replace(/\bDba\b/g, "DBA")
    .replace(/\bGpu\b/g, "GPU");
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string): string {
  return cleanDetail(
    decodeHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    ),
    8000
  );
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanDetail(match[1], 900);
  }
  return "";
}

function section(text: string, start: string, endMarkers: string[]): string {
  const startIndex = text.toLowerCase().indexOf(start.toLowerCase());
  if (startIndex < 0) return "";
  const rest = text.slice(startIndex + start.length);
  const endIndexes = endMarkers
    .map((marker) => rest.toLowerCase().indexOf(marker.toLowerCase()))
    .filter((index) => index >= 0);
  const endIndex = endIndexes.length > 0 ? Math.min(...endIndexes) : Math.min(rest.length, 1600);
  return cleanDetail(rest.slice(0, endIndex), 900);
}

function skillsFromTitle(title: string): string[] {
  const known = [
    "Java",
    "Kotlin",
    "Spring",
    "Backend",
    "Back-end",
    "Platform",
    "Payment",
    "Fintech",
    "Search",
    "AI",
    "ML",
    "LLM",
    "GPU",
    "Observability",
    "Database",
  ];
  const low = title.toLowerCase();
  return known.filter((skill) => low.includes(skill.toLowerCase())).slice(0, 12);
}

function postingFromSitemapUrl(item: SitemapUrl): Posting | null {
  const url = norm(item.loc);
  if (!/^https:\/\/www\.coupang\.jobs\/en\/jobs\/[0-9]+\//.test(url)) return null;
  const id = jobIdFromUrl(url);
  const slug = slugFromUrl(url);
  const title = titleFromSlug(slug);
  const fullText = `Coupang ${title}`;

  if (!id || !title) return null;
  if (isExcludedCompany(fullText)) return null;
  if (isContractRole(fullText)) return null;
  if (isNonServerTitle(title)) return null;
  if (!isServerRole(fullText)) return null;

  const lastmod = norm(item.lastmod);
  const summary =
    "Coupang 공식 sitemap에 노출된 개별 채용공고. 상세 fetch가 실패하면 JD 본문과 근무지는 후속 브라우저/manual 확인 필요.";

  return {
    source: "coupang-careers",
    discoveryMode: "official-sitemap",
    company: "Coupang",
    title,
    url,
    identityHash: `coupang-careers:${id}`,
    linkType: "direct_posting",
    postingStatus: "open",
    activeEvidence: `Coupang Careers official sitemap includes this direct job URL${lastmod ? `, lastmod=${lastmod}` : ""}`,
    openedAt: lastmod,
    ...closeWindow(""),
    category: "Engineering & Technology",
    summary,
    tags: classify(fullText),
    skills: skillsFromTitle(title),
    careerUpsideHypothesis:
      "Coupang/Coupang Pay의 대규모 커머스·결제·플랫폼 환경에서 NHN보다 강한 트래픽과 보상/브랜드 레버리지를 얻을 수 있다는 커리어 상승 가설",
    careerUpsideEvidence: [
      "Coupang 공식 Careers sitemap direct job URL",
      "대규모 커머스·결제·물류·광고·AI 플랫폼 도메인",
      "사용자 선호 타깃 회사군에 포함",
    ],
    careerUpsideRiskFlags: [
      "상세 fetch 실패 시 JD 본문과 근무지 확인 필요",
      "Staff/Sr.Staff급 공고는 연차 기준 mismatch 가능성 확인 필요",
      "상세 확인 전에는 즉시 지원보다 추가 확인 액션이 우선",
    ],
    dueTime: "",
    mainTasks: summary,
    requirements: "공식 상세 페이지 확인 필요. sitemap URL title 기반으로만 서버/플랫폼 후보를 선별했다.",
    preferred: "결제, 커머스, 플랫폼, AI/ML/LLM, 대규모 트래픽 경험은 공고별 상세 확인 후 판단한다.",
  };
}

function enrichWithDetail(posting: Posting, html: string): Posting {
  const text = stripHtml(html);
  const h1 = firstMatch(html, [/<h1[^>]*>([\s\S]*?)<\/h1>/i]);
  const title = h1 || posting.title;
  const fullText = `${title} ${text}`;
  const location = firstMatch(text, [/Location\s+(.+?)\s+Updated/i, /Location\s+(.+?)\s+Apply now/i]);
  const updated = firstMatch(text, [/Updated\s+([0-9/.-]+)/i]);
  const description = section(text, "Description", ["Basic Qualifications", "Preferred Qualifications", "Recruitment Process", "Location"]);
  const responsibilities = section(text, "Key Responsibilities", ["Basic Qualifications", "Preferred Qualifications", "Recruitment Process", "Location"]);
  const requirements = section(text, "Basic Qualifications", ["Preferred Qualifications", "Recruitment Process", "Why Coupang", "Location"]);
  const preferred = section(text, "Preferred Qualifications", ["Recruitment Process", "Why Coupang", "Location"]);
  const skills = [...new Set([...posting.skills, ...skillsFromTitle(fullText)])].slice(0, 12);

  return {
    ...posting,
    title,
    activeEvidence: `${posting.activeEvidence}; detail fetch HTTP 200${updated ? `, updated=${updated}` : ""}`,
    openedAt: updated || posting.openedAt,
    summary: location ? `Location: ${location}. ${description || posting.summary}` : description || posting.summary,
    tags: classify(fullText),
    skills,
    careerUpsideRiskFlags: [
      "Staff/Sr.Staff급 공고는 연차 기준 mismatch 가능성 확인 필요",
      "상세 JD가 있어도 실제 팀/레벨/지원 가능성은 recruiter 확인 필요",
    ],
    dueTime: updated || posting.dueTime,
    mainTasks: responsibilities || description || posting.mainTasks,
    requirements: requirements || posting.requirements,
    preferred: preferred || posting.preferred,
  };
}

async function enrichPostings(postings: Posting[]): Promise<{ postings: Posting[]; failedCount: number; errors: string[] }> {
  const enriched: Posting[] = [];
  let failedCount = 0;
  const errors: string[] = [];
  for (const posting of postings) {
    const detail = await fetchText(posting.url);
    if (!detail.ok) {
      failedCount++;
      errors.push(`coupang-careers detail blocked ${posting.url}: HTTP ${detail.status}`);
      enriched.push(posting);
      continue;
    }
    enriched.push(enrichWithDetail(posting, detail.text));
  }
  return { postings: enriched, failedCount, errors };
}

function isKoreaPosting(posting: Posting): boolean {
  const location = posting.summary.match(/^Location:\s*([^.]*)\./)?.[1] ?? "";
  if (location) return /Seoul|South Korea|서울/.test(location);
  return /Seoul|South Korea|서울/.test(posting.title);
}

export const coupangCareersAdapter: SourceAdapter = {
  id: "coupang-careers",
  name: "coupang-careers",
  async collect(): Promise<AdapterCollectionResult> {
    const sitemap = await fetchText(SITEMAP_URL);
    if (!sitemap.ok) {
      return {
        postings: [],
        diagnostics: {
          source: "coupang-careers",
          status: "failed",
          collectedCount: 0,
          skippedCount: 0,
          failedCount: 1,
          discoveryModes: ["official-sitemap"],
          message: `coupang-careers sitemap: HTTP ${sitemap.status}`,
        },
        errors: [`coupang-careers sitemap: HTTP ${sitemap.status}`],
      };
    }

    const sitemapUrls = parseSitemap(sitemap.text);
    const candidates = sitemapUrls
      .map(postingFromSitemapUrl)
      .filter((posting): posting is Posting => posting !== null)
      .slice(0, MAX_POSTINGS);
    const enriched = await enrichPostings(candidates);
    const koreaPostings = enriched.postings.filter(isKoreaPosting);

    return {
      postings: koreaPostings,
      diagnostics: {
        source: "coupang-careers",
        status: enriched.failedCount > 0 ? "partial" : "ok",
        collectedCount: koreaPostings.length,
        skippedCount: Math.max(0, sitemapUrls.length - koreaPostings.length),
        failedCount: enriched.failedCount,
        discoveryModes: ["official-sitemap", "official-detail"],
        message:
          `coupang-careers diagnostics: sitemap_urls=${sitemapUrls.length}, ` +
          `accepted=${koreaPostings.length}, detail_failed=${enriched.failedCount}`,
      },
      errors: enriched.errors,
    };
  },
};
