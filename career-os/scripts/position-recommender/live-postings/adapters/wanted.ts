import type { AdapterCollectionResult, DiscoveryMode, Posting, SourceAdapter } from "../types.ts";
import {
  cleanDetail,
  classify,
  closeWindow,
  isContractRole,
  isNonTargetTitle,
  isTargetRole,
  norm,
} from "../policy.ts";
const UA = "Mozilla/5.0 (fos-agents position recommender)";
// Wanted의 개발 전체 직군이다. 백엔드와 AI Platform 후보는 후속 역할 경계에서 선별한다.
const WANTED_DEVELOPMENT_JOB_GROUP_ID = 518;

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

function wantedPidFromUrl(url: string): number | null {
  const m = url.match(/\/wd\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function postingFromWantedDetail(
  pid: number,
  detail: Record<string, unknown>,
  discoveryMode: DiscoveryMode,
  targetRoleOnly: boolean,
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
  if (isContractRole(fullText)) return null;
  if (targetRoleOnly && isNonTargetTitle(title)) return null;
  if (targetRoleOnly && !isTargetRole(fullText)) return null;

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

async function fetchWanted(
  jobGroupId: number,
  limit = 120,
  targetRoleOnly = true,
  includeDetail = true
): Promise<Posting[]> {
  const params = new URLSearchParams({
    job_group_id: String(jobGroupId),
    country: "kr",
    job_sort: "job.latest_order",
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
    if (targetRoleOnly && isNonTargetTitle(`${title} ${categoryText}`)) continue;
    if (targetRoleOnly && !isTargetRole(text)) continue;
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
    const posting = postingFromWantedDetail(pid, detail, "broad", targetRoleOnly, {
      company,
      title,
      category: categoryText,
      summary: norm(addressObj.location),
    });
    if (posting) out.push(posting);
  }
  return out;
}

export const wantedAdapter: SourceAdapter = {
  id: "wanted",
  name: "wanted",
  async collect({ targetRoleOnly, wantedLimit }): Promise<AdapterCollectionResult> {
    const postings = await fetchWanted(
      WANTED_DEVELOPMENT_JOB_GROUP_ID,
      wantedLimit,
      targetRoleOnly,
      true,
    );
    return {
      postings,
      diagnostics: {
        source: "wanted",
        status: "ok",
        collectedCount: postings.length,
        skippedCount: 0,
        failedCount: 0,
        discoveryModes: ["broad"],
        message: `wanted diagnostics: broad=${postings.length}`,
      },
    };
  },
};
