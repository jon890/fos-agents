import type { Posting, SourceAdapter } from "../types.ts";
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

    const d = (
      typeof detail.detail === "object" && detail.detail !== null ? detail.detail : {}
    ) as Record<string, unknown>;
    const companyDetail = (
      typeof detail.company === "object" && detail.company !== null ? detail.company : {}
    ) as Record<string, unknown>;
    const detailText = (["intro", "main_tasks", "requirements", "preferred_points"] as const)
      .map((k) => norm(d[k]))
      .join(" ");
    const employeeTypeTags = (detail.employee_type_tags as unknown[]) ?? [];
    const employeeType = employeeTypeTags
      .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
      .map((t) => norm(t.title ?? t.name ?? t.commonName))
      .join(" ");
    const fullText = `${text} ${employeeType} ${detailText}`;

    if (isExcludedCompany(fullText)) continue;
    if (isContractRole(fullText)) continue;
    if (serverOnly && !isServerRole(fullText)) continue;

    const tags = classify(fullText);

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
        .join(", ") || categoryText;

    const addressObj = (item.address ?? {}) as Record<string, unknown>;
    const close = closeWindow(detail.due_time);

    out.push({
      source: "wanted",
      company: norm(companyDetail.name ?? company),
      title: norm(detail.position ?? title),
      url: `https://www.wanted.co.kr/wd/${pid}`,
      linkType: "direct_posting",
      postingStatus: "active",
      activeEvidence: "Wanted API detail status=active",
      openedAt: "",
      ...close,
      category,
      summary: norm(addressObj.location),
      tags,
      skills,
      dueTime: norm(detail.due_time),
      mainTasks: cleanDetail(d.main_tasks),
      requirements: cleanDetail(d.requirements),
      preferred: cleanDetail(d.preferred_points),
    });
  }
  return out;
}

export const wantedAdapter: SourceAdapter = {
  name: "wanted",
  async collect({ serverOnly, wantedLimit }) {
    return fetchWanted(wantedLimit, serverOnly, true);
  },
};
