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
const HOST = "https://recruit.navercorp.com";
const LISTING_URL = `${HOST}/rcrt/list.do`;

async function fetchHtml(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
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

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractListItems(html: string): Array<{ id: string; title: string }> {
  const items: Array<{ id: string; title: string }> = [];
  const re = /show\(['"]?(\d+)['"]?\)[\s\S]*?<h4 class="card_title">([\s\S]*?)<\/h4>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    items.push({ id: match[1], title: cleanDetail(decodeHtml(match[2]), 180) });
  }
  return items;
}

function skillsFromText(text: string): string[] {
  const skills = ["Java", "Kotlin", "Spring", "Spring Boot", "JPA", "MySQL", "Kafka", "Redis", "Kubernetes", "Python", "LLM", "AI", "Search", "Platform"];
  const low = text.toLowerCase();
  return skills.filter((skill) => low.includes(skill.toLowerCase())).slice(0, 12);
}

function postingFromDetail(item: { id: string; title: string }, html: string): Posting | null {
  const text = htmlText(html);
  const title = item.title;
  const fullText = `${title} ${text}`;
  if (!title) return null;
  if (isExcludedCompany(fullText)) return null;
  if (isContractRole(fullText) || /인턴|intern|체험형/i.test(fullText)) return null;
  if (isNonServerTitle(title)) return null;
  if (!isServerRole(fullText)) return null;

  const dueRaw =
    text.match(/Application period\s*([0-9.\-~\s:]+)/i)?.[1] ??
    text.match(/접수기간\s*([0-9.\-~\s:]+)/)?.[1] ??
    "";
  const url = `${HOST}/rcrt/view.do?annoId=${item.id}&lang=ko`;
  return {
    source: "naver-careers",
    discoveryMode: "official-detail",
    company: "NAVER",
    title,
    url,
    identityHash: `naver-careers:${item.id}`,
    linkType: "direct_posting",
    postingStatus: "open",
    activeEvidence: "NAVER Careers list page renders this announcement and detail page is public",
    openedAt: "",
    ...closeWindow(""),
    category: "Tech",
    summary: "NAVER Careers 공식 공고",
    tags: classify(fullText),
    skills: skillsFromText(fullText),
    careerUpsideHypothesis:
      "검색, 플랫폼, 대규모 트래픽, AI 전환 경험을 NHN보다 강한 브랜드와 엔지니어링 밀도에서 쌓을 수 있다는 커리어 상승 가설",
    careerUpsideEvidence: [
      "NAVER 공식 Careers active 공고",
      "검색/플랫폼/AI 또는 서버 개발 전이성",
      "네이버 D2와 대규모 서비스 엔지니어링 신호",
    ],
    careerUpsideRiskFlags: [
      "공고별 경력/인턴 여부와 hands-on 서버 개발 비중 확인 필요",
      "연구/기획 중심 역할은 추천 티어에서 제외 필요",
    ],
    dueTime: norm(dueRaw),
    mainTasks: cleanDetail(text.match(/Responsibilities([\s\S]*?)(Qualifications|Required|Preferred|지원자격|필요역량)/i)?.[1] ?? text, 650),
    requirements: cleanDetail(text.match(/(Qualifications|Required|지원자격|필요역량)([\s\S]*?)(Preferred|우대사항|전형절차|Application)/i)?.[2] ?? "", 650),
    preferred: cleanDetail(text.match(/(Preferred|우대사항)([\s\S]*?)(전형절차|Application|기타)/i)?.[2] ?? "", 500),
  };
}

export const naverCareersAdapter: SourceAdapter = {
  id: "naver-careers",
  name: "naver-careers",
  async collect(): Promise<AdapterCollectionResult> {
    const errors: string[] = [];
    const listing = await fetchHtml(LISTING_URL);
    const items = listing.ok ? extractListItems(listing.text) : [];
    if (!listing.ok) errors.push(`naver-careers listing: HTTP ${listing.status}`);

    const postings: Posting[] = [];
    let skippedCount = 0;
    let failedCount = listing.ok ? 0 : 1;
    for (const item of items) {
      const url = `${HOST}/rcrt/view.do?annoId=${item.id}&lang=ko`;
      try {
        const detail = await fetchHtml(url);
        if (!detail.ok) {
          failedCount++;
          errors.push(`naver-careers detail ${item.id}: HTTP ${detail.status}`);
          continue;
        }
        const posting = postingFromDetail(item, detail.text);
        if (posting) postings.push(posting);
        else skippedCount++;
      } catch (error) {
        failedCount++;
        errors.push(`naver-careers detail fetch failed: ${error}`);
      }
    }

    return {
      postings,
      diagnostics: {
        source: "naver-careers",
        status: failedCount > 0 ? "partial" : "ok",
        collectedCount: postings.length,
        skippedCount,
        failedCount,
        discoveryModes: ["official-listing", "official-detail"],
        message: `naver-careers diagnostics: detail_candidates=${items.length}, accepted=${postings.length}, skipped=${skippedCount}, failed=${failedCount}`,
      },
      errors,
    };
  },
};
