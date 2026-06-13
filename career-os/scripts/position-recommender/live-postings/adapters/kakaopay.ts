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
const HOST = "https://kakaopay.career.greetinghr.com";
const LISTING_URL = `${HOST}/ko/main`;

async function fetchHtml(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

function absoluteUrl(pathOrUrl: string): string {
  return pathOrUrl.startsWith("http") ? pathOrUrl : `${HOST}${pathOrUrl}`;
}

function extractDetailUrls(html: string): string[] {
  const urls = new Set<string>();
  const re = /(?:https:\/\/kakaopay\.career\.greetinghr\.com)?\/ko\/o\/[0-9]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) urls.add(absoluteUrl(match[0]));
  return [...urls];
}

function htmlTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (og) return cleanDetail(og, 160);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? cleanDetail(title, 160).replace(/\s*[-|]\s*카카오페이.*$/, "") : "";
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
  const skills = ["Java", "Kotlin", "Spring", "Spring Boot", "JPA", "MySQL", "Kafka", "RabbitMQ", "AWS", "Kubernetes", "Python", "TypeScript", "LLM", "MLOps"];
  const low = text.toLowerCase();
  return skills.filter((skill) => low.includes(skill.toLowerCase())).slice(0, 12);
}

function postingFromDetail(url: string, html: string): Posting | null {
  const text = htmlText(html);
  if (/페이지를 찾을 수 없습니다|접근 권한이 없거나|페이지가 존재하지/i.test(text)) return null;
  if (!/지원하기|지원서 작성|지원 안내/.test(text)) return null;

  const title = htmlTitle(html);
  const fullText = `${title} ${text}`;
  if (!title) return null;
  if (isExcludedCompany(fullText)) return null;
  if (isContractRole(fullText)) return null;
  if (isNonServerTitle(title)) return null;
  if (!isServerRole(fullText)) return null;

  const id = url.match(/\/o\/([0-9]+)/)?.[1] ?? url;
  const isAlwaysOpen = /상시 영입|상시채용|채용 완료 시 조기 마감|수시 채용/.test(text);
  return {
    source: "kakaopay",
    discoveryMode: "official-detail",
    company: "카카오페이",
    title,
    url,
    identityHash: `kakaopay:${id}`,
    linkType: "direct_posting",
    postingStatus: "open",
    activeEvidence: "GreetingHR detail page is public and shows apply guidance/open hiring copy",
    openedAt: "",
    ...closeWindow(isAlwaysOpen ? "" : ""),
    category: "기술",
    summary: "카카오페이 공식 GreetingHR 공고",
    tags: classify(fullText),
    skills: skillsFromText(fullText),
    careerUpsideHypothesis:
      "NHN 현재 맥락보다 결제/금융 트래픽과 AI 전환 과제를 더 직접적으로 쌓을 수 있다는 커리어 상승 가설",
    careerUpsideEvidence: [
      "공식 JD의 결제/금융 또는 AX/AI 업무 범위",
      "Java/Kotlin/Spring 기반 서버 개발 전이성",
      "카카오페이 브랜드와 핀테크 도메인 신호",
    ],
    careerUpsideRiskFlags: [
      "팀별 실제 권한과 운영 범위 확인 필요",
      "AI 전환 역할은 hands-on 서버 개발 비중 확인 필요",
    ],
    dueTime: isAlwaysOpen ? "" : "",
    mainTasks: cleanDetail(text.match(/업무내용([\s\S]*?)(필요 역량|지원자격|자격요건|선호 역량|우대사항)/)?.[1] ?? text, 650),
    requirements: cleanDetail(text.match(/(필요 역량\/경험|지원자격|자격요건)([\s\S]*?)(선호 역량|우대사항|지원 안내)/)?.[2] ?? "", 650),
    preferred: cleanDetail(text.match(/(선호 역량\/경험|우대사항)([\s\S]*?)(지원 안내|전형 절차|유의사항)/)?.[2] ?? "", 500),
  };
}

export const kakaopayAdapter: SourceAdapter = {
  id: "kakaopay",
  name: "kakaopay",
  async collect(): Promise<AdapterCollectionResult> {
    const errors: string[] = [];
    const listing = await fetchHtml(LISTING_URL);
    const urls = listing.ok ? extractDetailUrls(listing.text) : [];
    if (!listing.ok) errors.push(`kakaopay listing: HTTP ${listing.status}`);

    const postings: Posting[] = [];
    let skippedCount = 0;
    let failedCount = listing.ok ? 0 : 1;
    for (const url of urls) {
      try {
        const detail = await fetchHtml(url);
        if (!detail.ok) {
          failedCount++;
          errors.push(`kakaopay detail ${url.match(/\/o\/[0-9]+/)?.[0] ?? url}: HTTP ${detail.status}`);
          continue;
        }
        const posting = postingFromDetail(url, detail.text);
        if (posting) postings.push(posting);
        else skippedCount++;
      } catch (error) {
        failedCount++;
        errors.push(`kakaopay detail fetch failed: ${error}`);
      }
    }

    return {
      postings,
      diagnostics: {
        source: "kakaopay",
        status: failedCount > 0 ? "partial" : "ok",
        collectedCount: postings.length,
        skippedCount,
        failedCount,
        discoveryModes: ["official-listing", "official-detail"],
        message: `kakaopay diagnostics: detail_candidates=${urls.length}, accepted=${postings.length}, skipped=${skippedCount}, failed=${failedCount}`,
      },
      errors,
    };
  },
};
