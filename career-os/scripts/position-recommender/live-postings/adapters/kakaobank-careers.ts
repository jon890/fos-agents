import type { AdapterCollectionResult, Posting, SourceAdapter } from "../types.ts";
import { cleanDetail, classify, closeWindow, isContractRole, isNonTargetTitle, isTargetRole, norm } from "../policy.ts";

const HOST = "https://recruit.kakaobank.com";
const LISTING_URL = `${HOST}/api/recruits`;

interface RecruitNotice {
  recruitNoticeSn: number;
  recruitNoticeName: string;
  recruitClassName: string;
  receiveStartDatetime: string;
  receiveEndDatetime: string;
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", Accept: "application/json", ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(20_000) });
  return { ok: response.ok, status: response.status, data: await response.json() };
}

async function fetchHtml(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (fos-agents position recommender)", "Accept-Language": "ko-KR,ko;q=0.9" }, signal: AbortSignal.timeout(20_000) });
  return { ok: response.ok, status: response.status, text: await response.text() };
}

function htmlText(html: string): string {
  return cleanDetail(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "), 6000);
}

function section(text: string, start: string, ends: string[], limit: number): string {
  const end = ends.join("|");
  return cleanDetail(text.match(new RegExp(`${start}([\\s\\S]*?)(?:${end})`))?.[1] ?? "", limit);
}

function skillsFromText(text: string): string[] {
  const skills = ["Java", "Kotlin", "Spring", "Spring Boot", "JPA", "MySQL", "Oracle", "Kafka", "Redis", "AWS", "Kubernetes", "Python", "DevOps", "API", "AI", "LLM"];
  const lower = text.toLowerCase();
  return skills.filter((skill) => lower.includes(skill.toLowerCase())).slice(0, 12);
}

export function parseKakaoBankPosting(notice: RecruitNotice, html: string): Posting | null {
  const text = htmlText(html);
  const title = norm(notice.recruitNoticeName);
  const fullText = `${title} ${notice.recruitClassName} ${text}`;
  if (!title || !/지원|모집기간|접수기간/.test(text)) return null;
  if (isContractRole(fullText) || isNonTargetTitle(title) || !isTargetRole(fullText)) return null;
  const url = `${HOST}/jobs/${notice.recruitNoticeSn}`;
  return {
    source: "kakaobank-careers", discoveryMode: "official-detail", company: "카카오뱅크", title, url,
    identityHash: `kakaobank-careers:${notice.recruitNoticeSn}`, linkType: "direct_posting", postingStatus: "open",
    activeEvidence: `KakaoBank official recruits API lists notice ${notice.recruitNoticeSn} with an active receipt window`,
    openedAt: notice.receiveStartDatetime, ...closeWindow(notice.receiveEndDatetime), category: notice.recruitClassName,
    summary: "카카오뱅크 공식 영입 공고", tags: classify(fullText), skills: skillsFromText(fullText),
    careerUpsideHypothesis: "인터넷 전문 은행의 금융 도메인과 대규모 Java/Spring 서버 개발 경험을 확장할 수 있다는 커리어 상승 가설",
    careerUpsideEvidence: ["공식 JD의 금융 시스템과 서버 개발 업무 범위", "Java/Kotlin/Spring 기반 서버 개발 전이성", "카카오뱅크의 금융 플랫폼 도메인 신호"],
    careerUpsideRiskFlags: ["금융 도메인 지식과 규제 환경의 학습 비용 확인 필요", "팀별 레거시와 신규 개발 비중 확인 필요"],
    dueTime: notice.receiveEndDatetime,
    mainTasks: section(text, "(?:담당할\\s*업무|주요\\s*업무)", ["필수\\s*경험", "자격\\s*요건", "우대사항"], 650),
    requirements: section(text, "(?:필수\\s*경험과\\s*역량|자격\\s*요건)", ["우대사항", "근무\\s*관련\\s*정보"], 650),
    preferred: section(text, "우대사항", ["근무\\s*관련\\s*정보", "지원\\s*관련\\s*정보"], 500),
  };
}

export const kakaobankCareersAdapter: SourceAdapter = {
  id: "kakaobank-careers", name: "kakaobank-careers",
  async collect(): Promise<AdapterCollectionResult> {
    const errors: string[] = [];
    const listing = await fetchJson(LISTING_URL, { method: "POST", body: "{}" });
    const list = listing.ok && listing.data && typeof listing.data === "object" ? (listing.data as { list?: RecruitNotice[] }).list ?? [] : [];
    if (!listing.ok) errors.push(`kakaobank-careers listing: HTTP ${listing.status}`);
    const postings: Posting[] = [];
    let skippedCount = 0;
    let failedCount = listing.ok ? 0 : 1;
    for (const notice of list) {
      try {
        const detail = await fetchHtml(`${HOST}/jobs/${notice.recruitNoticeSn}`);
        if (!detail.ok) { failedCount++; errors.push(`kakaobank-careers detail ${notice.recruitNoticeSn}: HTTP ${detail.status}`); continue; }
        const posting = parseKakaoBankPosting(notice, detail.text);
        if (posting) postings.push(posting); else skippedCount++;
      } catch (error) { failedCount++; errors.push(`kakaobank-careers detail fetch failed: ${error}`); }
    }
    return { postings, diagnostics: { source: "kakaobank-careers", status: failedCount > 0 ? "partial" : "ok", collectedCount: postings.length, skippedCount, failedCount, discoveryModes: ["official-listing", "official-detail"], message: `kakaobank-careers diagnostics: detail_candidates=${list.length}, accepted=${postings.length}, skipped=${skippedCount}, failed=${failedCount}` }, errors };
  },
};
