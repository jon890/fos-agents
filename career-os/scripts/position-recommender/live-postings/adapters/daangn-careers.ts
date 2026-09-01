// 당근 채용 수집기.
// 채용 사이트는 클라이언트 렌더라 HTML 파싱이 불안정하지만, Greenhouse job board API가 공개돼 있어 이걸 단일 출처로 쓴다.
import type { AdapterCollectionResult, Posting, SourceAdapter } from "../types.ts";
import { cleanDetail, classify, closeWindow, isContractRole, isNonTargetTitle, isTargetRole } from "../policy.ts";

const UA = "Mozilla/5.0 (fos-agents position recommender)";
const BOARD_URL = "https://boards-api.greenhouse.io/v1/boards/daangn/jobs?content=true";
// Greenhouse의 absolute_url은 about.daangn.com 쿼리 형태라 사람이 열기 불편하다.
// 실제 공고 화면은 careers.daangn.com의 role 경로다.
const PUBLIC_URL = (id: number) => `https://careers.daangn.com/jobs/role/${id}/`;

interface GreenhouseJob {
  id: number;
  title?: string;
  content?: string;
  updated_at?: string;
  first_published?: string;
  application_deadline?: string | null;
  location?: { name?: string };
  offices?: Array<{ name?: string }>;
  departments?: Array<{ name?: string }>;
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

/** Greenhouse content는 HTML escape된 문자열이다. 두 번 풀어야 본문이 나온다. */
export function decodeGreenhouseContent(content: string): string {
  const unescaped = content
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  return cleanDetail(unescaped.replace(/<[^>]+>/g, " "), 8000);
}

function isKoreaJob(job: GreenhouseJob): boolean {
  const location = `${job.location?.name ?? ""} ${(job.offices ?? []).map((o) => o.name ?? "").join(" ")}`;
  return /seoul|서울|korea|한국/i.test(location);
}

function section(text: string, start: RegExp, stop: RegExp, max = 650): string {
  const startMatch = text.match(start);
  if (!startMatch || startMatch.index === undefined) return "";
  const rest = text.slice(startMatch.index + startMatch[0].length);
  const stopMatch = rest.match(stop);
  return cleanDetail(rest.slice(0, stopMatch?.index ?? Math.min(rest.length, 1800)), max);
}

function skillsFromText(text: string): string[] {
  const known = ["Java", "Kotlin", "Spring", "Spring Boot", "JPA", "MySQL", "Kafka", "Redis", "OpenSearch", "Elasticsearch", "AWS", "Kubernetes", "Go", "Python", "TypeScript", "gRPC", "AI", "LLM", "RAG"];
  const lower = text.toLowerCase();
  return known.filter((skill) => lower.includes(skill.toLowerCase())).slice(0, 12);
}

export function parseDaangnJob(job: GreenhouseJob): Posting | null {
  const title = cleanDetail(job.title ?? "", 160);
  if (!title) return null;
  if (!isKoreaJob(job)) return null;

  const body = decodeGreenhouseContent(job.content ?? "");
  const fullText = `${title} ${body}`;
  // 고용 형태는 제목으로만 판정한다.
  // 당근 JD 하단 공정채용 안내문에 "최대 3개월 계약직으로 근무할 수 있어요" 같은 문구가 있어,
  // 본문 전체로 판정하면 정규직 공고가 전부 계약직으로 잘못 걸린다.
  if (isContractRole(title)) return null;
  if (isNonTargetTitle(title)) return null;
  if (!isTargetRole(`${title} ${(job.departments ?? []).map((d) => d.name ?? "").join(" ")}`)) return null;

  const closesAt = (job.application_deadline ?? "").slice(0, 10);
  return {
    source: "daangn-careers",
    discoveryMode: "official-listing",
    company: "당근",
    title,
    url: PUBLIC_URL(job.id),
    identityHash: `daangn-careers:${job.id}`,
    linkType: "direct_posting",
    postingStatus: "open",
    activeEvidence: `Daangn official Greenhouse board lists job ${job.id} as an open posting`,
    openedAt: (job.first_published ?? "").slice(0, 10),
    ...closeWindow(closesAt),
    category: (job.departments ?? [])[0]?.name ?? "Engineering",
    summary: `근무지: ${job.location?.name ?? "SEOUL"}. 당근 공식 Greenhouse 공고`,
    tags: classify(fullText),
    skills: skillsFromText(fullText),
    careerUpsideHypothesis:
      "국내 최대 지역 생활 커뮤니티 트래픽과 당근페이·광고 플랫폼에서 서버 개발과 AI 접목 경험을 확장할 수 있다는 커리어 상승 가설",
    careerUpsideEvidence: [
      "당근 공식 Greenhouse board의 open 공고 상태",
      "Kotlin/Java/Spring 기반 서버 개발 전이성",
      "지역 커뮤니티·커머스·결제의 대규모 트래픽 도메인 신호",
    ],
    careerUpsideRiskFlags: [
      "팀별 실제 서버 개발 비중과 AI 업무 비중 확인 필요",
      "버티컬 조직은 수익화 경로와 투자 우선순위 확인 필요",
    ],
    dueTime: closesAt,
    mainTasks: section(body, /이런\s*일을\s*해요|주요\s*업무|담당\s*업무|What you will do/i, /이런\s*분을\s*찾고\s*있어요|자격\s*요건|지원\s*자격|이런\s*경험/i) || cleanDetail(body, 650),
    requirements: section(body, /이런\s*분을\s*찾고\s*있어요|자격\s*요건|지원\s*자격|Qualifications/i, /이런\s*경험|우대\s*사항|Preferred|이런\s*환경|합류\s*여정|전형/i),
    preferred: section(body, /이런\s*경험이?\s*있으면\s*더\s*좋아요|우대\s*사항|Preferred/i, /이런\s*환경|합류\s*여정|전형|혜택/i, 500),
  };
}

export const daangnCareersAdapter: SourceAdapter = {
  id: "daangn-careers",
  name: "daangn-careers",
  async collect(): Promise<AdapterCollectionResult> {
    const board = await fetchJson<{ jobs?: GreenhouseJob[] }>(BOARD_URL);
    if (!board.ok || !board.data) {
      const message = `daangn-careers board: HTTP ${board.status}`;
      return {
        postings: [],
        diagnostics: {
          source: "daangn-careers",
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

    const jobs = board.data.jobs ?? [];
    const postings = jobs.map(parseDaangnJob).filter((posting): posting is Posting => posting !== null);

    return {
      postings,
      diagnostics: {
        source: "daangn-careers",
        status: "ok",
        collectedCount: postings.length,
        skippedCount: jobs.length - postings.length,
        failedCount: 0,
        discoveryModes: ["official-listing"],
        message: `daangn-careers diagnostics: board_jobs=${jobs.length}, accepted=${postings.length}, skipped=${jobs.length - postings.length}`,
      },
      errors: [],
    };
  },
};
