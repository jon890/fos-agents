import type { AdapterCollectionResult, DiscoveryMode, Posting, SourceAdapter } from "../types.ts";
import {
  AI_KEYWORDS,
  AI_PLATFORM_ROLE_KEYWORDS,
  HARD_DOMAIN_KEYWORDS,
  SERVER_KEYWORDS,
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
const WANTED_TARGET_URLS = [
  "https://www.wanted.co.kr/wd/344103",
  "https://www.wanted.co.kr/wd/360452",
  "https://www.wanted.co.kr/wd/356931",
  "https://www.wanted.co.kr/wd/364006",
];
const WANTED_TARGET_KEYWORDS = [
  "쿠팡 백엔드",
  "쿠팡 서버 개발자",
  "쿠팡페이 백엔드",
  "네이버 백엔드",
  "네이버파이낸셜 서버 개발자",
  "라인 백엔드",
  "LINE backend engineer",
  "카카오뱅크 백엔드",
  "카카오모빌리티 백엔드",
  "우아한형제들 백엔드",
  "당근 백엔드",
  "오늘의집 백엔드",
  "AI Agent 백엔드",
  "Applied AI Engineer",
  "AI Engineer LLM RAG Agent",
  "MCP 서버 AI",
  "LLM 백엔드",
  "RAG 백엔드",
  "AI Platform Engineer",
  "ML Backend Engineer",
  "LLMOps MLOps 플랫폼",
  "Workflow Automation AI",
];

function isWantedActive(job: Record<string, unknown>): boolean {
  const status = norm(job.status ?? "").toLowerCase();
  return status === "active";
}

async function wantedDetail(pid: number): Promise<Record<string, unknown>> {
  const r = await fetch(`https://www.wanted.co.kr/api/v4/jobs/${pid}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`wanted detail ${pid}: HTTP ${r.status}`);
  const data = (await r.json()) as Record<string, unknown>;
  return (data.job as Record<string, unknown>) ?? {};
}

async function wantedKeywordSearch(query: string, limit = 12): Promise<number[]> {
  const params = new URLSearchParams({
    query,
    country: "kr",
    job_sort: "job.latest_order",
    years: "3",
    locations: "all",
    limit: String(limit),
  });
  const r = await fetch(`https://www.wanted.co.kr/api/chaos/search/v1/position?${params}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`wanted keyword-search ${query}: HTTP ${r.status}`);
  const data = (await r.json()) as { data?: unknown[] };
  return (data.data ?? [])
    .map((rawItem) => (rawItem as Record<string, unknown>).id)
    .filter((id): id is number => typeof id === "number");
}

function wantedPidFromUrl(url: string): number | null {
  const m = url.match(/\/wd\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function postingFromWantedDetail(
  pid: number,
  detail: Record<string, unknown>,
  discoveryMode: DiscoveryMode,
  serverOnly: boolean,
  fallback?: {
    company?: string;
    title?: string;
    category?: string;
    summary?: string;
  }
): Posting | null {
  if (!isWantedActive(detail)) return null;

  const d = (
    typeof detail.detail === "object" && detail.detail !== null ? detail.detail : {}
  ) as Record<string, unknown>;
  const companyDetail = (
    typeof detail.company === "object" && detail.company !== null ? detail.company : {}
  ) as Record<string, unknown>;
  const company = norm(companyDetail.name ?? fallback?.company);
  const title = norm(detail.position ?? fallback?.title);
  const detailText = (["intro", "main_tasks", "requirements", "preferred_points"] as const)
    .map((k) => norm(d[k]))
    .join(" ");
  const employeeTypeTags = (detail.employee_type_tags as unknown[]) ?? [];
  const employeeType = employeeTypeTags
    .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
    .map((t) => norm(t.title ?? t.name ?? t.commonName))
    .join(" ");
  const fullText = `${company} ${title} ${fallback?.category ?? ""} ${employeeType} ${detailText}`;

  if (!company || !title) return null;
  if (isExcludedCompany(fullText)) return null;
  if (isContractRole(fullText)) return null;
  if (serverOnly && isNonServerTitle(title)) return null;
  if (serverOnly && !isServerRole(fullText)) return null;

  const skillTags = (detail.skill_tags as unknown[]) ?? [];
  const skills = skillTags
    .map((tag) => {
      if (typeof tag === "object" && tag !== null) {
        const t = tag as Record<string, unknown>;
        return norm(t.title ?? t.name);
      }
      return norm(tag);
    })
    .filter(Boolean)
    .slice(0, 12);

  const categoryTags = (detail.category_tags as unknown[]) ?? [];
  const category =
    categoryTags
      .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
      .map((t) => norm(t.title))
      .filter(Boolean)
      .join(", ") || fallback?.category || "";

  return {
    source: "wanted",
    discoveryMode,
    company,
    title,
    url: `https://www.wanted.co.kr/wd/${pid}`,
    identityHash: `wanted:${pid}`,
    linkType: "direct_posting",
    postingStatus: "active",
    activeEvidence: `Wanted API detail status=active (${discoveryMode})`,
    openedAt: "",
    ...closeWindow(detail.due_time),
    category,
    summary: fallback?.summary ?? "",
    tags: classify(fullText),
    skills,
    dueTime: norm(detail.due_time),
    mainTasks: cleanDetail(d.main_tasks),
    requirements: cleanDetail(d.requirements),
    preferred: cleanDetail(d.preferred_points),
  };
}

async function fetchWanted(limit = 120, serverOnly = true, includeDetail = true): Promise<Posting[]> {
  const params = new URLSearchParams({
    job_group_id: "518",
    country: "kr",
    job_sort: "job.latest_order",
    years: "3",
    locations: "all",
    limit: String(limit),
  });
  const r = await fetch(
    `https://www.wanted.co.kr/api/chaos/navigation/v1/results?${params}`,
    { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) }
  );
  if (!r.ok) throw new Error(`wanted navigation: HTTP ${r.status}`);
  const data = (await r.json()) as { data?: unknown[] };

  const out: Posting[] = [];
  for (const rawItem of data.data ?? []) {
    const item = rawItem as Record<string, unknown>;
    const companyObj = (item.company ?? {}) as Record<string, unknown>;
    const catTagObj = (item.category_tag ?? {}) as Record<string, unknown>;
    const company = norm(companyObj.name);
    const title = norm(item.position);
    const categoryText = norm(catTagObj.text);
    const text = `${company} ${title} ${categoryText}`;
    const low = text.toLowerCase();

    if (isExcludedCompany(text)) continue;
    if (serverOnly && isNonServerTitle(`${title} ${categoryText}`)) continue;
    if (serverOnly && !isServerRole(text)) continue;
    if (![...HARD_DOMAIN_KEYWORDS, ...AI_KEYWORDS, ...SERVER_KEYWORDS, ...AI_PLATFORM_ROLE_KEYWORDS].some((k) => low.includes(k))) continue;

    const pid = item.id as number;
    let detail: Record<string, unknown> = {};
    if (includeDetail && pid) {
      try {
        detail = await wantedDetail(pid);
      } catch {
        continue;
      }
    }
    if (includeDetail && (Object.keys(detail).length === 0 || !isWantedActive(detail))) continue;

    const addressObj = (item.address ?? {}) as Record<string, unknown>;
    const posting = postingFromWantedDetail(pid, detail, "broad", serverOnly, {
      company,
      title,
      category: categoryText,
      summary: norm(addressObj.location),
    });
    if (posting) out.push(posting);
  }
  return out;
}

async function fetchWantedTargets(serverOnly = true): Promise<{
  postings: Posting[];
  skippedCount: number;
  failedCount: number;
  errors: string[];
}> {
  const postings: Posting[] = [];
  let skippedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];
  for (const url of WANTED_TARGET_URLS) {
    const pid = wantedPidFromUrl(url);
    if (!pid) {
      skippedCount++;
      errors.push(`wanted target-url invalid: ${url}`);
      continue;
    }
    try {
      const detail = await wantedDetail(pid);
      const posting = postingFromWantedDetail(pid, detail, "target-url", serverOnly);
      if (posting) postings.push(posting);
      else skippedCount++;
    } catch (error) {
      failedCount++;
      errors.push(`wanted target-url ${pid}: ${error}`);
    }
  }
  return { postings, skippedCount, failedCount, errors };
}

async function fetchWantedKeywordTargets(serverOnly = true): Promise<{
  postings: Posting[];
  searchedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: string[];
}> {
  const postings: Posting[] = [];
  const seenPids = new Set<number>();
  let skippedCount = 0;
  let failedCount = 0;
  let searchedCount = 0;
  const errors: string[] = [];

  for (const keyword of WANTED_TARGET_KEYWORDS) {
    try {
      const pids = await wantedKeywordSearch(keyword);
      searchedCount += pids.length;
      for (const pid of pids) {
        if (seenPids.has(pid)) continue;
        seenPids.add(pid);
        try {
          const detail = await wantedDetail(pid);
          const posting = postingFromWantedDetail(pid, detail, "target-keyword", serverOnly);
          if (posting) postings.push(posting);
          else skippedCount++;
        } catch (error) {
          failedCount++;
          errors.push(`wanted target-keyword detail ${pid}: ${error}`);
        }
      }
    } catch (error) {
      failedCount++;
      errors.push(`${error}`);
    }
  }
  return { postings, searchedCount, skippedCount, failedCount, errors };
}

export const wantedAdapter: SourceAdapter = {
  id: "wanted",
  name: "wanted",
  async collect({ serverOnly, wantedLimit }): Promise<AdapterCollectionResult> {
    const broad = await fetchWanted(wantedLimit, serverOnly, true);
    const targets = await fetchWantedTargets(serverOnly);
    const keywordTargets = await fetchWantedKeywordTargets(serverOnly);
    const postings = [...broad, ...targets.postings, ...keywordTargets.postings];
    return {
      postings,
      diagnostics: {
        source: "wanted",
        status: targets.failedCount > 0 || keywordTargets.failedCount > 0 ? "partial" : "ok",
        collectedCount: postings.length,
        skippedCount: targets.skippedCount + keywordTargets.skippedCount,
        failedCount: targets.failedCount + keywordTargets.failedCount,
        discoveryModes: ["broad", "target-url", "target-keyword"],
        message:
          `wanted diagnostics: broad=${broad.length}, target_url=${targets.postings.length}, ` +
          `target_keyword=${keywordTargets.postings.length}/${keywordTargets.searchedCount}, ` +
          `target_skipped=${targets.skippedCount + keywordTargets.skippedCount}, ` +
          `target_failed=${targets.failedCount + keywordTargets.failedCount}`,
      },
      errors: [...targets.errors, ...keywordTargets.errors],
    };
  },
};
