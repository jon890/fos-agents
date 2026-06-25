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
const HOST = "https://recruit.cj.net";
const LIST_URL = `${HOST}/recruit/ko/recruit/recruit/searchNewGonggoList.fo`;
const TARGET_COMPANY_CODES = ["E10", "F97", "J10"];

interface CjListResponse {
  ErrorCode?: number;
  ds_newRecruitList?: CjJob[];
}

interface CjJob {
  zz_jo_num?: string;
  gubun?: string;
  compnm?: string;
  company?: string;
  zz_title?: string;
  many_lng_zz_title?: string;
  job_cd_nm?: string;
  location_cd_nm?: string;
  zz_str_dt_str?: string;
  zz_end_dt_str?: string | null;
  zz_till_hire?: string;
  zz_close_yn?: string;
  zz_open_yn?: string;
  zz_target_1?: string;
  dday?: number | string;
}

async function fetchText(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
  const r = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      "Accept-Language": "ko-KR,ko;q=0.9",
      Referer: `${HOST}/recruit/ko/recruit/recruit/list.fo`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

async function fetchList(): Promise<CjListResponse> {
  const body = new URLSearchParams({
    pageVal: "1",
    pageIndex: "120",
    orderDesc: "1",
    sch_title: "",
    arrGubun: "B",
    arrRecBu: "",
    arrRecJob: "",
    arrRecArea: "",
    schArea: "N",
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
  return JSON.parse(res.text) as CjListResponse;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string): string {
  return cleanDetail(
    decodeEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    ),
    5000,
  );
}

async function fetchDetailText(jobId: string): Promise<string> {
  const res = await fetchText(`${HOST}/recruit/ko/recruit/recruit/detail.fo?zz_jo_num=${encodeURIComponent(jobId)}`);
  return res.ok ? stripHtml(res.text) : "";
}

function normalizeTitle(job: CjJob): string {
  return cleanDetail(job.many_lng_zz_title || job.zz_title || "", 180).replace(/<BR>/gi, " ");
}

function skillsFromText(text: string): string[] {
  const skills = ["Java", "Kotlin", "Spring", "Backend", "Server", "Cloud", "AWS", "Kubernetes", "AI", "Data", "Platform", "MySQL"];
  const low = text.toLowerCase();
  return skills.filter((skill) => low.includes(skill.toLowerCase())).slice(0, 12);
}

async function postingFromJob(job: CjJob): Promise<Posting | null> {
  const id = norm(job.zz_jo_num);
  const title = normalizeTitle(job);
  const company = cleanDetail(job.compnm, 120);
  if (!id || !title || !company) return null;
  if (!TARGET_COMPANY_CODES.includes(norm(job.company))) return null;
  if (job.zz_open_yn !== "Y" || job.zz_close_yn === "Y") return null;
  if (String(job.dday ?? "") === "00000") return null;

  const detailText = await fetchDetailText(id);
  const fullText = `${company} ${title} ${job.job_cd_nm ?? ""} ${job.location_cd_nm ?? ""} ${detailText}`;
  const roleText = `${company} ${title} ${job.job_cd_nm ?? ""} ${job.location_cd_nm ?? ""}`;
  if (isExcludedCompany(fullText)) return null;
  if (isContractRole(roleText)) return null;
  if (isNonServerTitle(title)) return null;
  if (!isServerRole(roleText) && !hasKeyword(roleText, ["백엔드개발", "backend engineer"])) return null;

  const due = job.zz_till_hire === "Y" ? "" : norm(job.zz_end_dt_str);
  return {
    source: "cj-careers",
    discoveryMode: "official-listing",
    company,
    title,
    url: `${HOST}/recruit/ko/recruit/recruit/detail.fo?zz_jo_num=${encodeURIComponent(id)}`,
    identityHash: `cj-careers:${id}`,
    linkType: "direct_posting",
    postingStatus: "open",
    activeEvidence: `CJ Recruit official searchNewGonggoList returned zz_jo_num=${id}`,
    openedAt: norm(job.zz_str_dt_str),
    ...closeWindow(due),
    category: norm(job.job_cd_nm),
    summary: `${norm(job.location_cd_nm)} / ${company}`,
    tags: classify(fullText),
    skills: skillsFromText(fullText),
    careerUpsideHypothesis: "CJ 계열 디지털 서비스의 회원·커머스·콘텐츠 플랫폼에서 대기업 서비스 백엔드 경험을 확장할 수 있다는 커리어 상승 가설",
    careerUpsideEvidence: ["CJ Recruit official direct posting", "CJ올리브네트웍스/올리브영/ENM 공식 채용공고", "백엔드개발 직무 코드 또는 서버 키워드"],
    careerUpsideRiskFlags: ["CJ 계열은 회사별 기술 성숙도와 보상 상한 확인 필요", "상세 JD에서 레거시/운영 비중이 큰지 확인 필요"],
    dueTime: due,
    mainTasks: cleanDetail(`${title} / ${job.job_cd_nm ?? ""} / ${job.location_cd_nm ?? ""}`, 650),
    requirements: "CJ Recruit 공식 목록 API에서 백엔드개발 직무로 확인했다. 세부 자격요건은 개별 공고 상세에서 재확인한다.",
    preferred: "CJ ONE/회원/커머스 서비스 경험과 Java/Spring 백엔드 운영 경험의 전이성을 확인한다.",
  };
}

export const cjCareersAdapter: SourceAdapter = {
  id: "cj-careers",
  name: "cj-careers",
  async collect(): Promise<AdapterCollectionResult> {
    const errors: string[] = [];
    let rawCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const postings: Posting[] = [];

    try {
      const data = await fetchList();
      if (data.ErrorCode && data.ErrorCode !== 0) throw new Error(`CJ Recruit ErrorCode=${data.ErrorCode}`);
      const jobs = data.ds_newRecruitList ?? [];
      rawCount = jobs.length;
      for (const job of jobs) {
        try {
          const posting = await postingFromJob(job);
          if (posting) postings.push(posting);
          else skippedCount++;
        } catch (error) {
          failedCount++;
          errors.push(`cj-careers detail failed ${job.zz_jo_num ?? ""}: ${error}`);
        }
      }
    } catch (error) {
      failedCount++;
      errors.push(`cj-careers list failed: ${error}`);
    }

    return {
      postings,
      diagnostics: {
        source: "cj-careers",
        status: failedCount > 0 ? "partial" : "ok",
        collectedCount: rawCount,
        skippedCount,
        failedCount,
        discoveryModes: ["official-listing", "official-detail"],
        message: `cj-careers diagnostics: target_companies=${TARGET_COMPANY_CODES.join(",")}, raw=${rawCount}, accepted=${postings.length}, skipped=${skippedCount}, failed=${failedCount}`,
      },
      errors,
    };
  },
};
