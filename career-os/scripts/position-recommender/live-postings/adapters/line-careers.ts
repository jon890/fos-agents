// LINE Careers 수집기.
// 사이트가 Gatsby 정적 빌드라 목록 HTML에는 공고 링크가 없다(클라이언트 렌더).
// 대신 Gatsby가 함께 배포하는 page-data.json이 Strapi 원본 데이터를 그대로 담고 있어 이걸 단일 출처로 쓴다.
import type { AdapterCollectionResult, Posting, SourceAdapter } from "../types.ts";
import { cleanDetail, classify, closeWindow, isContractRole, isNonServerTitle, isServerRole } from "../policy.ts";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const HOST = "https://careers.linecorp.com";
const LIST_URL = `${HOST}/page-data/ko/jobs/page-data.json`;

// 한국 근무 공고만 남긴다. LINE은 도쿄·타이베이·상하이 공고를 같은 목록에 섞어 둔다.
const KOREA_CITIES = new Set(["Bundang", "Seoul", "Gwacheon"]);
// Strapi job_fields 중 서버·플랫폼 계열만 본다. Client-side, Design 등은 제외한다.
const SERVER_FIELDS = /server|backend|back-end|platform|infra|data engineer|machine learning|ai/i;

interface StrapiNamed {
  id?: number;
  name?: string;
}

interface StrapiJob {
  strapiId: number;
  title?: string;
  title_en?: string;
  publish?: boolean;
  is_public?: boolean;
  until_filled?: boolean;
  start_date?: string;
  end_date?: string;
  employment_type?: StrapiNamed[];
  job_unit?: StrapiNamed[];
  job_fields?: StrapiNamed[];
  companies?: StrapiNamed[];
  cities?: StrapiNamed[];
}

async function fetchJson<T>(url: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { ok: false, status: response.status, data: null };
    return { ok: true, status: response.status, data: (await response.json()) as T };
  } catch (error) {
    return { ok: false, status: 0, data: null };
  }
}

function names(items: StrapiNamed[] | undefined): string[] {
  return (items ?? []).map((item) => item.name ?? "").filter(Boolean);
}

/** 상시 채용(`until_filled`)은 end_date가 2999년으로 박혀 있어 그대로 쓰면 마감일 오표기가 된다. */
function closesAtFor(job: StrapiJob): string {
  if (job.until_filled) return "";
  const end = job.end_date ?? "";
  if (!end) return "";
  const year = Number(end.slice(0, 4));
  if (!Number.isFinite(year) || year > 2100) return "";
  return end.slice(0, 10);
}

export function isKoreaEngineeringServerJob(job: StrapiJob): boolean {
  if (!job.publish || !job.is_public) return false;
  if (!names(job.employment_type).some((type) => /full-time/i.test(type))) return false;
  if (!names(job.job_unit).some((unit) => /engineering/i.test(unit))) return false;
  if (!names(job.cities).some((city) => KOREA_CITIES.has(city))) return false;
  if (!names(job.job_fields).some((field) => SERVER_FIELDS.test(field))) return false;

  const title = job.title || job.title_en || "";
  const fullText = `${title} ${names(job.job_fields).join(" ")}`;
  if (isContractRole(fullText)) return false;
  if (isNonServerTitle(title)) return false;
  return isServerRole(fullText);
}

function detailUrl(id: number): string {
  return `${HOST}/page-data/ko/jobs/${id}/page-data.json`;
}

function publicUrl(id: number): string {
  return `${HOST}/jobs/${id}/`;
}

/** page-data의 상세 본문은 마크다운 문자열이다. 섹션 헤더로 잘라 쓴다. */
function sectionFrom(body: string, headers: RegExp, stopHeaders: RegExp): string {
  const startMatch = body.match(headers);
  if (!startMatch || startMatch.index === undefined) return "";
  const rest = body.slice(startMatch.index + startMatch[0].length);
  const stopMatch = rest.match(stopHeaders);
  const end = stopMatch?.index ?? Math.min(rest.length, 1800);
  return cleanDetail(rest.slice(0, end).replace(/[#*>-]/g, " "), 650);
}

function skillsFromText(text: string): string[] {
  const known = ["Java", "Kotlin", "Spring", "Spring Boot", "JPA", "MySQL", "Kafka", "Redis", "AWS", "Kubernetes", "Python", "MSA", "AI", "LLM", "gRPC"];
  const lower = text.toLowerCase();
  return known.filter((skill) => lower.includes(skill.toLowerCase())).slice(0, 12);
}

export function buildLinePosting(job: StrapiJob, detailBody: string): Posting {
  const title = job.title || job.title_en || `LINE Job ${job.strapiId}`;
  const company = names(job.companies)[0] || "LINE";
  const cities = names(job.cities).join(", ");
  const fullText = `${title} ${detailBody}`;
  const closesAt = closesAtFor(job);

  return {
    source: "line-careers",
    discoveryMode: "official-listing",
    company,
    title,
    url: publicUrl(job.strapiId),
    identityHash: `line-careers:${job.strapiId}`,
    linkType: "direct_posting",
    postingStatus: "open",
    activeEvidence: `LINE Careers Gatsby page-data marks job ${job.strapiId} as publish/is_public${job.until_filled ? " with until-filled hiring" : ""}`,
    openedAt: (job.start_date ?? "").slice(0, 10),
    ...closeWindow(closesAt),
    category: "Engineering",
    summary: cities ? `근무지: ${cities}. LINE Careers 공식 공고` : "LINE Careers 공식 공고",
    tags: classify(fullText),
    skills: skillsFromText(fullText),
    careerUpsideHypothesis:
      "LINE의 글로벌 메시징·결제 플랫폼에서 대규모 트래픽 백엔드와 AI 접목 경험을 확장할 수 있다는 커리어 상승 가설",
    careerUpsideEvidence: [
      "LINE Careers 공식 page-data의 publish/is_public 상태",
      "Java/Spring 기반 서버 개발 전이성",
      "글로벌 메시징·결제 서비스의 대규모 트래픽 도메인 신호",
    ],
    careerUpsideRiskFlags: [
      "해외 출장·근무 요구 여부와 협업 언어 확인 필요",
      "팀별 실제 서버 개발 비중과 담당 도메인 확인 필요",
    ],
    dueTime: closesAt,
    mainTasks: sectionFrom(detailBody, /담당\s*업무|주요\s*업무|What you will do/i, /자격\s*요건|지원\s*자격|Qualifications|우대\s*사항/i) || cleanDetail(detailBody, 650),
    requirements: sectionFrom(detailBody, /자격\s*요건|지원\s*자격|Qualifications/i, /우대\s*사항|Preferred|전형\s*절차|근무\s*조건/i),
    preferred: sectionFrom(detailBody, /우대\s*사항|Preferred/i, /전형\s*절차|근무\s*조건|유의\s*사항/i),
  };
}

/** page-data 응답 구조가 버전마다 달라질 수 있어, 본문으로 쓸 만한 긴 문자열을 재귀로 찾는다. */
function longestString(value: unknown, depth = 0): string {
  if (depth > 6) return "";
  if (typeof value === "string") return value.length > 200 ? value : "";
  if (Array.isArray(value)) return value.map((item) => longestString(item, depth + 1)).sort((a, b) => b.length - a.length)[0] ?? "";
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => longestString(item, depth + 1))
      .sort((a, b) => b.length - a.length)[0] ?? "";
  }
  return "";
}

export const lineCareersAdapter: SourceAdapter = {
  id: "line-careers",
  name: "line-careers",
  async collect(): Promise<AdapterCollectionResult> {
    const errors: string[] = [];
    const listing = await fetchJson<{ result?: { data?: { allStrapiJobs?: { edges?: Array<{ node: StrapiJob }> } } } }>(LIST_URL);
    if (!listing.ok || !listing.data) {
      const message = `line-careers listing: HTTP ${listing.status}`;
      return {
        postings: [],
        diagnostics: {
          source: "line-careers",
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

    const allJobs = (listing.data.result?.data?.allStrapiJobs?.edges ?? []).map((edge) => edge.node);
    const candidates = allJobs.filter(isKoreaEngineeringServerJob);

    const postings: Posting[] = [];
    let failedCount = 0;
    for (const job of candidates) {
      const detail = await fetchJson<unknown>(detailUrl(job.strapiId));
      if (!detail.ok) {
        failedCount++;
        errors.push(`line-careers detail ${job.strapiId}: HTTP ${detail.status}`);
        // 목록 데이터만으로도 개별 공고 URL과 open 근거는 충분하므로 본문 없이 유지한다.
        postings.push(buildLinePosting(job, ""));
        continue;
      }
      postings.push(buildLinePosting(job, longestString(detail.data)));
    }

    return {
      postings,
      diagnostics: {
        source: "line-careers",
        status: failedCount > 0 ? "partial" : "ok",
        collectedCount: postings.length,
        skippedCount: allJobs.length - candidates.length,
        failedCount,
        discoveryModes: ["official-listing", "official-detail"],
        message: `line-careers diagnostics: listing_jobs=${allJobs.length}, accepted=${postings.length}, skipped=${allJobs.length - candidates.length}, detail_failed=${failedCount}`,
      },
      errors,
    };
  },
};
