// 우아한형제들 채용 수집기.
// 채용 사이트는 SPA라 HTML에 공고가 없지만, 화면이 쓰는 /w1/recruits API가 공개돼 있어 이걸 단일 출처로 쓴다.
import type { AdapterCollectionResult, Posting, SourceAdapter } from "../types.ts";
import { cleanDetail, classify, closeWindow, isContractRole, isNonServerTitle, isServerRole } from "../policy.ts";

const UA = "Mozilla/5.0 (fos-agents position recommender)";
const HOST = "https://career.woowahan.com";
const LIST_URL = `${HOST}/w1/recruits?page=0&size=200`;
// 사람이 여는 화면 경로. API의 recruitNumber를 그대로 쓴다.
const PUBLIC_URL = (recruitNumber: string) => `${HOST}/recruitment/${recruitNumber}/detail`;

interface WoowaRecruit {
  recruitSeq: number;
  recruitNumber?: string;
  recruitName?: string;
  recruitOpenDate?: string;
  recruitEndDate?: string;
  recruitContents?: string | null;
}

async function fetchJson<T>(url: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { ok: false, status: response.status, data: null };
    return { ok: true, status: response.status, data: (await response.json()) as T };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/** 상시 채용은 종료일이 9999-12-31로 들어온다. 그대로 쓰면 마감일 오표기가 된다. */
export function normalizeCloseDate(recruitEndDate: string | undefined): string {
  const raw = (recruitEndDate ?? "").slice(0, 10);
  if (!raw) return "";
  const year = Number(raw.slice(0, 4));
  if (!Number.isFinite(year) || year > 2100) return "";
  return raw;
}

function htmlToText(html: string): string {
  return cleanDetail(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">"),
    8000
  );
}

function section(text: string, start: RegExp, stop: RegExp, max = 650): string {
  const startMatch = text.match(start);
  if (!startMatch || startMatch.index === undefined) return "";
  const rest = text.slice(startMatch.index + startMatch[0].length);
  const stopMatch = rest.match(stop);
  return cleanDetail(rest.slice(0, stopMatch?.index ?? Math.min(rest.length, 1800)), max);
}

function skillsFromText(text: string): string[] {
  const known = ["Java", "Kotlin", "Spring", "Spring Boot", "JPA", "MySQL", "Kafka", "Redis", "AWS", "Kubernetes", "Python", "MSA", "AI", "LLM", "ML", "Gradle"];
  const lower = text.toLowerCase();
  return known.filter((skill) => lower.includes(skill.toLowerCase())).slice(0, 12);
}

export function parseWoowahanRecruit(recruit: WoowaRecruit, contents: string): Posting | null {
  const title = cleanDetail(recruit.recruitName ?? "", 160);
  const recruitNumber = recruit.recruitNumber ?? "";
  if (!title || !recruitNumber) return null;

  const body = htmlToText(contents);
  const fullText = `${title} ${body}`;
  if (isContractRole(fullText)) return null;
  if (isNonServerTitle(title)) return null;
  // 제목이 `Server(배차시스템)`처럼 도메인만 담고 스택을 안 적는 경우가 있어 본문까지 함께 본다.
  if (!isServerRole(fullText)) return null;

  const closesAt = normalizeCloseDate(recruit.recruitEndDate);
  return {
    source: "woowahan-careers",
    discoveryMode: "official-listing",
    company: "우아한형제들",
    title,
    url: PUBLIC_URL(recruitNumber),
    identityHash: `woowahan-careers:${recruitNumber}`,
    linkType: "direct_posting",
    postingStatus: "open",
    activeEvidence: `우아한형제들 공식 채용 API가 ${recruitNumber}를 진행 중 공고로 반환`,
    openedAt: (recruit.recruitOpenDate ?? "").slice(0, 10),
    ...closeWindow(closesAt),
    category: "기술",
    summary: "우아한형제들 공식 채용 공고",
    tags: classify(fullText),
    skills: skillsFromText(fullText),
    careerUpsideHypothesis:
      "배달의민족의 국내 최대 실시간 O2O 트래픽에서 대용량 백엔드와 ML 연동 경험을 확장할 수 있다는 커리어 상승 가설",
    careerUpsideEvidence: [
      "우아한형제들 공식 채용 API의 진행 중 공고 상태",
      "Java/Kotlin/Spring 기반 서버 개발 전이성",
      "실시간 주문·배차·정산의 대규모 트래픽 도메인 신호",
    ],
    careerUpsideRiskFlags: [
      "AWS 운영 요건이 있으면 현재 클라우드 경험과의 차이 확인 필요",
      "팀별 서버 개발과 ML 파이프라인 비중 확인 필요",
    ],
    dueTime: closesAt,
    mainTasks: section(body, /\[업무내용\]|업무\s*내용|주요\s*업무|담당\s*업무/i, /\[지원자격\]|지원\s*자격|자격\s*요건|\[우대사항\]/i) || cleanDetail(body, 650),
    requirements: section(body, /\[지원자격\]|지원\s*자격|자격\s*요건/i, /\[우대사항\]|우대\s*사항|\[개발환경\]|전형\s*절차/i),
    preferred: section(body, /\[우대사항\]|우대\s*사항/i, /\[개발환경\]|개발\s*환경|전형\s*절차|꼭\s*읽어/i, 500),
  };
}

export const woowahanCareersAdapter: SourceAdapter = {
  id: "woowahan-careers",
  name: "woowahan-careers",
  async collect(): Promise<AdapterCollectionResult> {
    const errors: string[] = [];
    const listing = await fetchJson<{ data?: { list?: WoowaRecruit[] } }>(LIST_URL);
    if (!listing.ok || !listing.data) {
      const message = `woowahan-careers listing: HTTP ${listing.status}`;
      return {
        postings: [],
        diagnostics: {
          source: "woowahan-careers",
          status: "failed",
          collectedCount: 0,
          skippedCount: 0,
          failedCount: 1,
          discoveryModes: ["official-listing"],
          message,
        },
        errors: [message],
      };
    }

    const list = listing.data.data?.list ?? [];
    // 목록 응답에는 recruitContents가 비어 있어 서버 역할 판정을 못 한다.
    // 제목만으로 1차 후보를 좁힌 뒤 상세를 받는다.
    const candidates = list.filter((recruit) => {
      const name = recruit.recruitName ?? "";
      if (!name || isNonServerTitle(name)) return false;
      return /server|서버|백엔드|backend|플랫폼|platform|엔지니어링|engineer/i.test(name);
    });

    const postings: Posting[] = [];
    let failedCount = 0;
    let skippedCount = list.length - candidates.length;
    for (const recruit of candidates) {
      const detail = await fetchJson<{ data?: WoowaRecruit }>(`${HOST}/w1/recruits/${recruit.recruitNumber}`);
      if (!detail.ok || !detail.data?.data) {
        failedCount++;
        errors.push(`woowahan-careers detail ${recruit.recruitNumber}: HTTP ${detail.status}`);
        continue;
      }
      const posting = parseWoowahanRecruit(detail.data.data, detail.data.data.recruitContents ?? "");
      if (posting) postings.push(posting);
      else skippedCount++;
    }

    return {
      postings,
      diagnostics: {
        source: "woowahan-careers",
        status: failedCount > 0 ? "partial" : "ok",
        collectedCount: postings.length,
        skippedCount,
        failedCount,
        discoveryModes: ["official-listing", "official-detail"],
        message: `woowahan-careers diagnostics: listing_jobs=${list.length}, detail_candidates=${candidates.length}, accepted=${postings.length}, skipped=${skippedCount}, failed=${failedCount}`,
      },
      errors,
    };
  },
};
