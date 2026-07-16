import type { AdapterCollectionResult, Posting, SourceAdapter } from "../types.ts";
import {
  cleanDetail,
  classify,
  closeWindow,
  isContractRole,
  isExcludedCompany,
  isNonServerTitle,
  isServerRole,
} from "../policy.ts";

const UA = "Mozilla/5.0 (fos-agents position recommender)";
const HOST = "https://kurly.career.greetinghr.com";
const LISTING_URL = `${HOST}/ko/recruiting`;
const SERVER_TITLE_PATTERN = /\b(?:backend|server|software|devops|sre)\b|백엔드|서버|소프트웨어|플랫폼\s*엔지니어/i;

async function fetchHtml(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: response.ok, status: response.status, text: await response.text() };
}

function absoluteUrl(pathOrUrl: string): string {
  return pathOrUrl.startsWith("http") ? pathOrUrl : `${HOST}${pathOrUrl}`;
}

export function extractKurlyDetailUrls(html: string): string[] {
  const urls = new Set<string>();
  const matcher = /(?:https:\/\/kurly\.career\.greetinghr\.com)?\/ko\/o\/[0-9]+/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(html)) !== null) urls.add(absoluteUrl(match[0]));
  return [...urls];
}

function htmlTitle(html: string): string {
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (ogTitle) return cleanDetail(ogTitle, 160).replace(/\s*[-|]\s*컬리.*$/, "");
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? cleanDetail(title, 160).replace(/\s*[-|]\s*컬리.*$/, "") : "";
}

function htmlText(html: string): string {
  return cleanDetail(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
    6000
  );
}

function skillsFromText(text: string): string[] {
  const skills = ["Java", "Kotlin", "Spring", "Spring Boot", "JPA", "MySQL", "Kafka", "Redis", "AWS", "Kubernetes", "Python", "AI", "Agent", "MCP", "SAP", "ERP"];
  const lower = text.toLowerCase();
  return skills.filter((skill) => lower.includes(skill.toLowerCase())).slice(0, 12);
}

export function parseKurlyPosting(url: string, html: string): Posting | null {
  const text = htmlText(html);
  if (/페이지를 찾을 수 없습니다|접근 권한이 없거나|페이지가 존재하지/i.test(text)) return null;
  if (!/지원하기|지원서 작성|지원 안내/.test(text)) return null;

  const title = htmlTitle(html);
  const fullText = `${title} ${text}`;
  if (!title || isExcludedCompany(fullText) || isContractRole(fullText)) return null;
  if (isNonServerTitle(title) || !SERVER_TITLE_PATTERN.test(title) || !isServerRole(fullText)) return null;

  const id = url.match(/\/o\/([0-9]+)/)?.[1] ?? url;
  return {
    source: "kurly-careers",
    discoveryMode: "official-detail",
    company: "컬리",
    title,
    url,
    identityHash: `kurly-careers:${id}`,
    linkType: "direct_posting",
    postingStatus: "open",
    activeEvidence: "Kurly official GreetingHR detail page is public and shows apply guidance",
    openedAt: "",
    ...closeWindow(""),
    category: "기술",
    summary: "컬리 공식 GreetingHR 공고",
    tags: classify(fullText),
    skills: skillsFromText(fullText),
    careerUpsideHypothesis:
      "신선식품 커머스와 결제·정산 플랫폼에서 Java/Kotlin 서버 운영 경험을 확장할 수 있다는 커리어 상승 가설",
    careerUpsideEvidence: [
      "공식 JD의 커머스, 결제, 정산 또는 풀필먼트 업무 범위",
      "Java/Kotlin/Spring 기반 서버 개발 전이성",
      "컬리의 커머스·풀필먼트 플랫폼 도메인 신호",
    ],
    careerUpsideRiskFlags: [
      "팀별 실제 서버 개발 비중과 운영 권한 확인 필요",
      "사업과 조직의 안정성은 공고 외 근거로 별도 확인 필요",
    ],
    dueTime: "",
    mainTasks: cleanDetail(
      text.match(/(?:주요\s*업무|담당\s*업무|업무\s*내용)([\s\S]*?)(?:자격\s*요건|자격요건|지원\s*자격|지원자격|우대\s*사항|우대사항)/)?.[1] ?? text,
      650
    ),
    requirements: cleanDetail(
      text.match(/(?:자격\s*요건|자격요건|지원\s*자격|지원자격)([\s\S]*?)(?:우대\s*사항|우대사항|합류\s*여정|전형\s*절차|기타\s*사항)/)?.[1] ?? "",
      650
    ),
    preferred: cleanDetail(
      text.match(/(?:우대\s*사항|우대사항)([\s\S]*?)(?:합류\s*여정|전형\s*절차|기타\s*사항|지원\s*안내)/)?.[1] ?? "",
      500
    ),
  };
}

export const kurlyCareersAdapter: SourceAdapter = {
  id: "kurly-careers",
  name: "kurly-careers",
  async collect(): Promise<AdapterCollectionResult> {
    const errors: string[] = [];
    const listing = await fetchHtml(LISTING_URL);
    const urls = listing.ok ? extractKurlyDetailUrls(listing.text) : [];
    if (!listing.ok) errors.push(`kurly-careers listing: HTTP ${listing.status}`);

    const postings: Posting[] = [];
    let skippedCount = 0;
    let failedCount = listing.ok ? 0 : 1;
    for (const url of urls) {
      try {
        const detail = await fetchHtml(url);
        if (!detail.ok) {
          failedCount++;
          errors.push(`kurly-careers detail ${url.match(/\/o\/[0-9]+/)?.[0] ?? url}: HTTP ${detail.status}`);
          continue;
        }
        const posting = parseKurlyPosting(url, detail.text);
        if (posting) postings.push(posting);
        else skippedCount++;
      } catch (error) {
        failedCount++;
        errors.push(`kurly-careers detail fetch failed: ${error}`);
      }
    }

    return {
      postings,
      diagnostics: {
        source: "kurly-careers",
        status: failedCount > 0 ? "partial" : "ok",
        collectedCount: postings.length,
        skippedCount,
        failedCount,
        discoveryModes: ["official-listing", "official-detail"],
        message: `kurly-careers diagnostics: detail_candidates=${urls.length}, accepted=${postings.length}, skipped=${skippedCount}, failed=${failedCount}`,
      },
      errors,
    };
  },
};
