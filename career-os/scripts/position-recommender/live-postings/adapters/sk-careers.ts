import type { AdapterCollectionResult, Posting, SourceAdapter } from "../types.ts";
import {
  cleanDetail,
  classify,
  closeWindow,
  hasKeyword,
  isContractRole,
  isExcludedCompany,
  isNonServerTitle,
  isServerRole,
  norm,
} from "../policy.ts";

const UA = "Mozilla/5.0 (OpenClaw career-os position recommender)";
const HOST = "https://www.skcareers.com";
const LIST_URL = `${HOST}/Recruit/GetRecruitList`;
const TARGET_COMPANIES = [
  "SK inc.(AX)",
  "SK주식회사(AX)",
  "SK telecom",
  "SK텔레콤",
  "Tmap Mobility",
  "티맵모빌리티",
  "SK planet",
  "SK플래닛",
];
const EXCLUDED_WORKING_TYPES = ["Contract", "Intern", "Temporary", "계약", "촉탁", "인턴"];
const PHYSICAL_INFRA_TITLE_KEYWORDS = ["기계/공조", "공조설비", "MEP", "전기/통신", "네트워크 구축 TA"];

interface SkListResponse {
  success?: boolean;
  totalCount?: number;
  list?: SkJob[];
}

interface SkJob {
  noticeID?: string;
  title?: string;
  jobRole?: string;
  recruitType?: string;
  workingType?: string;
  workingArea?: string;
  remainDay?: number;
  corpName?: string;
  start?: string;
  end?: string;
}

async function fetchText(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
  const r = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      Referer: `${HOST}/Recruit`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

async function fetchList(): Promise<SkListResponse> {
  const body = new URLSearchParams({
    sort: "0",
    searchText: "",
    corpCode: "",
    jobRole: "",
    recruitType: "",
    workingType: "",
    workingRegion: "",
  });
  const res = await fetchText(LIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(res.text) as SkListResponse;
}

function stripHtml(html: string): string {
  return cleanDetail(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#([0-9]+);/g, (_, code) => String.fromCharCode(Number(code))),
    5000,
  );
}

async function fetchDetailText(noticeId: string): Promise<string> {
  const res = await fetchText(`${HOST}/Recruit/Detail/${encodeURIComponent(noticeId)}`);
  return res.ok ? stripHtml(res.text) : "";
}

function normalizeSkDate(raw: string | undefined): string {
  const value = norm(raw);
  const m = value.match(/([A-Za-z]+)\s+([0-9]{1,2}),\s+([0-9]{4})/);
  if (!m) return value;
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
    july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  };
  return `${m[3]}-${months[m[1].toLowerCase()] ?? "01"}-${m[2].padStart(2, "0")}`;
}

function normalizeDate(raw: string | undefined): string {
  const value = norm(raw);
  const korean = value.match(/([0-9]{4})년\s*([0-9]{1,2})월\s*([0-9]{1,2})일/);
  if (korean) return `${korean[1]}-${korean[2].padStart(2, "0")}-${korean[3].padStart(2, "0")}`;
  return normalizeSkDate(value);
}

function skillsFromText(text: string): string[] {
  const skills = ["Java", "Kotlin", "Spring", "Backend", "Server", "Cloud", "Kubernetes", "AI", "Data", "Platform", "Infra", "SRE", "LLM"];
  const low = text.toLowerCase();
  return skills.filter((skill) => low.includes(skill.toLowerCase())).slice(0, 12);
}

async function postingFromJob(job: SkJob): Promise<Posting | null> {
  const id = norm(job.noticeID);
  const title = cleanDetail(job.title, 180);
  const company = cleanDetail(job.corpName, 120);
  if (!id || !title || !company) return null;
  if (!TARGET_COMPANIES.some((target) => company.toLowerCase().includes(target.toLowerCase()))) return null;
  if (EXCLUDED_WORKING_TYPES.some((type) => norm(job.workingType).toLowerCase().includes(type.toLowerCase()))) return null;
  if (Number(job.remainDay ?? 0) < 0) return null;
  if (PHYSICAL_INFRA_TITLE_KEYWORDS.some((keyword) => title.includes(keyword))) return null;

  const detailText = await fetchDetailText(id);
  const fullText = `${company} ${title} ${job.jobRole ?? ""} ${job.recruitType ?? ""} ${job.workingType ?? ""} ${detailText}`;
  const roleText = `${company} ${title} ${job.jobRole ?? ""} ${job.recruitType ?? ""} ${job.workingType ?? ""}`;
  if (isExcludedCompany(fullText)) return null;
  if (isContractRole(roleText)) return null;
  if (isNonServerTitle(title)) return null;
  if (!isServerRole(roleText) && !hasKeyword(roleText, ["software engineering", "sre", "cloud-native", "platform"])) return null;

  const due = normalizeDate(job.end);
  return {
    source: "sk-careers",
    discoveryMode: "official-listing",
    company,
    title,
    url: `${HOST}/Recruit/Detail/${id}`,
    identityHash: `sk-careers:${id}`,
    linkType: "direct_posting",
    postingStatus: "open",
    activeEvidence: `SK Careers official GetRecruitList returned noticeID=${id}`,
    openedAt: normalizeDate(job.start),
    ...closeWindow(due),
    category: norm(job.jobRole),
    summary: `${norm(job.workingArea)} / ${norm(job.workingType)}`,
    tags: classify(fullText),
    skills: skillsFromText(fullText),
    careerUpsideHypothesis: "SK AX/SKT/Tmap의 AI·클라우드·플랫폼 프로젝트에서 대기업 계열 도메인과 AI 전환 레버리지를 얻을 수 있다는 커리어 상승 가설",
    careerUpsideEvidence: ["SK Careers official direct posting", "SK AX/SKT/Tmap Mobility 공식 채용공고", "AI/Data/Cloud/Platform 키워드가 있는 서버·플랫폼 후보"],
    careerUpsideRiskFlags: ["컨설팅/운영 비중이 큰 공고는 hands-on 서버 개발 비중 확인 필요", "계약직/신입/PM/보안 직무는 필터링했지만 상세 직무 범위 재확인 필요"],
    dueTime: due,
    mainTasks: cleanDetail(detailText || `${title} / ${job.jobRole ?? ""}`, 650),
    requirements: cleanDetail(detailText, 650),
    preferred: "",
  };
}

export const skCareersAdapter: SourceAdapter = {
  id: "sk-careers",
  name: "sk-careers",
  async collect(): Promise<AdapterCollectionResult> {
    const errors: string[] = [];
    let rawCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const postings: Posting[] = [];

    try {
      const data = await fetchList();
      if (!data.success) throw new Error("SK Careers list returned success=false");
      const jobs = data.list ?? [];
      rawCount = jobs.length;
      for (const job of jobs) {
        try {
          const posting = await postingFromJob(job);
          if (posting) postings.push(posting);
          else skippedCount++;
        } catch (error) {
          failedCount++;
          errors.push(`sk-careers detail failed ${job.noticeID ?? ""}: ${error}`);
        }
      }
    } catch (error) {
      failedCount++;
      errors.push(`sk-careers list failed: ${error}`);
    }

    return {
      postings,
      diagnostics: {
        source: "sk-careers",
        status: failedCount > 0 ? "partial" : "ok",
        collectedCount: rawCount,
        skippedCount,
        failedCount,
        discoveryModes: ["official-listing", "official-detail"],
        message: `sk-careers diagnostics: raw=${rawCount}, accepted=${postings.length}, skipped=${skippedCount}, failed=${failedCount}`,
      },
      errors,
    };
  },
};
