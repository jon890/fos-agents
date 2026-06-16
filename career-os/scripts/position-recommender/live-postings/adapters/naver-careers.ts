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
// JSON API used for listing (HTML page renders cards via AJAX, not SSR).
const LIST_API = `${HOST}/rcrt/loadJobList.do`;
const LISTING_PAGE = `${HOST}/rcrt/list.do`;
const MAX_DETAIL_FETCH = 40;

async function fetchHtml(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

async function fetchJobListJson(): Promise<Array<{ id: string; title: string; empType: string }>> {
  // NAVER Careers listing page renders cards via JavaScript AJAX (/rcrt/loadJobList.do JSON API).
  // HTML regex over the listing page only finds JS template placeholders, not real card data.
  const r = await fetch(`${LIST_API}?firstIndex=0`, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": LISTING_PAGE,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`loadJobList.do HTTP ${r.status}`);
  const data = await r.json() as { result: string; list: Array<{ annoId: number; annoSubject: string; empTypeCdNm: string }> };
  if (data.result !== "Y" || !Array.isArray(data.list)) throw new Error(`loadJobList.do unexpected response: result=${data.result}`);
  return data.list.map(item => ({
    id: String(item.annoId),
    title: decodeHtml(item.annoSubject ?? ""),
    empType: item.empTypeCdNm ?? "",
  }));
}

function htmlText(html: string): string {
  // The detail page navigation menu includes ALL job category names ("Frontend Android iOS Backend ..."),
  // which triggers EXCLUDE_NON_SERVER_KEYWORDS and makes isServerRole() return false for every posting.
  // Extract only the job-description section (detail_wrap div → site_wrap/body) to avoid nav contamination.
  const detailWrapIdx = html.indexOf('class="detail_wrap"');
  const siteWrapIdx = html.indexOf('class="site_wrap"');
  const bodyEndIdx = html.indexOf("</body>");
  const contentEnd = siteWrapIdx !== -1 ? siteWrapIdx : bodyEndIdx !== -1 ? bodyEndIdx : html.length;
  const content = detailWrapIdx !== -1 && contentEnd > detailWrapIdx
    ? html.slice(detailWrapIdx, contentEnd)
    : html;
  return cleanDetail(
    content
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
    let listingFailed = 0;
    let rawItems: Array<{ id: string; title: string; empType: string }> = [];

    try {
      rawItems = await fetchJobListJson();
    } catch (error) {
      listingFailed++;
      errors.push(`naver-careers listing (JSON API) failed: ${error}`);
    }

    // Pre-filter obvious non-candidates from API metadata before fetching detail pages.
    const filtered = rawItems.filter(item => {
      if (/인턴|intern/i.test(item.empType)) return false;
      if (/계약|contract/i.test(item.empType)) return false;
      return true;
    });

    const items = filtered.slice(0, MAX_DETAIL_FETCH);

    const postings: Posting[] = [];
    let skippedCount = 0;
    let failedCount = listingFailed;

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

    const message = `naver-careers diagnostics: listing_candidates=${rawItems.length}, detail_candidates=${items.length}, accepted=${postings.length}, skipped=${skippedCount}, failed=${failedCount}`;
    naverCareersAdapter.note = message;
    return {
      postings,
      diagnostics: {
        source: "naver-careers",
        status: failedCount > 0 ? "partial" : "ok",
        collectedCount: postings.length,
        skippedCount,
        failedCount,
        discoveryModes: ["official-listing", "official-detail"],
        message,
      },
      errors,
    };
  },
};
