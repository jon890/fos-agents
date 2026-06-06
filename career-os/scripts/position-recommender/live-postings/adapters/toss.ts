import type { Posting, SourceAdapter } from "../types.ts";
import {
  CONTRACT_KEYWORDS,
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

const TOSS_HOST = "https://toss.im";
const TOSS_POSTS_API =
  "https://api-public.toss.im/api-public/v3/ipd-thor/api/v1/workspaces/13/posts";
const TOSS_FEED_URLS = [
  "https://toss.im/career/jobs",
  "https://toss.im/career",
];
const TOSS_MAX_POST_PAGES = 5;
const TOSS_MAX_ARTICLES = 25;
const TOSS_MAX_JOB_DETAILS = 80;

// Employment types excluded for Toss (contract/intern/freelance). Kept separate from the
// shared CONTRACT_KEYWORDS so the Wanted adapter's filtering is left unchanged.
const TOSS_EXCLUDE_EMPLOYMENT = [
  ...CONTRACT_KEYWORDS, "intern", "인턴", "internship", "체험형", "현장실습",
];
const TOSS_SERVER_TITLE_KEYWORDS = [
  "backend", "백엔드", "server", "서버", "node.js", "nodejs", "java", "spring", "kotlin",
];

const TOSS_APPLY_EVIDENCE_KEYS = [
  "applyType", "apply_type", "applyUrl", "apply_url", "applyLink", "apply_link",
  "requisitionId", "requisition_id", "applicationForm", "application_form",
  "greenhouseId", "ashbyId", "applyButton",
];
const TOSS_TITLE_KEYS = ["title", "jobTitle", "positionName", "position", "name", "subject"];
const TOSS_CONTENT_KEYS = [
  "description", "jobDescription", "content", "body", "detail", "responsibilities",
  "mainTasks", "main_tasks", "requirements", "qualifications", "preferred",
  "preferredPoints", "preferred_points", "recommended",
];
const TOSS_EMPLOYMENT_KEYS = [
  "employmentType", "employment_type", "jobType", "job_type", "contractType",
  "contract_type", "employeeType", "employee_type", "workType", "hireType",
];
const TOSS_DEADLINE_KEYS = [
  "dueDate", "due_date", "deadline", "closingDate", "closing_date", "closesAt",
  "closes_at", "endDate", "end_date", "applicationDeadline", "dueTime", "due_time",
];
const TOSS_DEPARTMENT_KEYS = ["department", "team", "organization", "group", "jobCategory"];

interface TossFetchResult {
  ok: boolean;
  status: number;
  text: string;
}

async function tossFetch(url: string): Promise<TossFetchResult> {
  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "ko-KR,ko;q=0.9",
      Origin: TOSS_HOST,
      Referer: "https://toss.im/career/jobs",
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = r.ok ? await r.text() : "";
  return { ok: r.ok, status: r.status, text };
}

function extractNextData(html: string): unknown {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/** Distinct job_id values reachable from job-detail CTA links in this HTML/JSON text. */
function extractJobDetailIds(text: string): string[] {
  const ids = new Set<string>();
  const re = /job-detail\?job_id=([0-9A-Za-z._~-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) ids.add(m[1]);
  return [...ids];
}

async function collectTossPostApiJobIds(maxPages = TOSS_MAX_POST_PAGES): Promise<{
  articleCount: number;
  ids: string[];
}> {
  const ids = new Set<string>();
  let articleCount = 0;
  for (let page = 1; page <= maxPages; page++) {
    const res = await tossFetch(`${TOSS_POSTS_API}?page=${page}`);
    if (!res.ok) break;
    const data = JSON.parse(res.text) as { success?: { results?: unknown[]; next?: string | null } };
    const results = data.success?.results ?? [];
    articleCount += results.length;
    for (const raw of results) {
      for (const id of extractJobDetailIds(JSON.stringify(raw))) ids.add(id);
    }
    if (!data.success?.next) break;
  }
  return { articleCount, ids: [...ids] };
}

/** Career-article (non job-detail) links under /career, used only to find more CTAs. */
function extractTossArticleUrls(html: string): string[] {
  const urls = new Set<string>();
  const re = /\/career\/(?:article|story|stories|blog|news)[^"'\s)]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const path = m[0].replace(/&amp;/g, "&");
    urls.add(path.startsWith("http") ? path : TOSS_HOST + path);
  }
  return [...urls];
}

/** Depth-first scan for the first non-empty string/number value under any of `keys`. */
function deepFindString(node: unknown, keys: string[]): string {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const stack: unknown[] = [node];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
    } else if (cur && typeof cur === "object") {
      for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
        if (wanted.has(k.toLowerCase()) && (typeof v === "string" || typeof v === "number")) {
          const s = cleanDetail(v, 2000);
          if (s) return s;
        }
        stack.push(v);
      }
    }
  }
  return "";
}

/** Collect up to `limit` string/number values under any of `keys` (for JD assembly). */
function deepCollectStrings(node: unknown, keys: string[], limit = 6): string[] {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const out: string[] = [];
  const stack: unknown[] = [node];
  while (stack.length > 0 && out.length < limit) {
    const cur = stack.pop();
    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
    } else if (cur && typeof cur === "object") {
      for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
        if (wanted.has(k.toLowerCase()) && (typeof v === "string" || typeof v === "number")) {
          const s = cleanDetail(v, 600);
          if (s) out.push(s);
        }
        stack.push(v);
      }
    }
  }
  return out;
}

/** True if any of `keys` exists with a meaningful (non-empty) value anywhere in the tree. */
function deepHasKey(node: unknown, keys: string[]): boolean {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const stack: unknown[] = [node];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
    } else if (cur && typeof cur === "object") {
      for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
        if (wanted.has(k.toLowerCase())) {
          if (v !== null && v !== "" && v !== false && !(Array.isArray(v) && v.length === 0)) return true;
        }
        stack.push(v);
      }
    }
  }
  return false;
}

function parseNestedJsonStrings(node: unknown, limit = 30): unknown[] {
  const out: unknown[] = [];
  const stack: unknown[] = [node];
  while (stack.length > 0 && out.length < limit) {
    const cur = stack.pop();
    if (typeof cur === "string") {
      const value = cur.trim();
      if (
        value.startsWith("{") &&
        (value.includes('"applyType"') || value.includes('"requisitionId"') || value.includes('"description"'))
      ) {
        try {
          out.push(JSON.parse(value));
        } catch {
          // Ignore non-JSON strings; the outer Next payload remains available.
        }
      }
    } else if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
    } else if (cur && typeof cur === "object") {
      for (const v of Object.values(cur as Record<string, unknown>)) stack.push(v);
    }
  }
  return out;
}

function tossRoots(data: unknown): unknown[] {
  return data ? [data, ...parseNestedJsonStrings(data)] : [];
}

function deepFindStringAny(roots: unknown[], keys: string[]): string {
  for (const root of roots) {
    const found = deepFindString(root, keys);
    if (found) return found;
  }
  return "";
}

function deepCollectStringsAny(roots: unknown[], keys: string[], limit = 6): string[] {
  const out: string[] = [];
  for (const root of roots) {
    out.push(...deepCollectStrings(root, keys, limit - out.length));
    if (out.length >= limit) break;
  }
  return out;
}

function deepHasKeyAny(roots: unknown[], keys: string[]): boolean {
  return roots.some((root) => deepHasKey(root, keys));
}

function htmlMeta(html: string, prop: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i");
  const m = html.match(re);
  return m ? cleanDetail(m[1]) : "";
}

function htmlTitle(html: string): string {
  const og = htmlMeta(html, "og:title");
  if (og) return og;
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? cleanDetail(m[1]).replace(/\s*[|\-–]\s*토스.*$/, "").trim() : "";
}

interface TossParse {
  posting?: Posting;
  reject?: string;
}

function parseTossJobDetail(
  url: string,
  res: TossFetchResult,
  serverOnly: boolean
): TossParse {
  if (!res.ok) return { reject: "http" };
  const html = res.text;
  const data = extractNextData(html);
  const roots = tossRoots(data);

  let title = deepFindStringAny(roots, TOSS_TITLE_KEYS);
  if (!title) title = htmlTitle(html);

  let content = deepCollectStringsAny(roots, TOSS_CONTENT_KEYS).join(" ");
  if (!content) {
    // HTML fallback: strip scripts/styles/tags and keep the visible body text.
    content = cleanDetail(
      html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "),
      4000
    );
  }

  if (!title || !content) return { reject: "no_content" };

  const applyEvidence =
    deepHasKeyAny(roots, TOSS_APPLY_EVIDENCE_KEYS) ||
    /지원\s*하기|apply\s*now|"applyType"|requisition|application-form|apply-button/i.test(html);
  if (!applyEvidence) return { reject: "no_apply_evidence" };

  const employment = deepFindStringAny(roots, TOSS_EMPLOYMENT_KEYS);
  const fullText = `${title} ${content} ${employment}`;
  if (hasKeyword(fullText, TOSS_EXCLUDE_EMPLOYMENT)) return { reject: "contract_intern_freelance" };

  if (serverOnly && isNonServerTitle(title)) return { reject: "not_server" };
  if (serverOnly && !hasKeyword(title, TOSS_SERVER_TITLE_KEYWORDS)) return { reject: "not_server_title" };
  if (serverOnly && !isServerRole(fullText)) return { reject: "not_server" };

  const department = deepFindStringAny(roots, TOSS_DEPARTMENT_KEYS);
  const dueRaw = deepFindStringAny(roots, TOSS_DEADLINE_KEYS);
  // Rolling / always-open postings carry no real deadline.
  const due = /상시|수시|always|rolling/i.test(dueRaw) ? "" : dueRaw;

  return {
    posting: {
      source: "toss-careers",
      company: deepFindStringAny(roots, ["companyName", "company"]) || "Toss",
      title,
      url,
      linkType: "direct_posting",
      postingStatus: "open",
      activeEvidence: "job-detail page + apply evidence",
      openedAt: "",
      ...closeWindow(due),
      category: department,
      summary: department,
      tags: classify(fullText),
      skills: [],
      dueTime: due,
      mainTasks: deepFindStringAny(roots, ["responsibilities", "mainTasks", "main_tasks", "role"]),
      requirements: deepFindStringAny(roots, ["requirements", "qualifications"]),
      preferred: deepFindStringAny(roots, ["preferred", "preferredPoints", "preferred_points"]),
    },
  };
}

export const tossAdapter: SourceAdapter = {
  name: "toss-careers",
  async collect({ serverOnly }) {
    const rejected: Record<string, number> = {};
    const reject = (r: string) => {
      rejected[r] = (rejected[r] ?? 0) + 1;
    };
    const articleUrls = new Set<string>();
    const jobIds = new Set<string>();

    // 1. Discovery: the public article API exposes CTA job-detail URLs. The API
    // results themselves are still treated only as discovery articles.
    try {
      const api = await collectTossPostApiJobIds();
      for (const id of api.ids) jobIds.add(id);
      for (let i = 0; i < api.articleCount; i++) articleUrls.add(`api-public-post:${i + 1}`);
    } catch {
      reject("post_api_http");
    }

    // 2. Discovery fallback: pull job-detail CTA ids + career-article links from the HTML feed.
    for (const feed of TOSS_FEED_URLS) {
      try {
        const res = await tossFetch(feed);
        if (!res.ok) {
          reject("feed_http");
          continue;
        }
        for (const id of extractJobDetailIds(res.text)) jobIds.add(id);
        for (const a of extractTossArticleUrls(res.text)) articleUrls.add(a);
      } catch {
        reject("feed_http");
      }
    }

    // 3. Follow a bounded set of career article pages to find more job-detail CTAs.
    const htmlArticleUrls = [...articleUrls].filter((a) => a.startsWith("http"));
    for (const a of htmlArticleUrls.slice(0, TOSS_MAX_ARTICLES)) {
      try {
        const res = await tossFetch(a);
        if (!res.ok) continue;
        for (const id of extractJobDetailIds(res.text)) jobIds.add(id);
      } catch {
        // Individual article fetch failures are non-fatal for discovery.
      }
    }

    // 4. Fetch + validate each discovered job-detail page.
    const out: Posting[] = [];
    for (const id of [...jobIds].slice(0, TOSS_MAX_JOB_DETAILS)) {
      const url = `${TOSS_HOST}/career/job-detail?job_id=${id}`;
      let res: TossFetchResult;
      try {
        res = await tossFetch(url);
      } catch {
        reject("http");
        continue;
      }
      const parsed = parseTossJobDetail(url, res, serverOnly);
      if (parsed.posting) out.push(parsed.posting);
      else if (parsed.reject) reject(parsed.reject);
    }

    const rejectSummary =
      Object.entries(rejected)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ") || "-";
    tossAdapter.note =
      `toss-careers diagnostics: article_candidates=${articleUrls.size}, ` +
      `job_detail_urls=${jobIds.size}, accepted=${out.length}, rejected={${rejectSummary}}`;
    return out;
  },
};
