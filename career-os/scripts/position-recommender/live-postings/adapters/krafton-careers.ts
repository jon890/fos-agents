import type { AdapterCollectionResult, Posting, SourceAdapter } from "../types.ts";
import { classify, cleanDetail, closeWindow, isExcludedCompany, norm } from "../policy.ts";

// KRAFTON은 Greenhouse 공개 board(token: krafton)를 쓴다.
// content=true 한 번의 listing 호출로 전체 공고의 JD 본문·마감·부서·고용형태를 모두 받는다.
const BOARD = "krafton";
const LISTING_URL = `https://boards-api.greenhouse.io/v1/boards/${BOARD}/jobs?content=true`;

// KRAFTON의 AI/AX 조직은 title 대괄호로 부서를 명시한다:
// [AI Frontier Div.] / [AI Research Div.] / [AI Transformation Dept.].
// 사용자 관심은 "AI, AX 공고"이므로 이 세 부서(모두 "[AI"로 시작)로 수집을 한정한다.
const AI_AX_DIVISION = /^\[ai\b/i;

// 채용 홈 본문에 다른 팀 기술스택(ios/frontend 등)이 섞여 있어 JD 본문 전체를
// role 키워드로 매칭하면 오탐이 크다. role 판별은 title 기준으로만 한다.
const NON_ENGINEERING_TITLE = [
  "product manager", "product owner", "프로덕트 매니저", "planner", "기획",
  "designer", "디자이너", "qa", "frontend", "프론트", "android", "ios",
  "data scientist", "데이터 사이언티스트", "research scientist", "research engineer",
  "researcher", "postdoctoral", "applied scientist", "model researcher", "모델 연구",
  "cto", "tech lead", "server lead", "technical lead", "기술총괄",
  "marketing", "마케터", "legal", "법무", "recruiting", "채용", "sap", "security engineer",
];

// 고용형태 metadata 중 단기·연구·인턴 계열만 제외한다.
// Regular(정규직)과 Professional Contractor(전문계약직)는 수집한다(사용자 결정).
const EXCLUDED_EMPLOYMENT_TYPES = new Set(["Internship", "Contractor", "Contract"]);

const SKILL_VOCAB = [
  "Java", "Kotlin", "Spring", "Spring Boot", "JPA", "MySQL", "Oracle", "PostgreSQL",
  "Kafka", "Redis", "AWS", "GCP", "Kubernetes", "Terraform", "Python", "Go",
  "DevOps", "SRE", "API", "AI", "LLM", "RAG", "MLOps", "LLMOps", "Airflow",
];

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  content: string;
  first_published?: string;
  application_deadline?: string | null;
  departments?: { name: string }[];
  metadata?: { name: string; value: unknown }[];
}

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (fos-agents position recommender)" },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: response.ok, status: response.status, data: response.ok ? await response.json() : null };
}

function htmlText(content: string, limit = 6000): string {
  // Greenhouse content는 엔티티로 인코딩된 HTML이라 cleanDetail이 &lt;→< 로 되돌린 뒤
  // 태그를 제거한다. script/style 잔재도 함께 정리한다.
  const decoded = cleanDetail(content, content.length);
  return cleanDetail(decoded.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "), limit);
}

function section(text: string, start: string, ends: string[], limit: number): string {
  const end = ends.join("|");
  return cleanDetail(text.match(new RegExp(`${start}([\\s\\S]*?)(?:${end})`))?.[1] ?? "", limit);
}

function employmentType(job: GreenhouseJob): string {
  return String(job.metadata?.find((m) => m.name === "Employment Type")?.value ?? "");
}

function skillsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  return SKILL_VOCAB.filter((skill) => lower.includes(skill.toLowerCase())).slice(0, 12);
}

export function parseKraftonJob(job: GreenhouseJob): Posting | null {
  const title = norm(job.title);
  if (!title || !AI_AX_DIVISION.test(title)) return null;
  const lowerTitle = title.toLowerCase();
  if (title.includes("계약직") || title.includes("인턴")) return null;
  if (EXCLUDED_EMPLOYMENT_TYPES.has(employmentType(job))) return null;
  if (NON_ENGINEERING_TITLE.some((k) => lowerTitle.includes(k))) return null;

  const text = htmlText(job.content);
  const dept = norm(job.departments?.map((d) => d.name).join(", "));
  const fullText = `${title} ${dept} ${text}`;
  if (isExcludedCompany(fullText)) return null;

  const deadline = norm(job.application_deadline ?? "");
  return {
    source: "krafton-careers",
    discoveryMode: "official-listing",
    company: "크래프톤",
    title,
    url: job.absolute_url,
    identityHash: `krafton-careers:${job.id}`,
    linkType: "direct_posting",
    postingStatus: "open",
    activeEvidence: `KRAFTON Greenhouse board lists job ${job.id} as an open AI/AX posting`,
    openedAt: norm(job.first_published ?? ""),
    ...closeWindow(deadline),
    category: dept || "AI/AX",
    summary: "크래프톤 AI/AX 조직 공식 공고",
    tags: classify(fullText),
    skills: skillsFromText(fullText),
    careerUpsideHypothesis: "게임·엔터테인먼트 대규모 트래픽 환경에서 전사 AI 전환(AX)과 AI 서비스 백엔드 경험을 확장할 수 있다는 커리어 상승 가설",
    careerUpsideEvidence: ["AI Transformation Dept.의 전사 AX 프로젝트 범위", "AI 제품·플랫폼 서버 개발 전이성", "글로벌 게임 서비스의 대규모 트래픽 도메인 신호"],
    careerUpsideRiskFlags: ["전문계약직 고용형태의 계약 기간·정규 전환 조건 확인 필요", "게임 도메인 특수성과 AI 조직의 서버 개발 비중 확인 필요"],
    dueTime: deadline,
    mainTasks: section(text, "(?:미션을\\s*소개|담당할?\\s*업무|주요\\s*업무|What\\s*you)", ["필수", "이런\\s*경험을\\s*가진", "자격\\s*요건"], 650),
    requirements: section(text, "(?:필수\\s*요건|필수요건|이런\\s*경험을\\s*가진|자격\\s*요건)", ["우대", "이런\\s*경험들이\\s*있다면", "전형"], 650),
    preferred: section(text, "(?:우대\\s*요건|우대요건|이런\\s*경험들이\\s*있다면)", ["전형", "필요\\s*서류", "근무지", "고용형태"], 500),
  };
}

export const kraftonCareersAdapter: SourceAdapter = {
  id: "krafton-careers",
  name: "krafton-careers",
  async collect(): Promise<AdapterCollectionResult> {
    const errors: string[] = [];
    const listing = await fetchJson(LISTING_URL);
    if (!listing.ok) errors.push(`krafton-careers listing: HTTP ${listing.status}`);
    const jobs = listing.ok && listing.data && typeof listing.data === "object"
      ? (listing.data as { jobs?: GreenhouseJob[] }).jobs ?? []
      : [];
    const postings: Posting[] = [];
    let skippedCount = 0;
    for (const job of jobs) {
      try {
        const posting = parseKraftonJob(job);
        if (posting) postings.push(posting);
        else skippedCount++;
      } catch (error) {
        errors.push(`krafton-careers parse ${job?.id}: ${error}`);
      }
    }
    return {
      postings,
      diagnostics: {
        source: "krafton-careers",
        status: listing.ok ? "ok" : "failed",
        collectedCount: postings.length,
        skippedCount,
        failedCount: listing.ok ? 0 : 1,
        discoveryModes: ["official-listing"],
        message: `krafton-careers diagnostics: listing_jobs=${jobs.length}, accepted=${postings.length}, skipped=${skippedCount}`,
      },
      errors,
    };
  },
};
