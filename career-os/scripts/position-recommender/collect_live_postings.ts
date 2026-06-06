#!/usr/bin/env bun
/**
 * Collect lightweight public job postings for position recommendation.
 *
 * Structure:
 * - Source adapters: per-source fetch + source-specific active checks (Wanted, Toss).
 * - Common active validator: enforces the active-snapshot invariant across all sources.
 * - Renderer: sorts and writes the markdown snapshot.
 *
 * Sources:
 * - Wanted public navigation/jobs API + detail API status check.
 * - Toss careers: the career article feed is used only to DISCOVER job-detail CTA
 *   URLs (https://toss.im/career/job-detail?job_id=...). Each job-detail page is
 *   fetched and parsed, and only individual postings with verified JD content +
 *   apply evidence are kept. Career articles themselves are never rendered.
 *
 * Output: markdown summary for Claude position recommender.
 *
 * Usage:
 *   bun collect_live_postings.ts --output <output-md> [--max-wanted N] [--source all|wanted|toss]
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

const UA = "Mozilla/5.0 (OpenClaw career-os position recommender)";

const SERVER_KEYWORDS = [
  "backend", "백엔드", "server", "서버", "spring", "java", "kotlin", "api", "platform", "플랫폼", "gateway",
];
const EXCLUDE_NON_SERVER_KEYWORDS = [
  "data engineer", "데이터 엔지니어", "data scientist", "ml engineer", "ai research", "research engineer",
  "frontend", "front-end", "프론트", "android", "ios", "qa", "product designer", "ux", "pm", "manager", "마케터",
];
const NON_SERVER_TITLE_KEYWORDS = [
  "기획", "서비스 기획", "product manager", "프로덕트 매니저", "po", "pm", "planner",
  "designer", "디자이너", "qa", "frontend", "프론트", "android", "ios", "data engineer",
  "데이터 엔지니어", "ml engineer", "ai research", "마케터", "marketing",
];
const CONTRACT_KEYWORDS = [
  "계약직", "contract", "contractor", "temporary", "temp", "freelance", "프리랜서",
];
const JAVA_SPRING_KEYWORDS = [
  "java", "spring", "spring boot", "springboot", "jpa", "hibernate", "kotlin",
];
const HARD_DOMAIN_KEYWORDS = [
  "commerce", "커머스", "order", "주문", "payment", "payments", "결제", "정산", "페이",
  "bank", "뱅크", "은행", "loan", "대출", "credit", "여신", "수신", "증권", "금융",
  "search", "검색", "platform", "플랫폼", "kafka", "streaming", "backend", "백엔드", "server", "서버",
];
const AI_KEYWORDS = ["ai", "agent", "llm", "rag", "openai", "gemini", "머신러닝", "인공지능"];
const EXCLUDED_COMPANY_KEYWORDS = ["레브잇", "올웨이즈", "rev-it", "revit", "always", "alway"];

// ---- Posting model ------------------------------------------------------

interface Posting {
  source: string;
  company: string;
  title: string;
  url: string;
  linkType: "direct_posting" | "career_article" | "search_page";
  postingStatus: "active" | "open" | "unknown";
  activeEvidence: string;
  openedAt: string;
  closesAt: string;
  daysUntilClose: string;
  closeUrgency: "urgent" | "soon" | "normal" | "no_deadline" | "unknown";
  category: string;
  summary: string;
  tags: string[];
  skills: string[];
  dueTime: string;
  mainTasks: string;
  requirements: string;
  preferred: string;
}

// ---- Shared text helpers ------------------------------------------------

function norm(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function hasKeyword(text: string, keywords: string[]): boolean {
  const low = text.toLowerCase();
  return keywords.some((k) => low.includes(k));
}

function isNonServerTitle(text: string): boolean {
  return hasKeyword(text, NON_SERVER_TITLE_KEYWORDS);
}

function isServerRole(text: string): boolean {
  const low = text.toLowerCase();
  if (EXCLUDE_NON_SERVER_KEYWORDS.some((k) => low.includes(k))) return false;
  return SERVER_KEYWORDS.some((k) => low.includes(k));
}

function isContractRole(text: string): boolean {
  return hasKeyword(text, CONTRACT_KEYWORDS);
}

function isExcludedCompany(text: string): boolean {
  return hasKeyword(text, EXCLUDED_COMPANY_KEYWORDS);
}

function cleanDetail(text: unknown, limit = 420): string {
  let t = norm(text);
  // HTML entity unescape (mirrors Python html.unescape for common entities)
  t = t
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  // Strip HTML tags (mirrors re.sub(r"<[^>]+>", " ", text))
  t = t.replace(/<[^>]+>/g, " ");
  t = norm(t);
  return t.length > limit ? t.slice(0, limit) + "…" : t;
}

function classify(text: string): string[] {
  const low = text.toLowerCase();
  const tags: string[] = [];
  if (
    ["bank", "뱅크", "은행", "loan", "대출", "credit", "여신", "수신", "증권", "금융"].some((k) => low.includes(k))
  )
    tags.push("internet-bank/fintech");
  if (
    ["commerce", "커머스", "order", "주문", "payment", "payments", "결제", "정산", "페이"].some((k) =>
      low.includes(k)
    )
  )
    tags.push("commerce/payment");
  if (["search", "검색", "rag", "opensearch", "elastic", "vector"].some((k) => low.includes(k)))
    tags.push("search/rag");
  if (AI_KEYWORDS.some((k) => low.includes(k))) tags.push("ai-service");
  if (
    ["backend", "백엔드", "server", "서버", "spring", "java", "kafka", "platform", "플랫폼"].some((k) =>
      low.includes(k)
    )
  )
    tags.push("backend-platform");
  return tags.length > 0 ? tags : ["other"];
}

// ---- Close-window helpers -----------------------------------------------

function parseDueDate(raw: unknown): Date | null {
  const value = norm(raw);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysUntil(date: Date): number {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((date.getTime() - now.getTime()) / msPerDay);
}

function closeWindow(rawDueTime: unknown): Pick<Posting, "closesAt" | "daysUntilClose" | "closeUrgency"> {
  const dueTime = norm(rawDueTime);
  if (!dueTime) {
    return {
      closesAt: "no_deadline",
      daysUntilClose: "no_deadline",
      closeUrgency: "no_deadline",
    };
  }

  const dueDate = parseDueDate(dueTime);
  if (!dueDate) {
    return {
      closesAt: dueTime,
      daysUntilClose: "unknown",
      closeUrgency: "unknown",
    };
  }

  const days = daysUntil(dueDate);
  const urgency =
    days < 0 ? "urgent" :
    days <= 3 ? "urgent" :
    days <= 7 ? "soon" :
    "normal";
  return {
    closesAt: dueTime,
    daysUntilClose: String(days),
    closeUrgency: urgency,
  };
}

// ---- Source adapters ----------------------------------------------------

interface AdapterOptions {
  serverOnly: boolean;
  wantedLimit: number;
}

interface SourceAdapter {
  name: string;
  /** Collect raw postings for this source. Source-specific active checks live here. */
  collect(opts: AdapterOptions): Promise<Posting[]>;
  /** Diagnostics note appended to source_errors whenever this adapter runs. */
  note?: string;
}

// --- Wanted adapter ---

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
    if (![...HARD_DOMAIN_KEYWORDS, ...AI_KEYWORDS, ...SERVER_KEYWORDS].some((k) => low.includes(k))) continue;

    const pid = item.id as number;
    let detail: Record<string, unknown> = {};
    if (includeDetail && pid) {
      try {
        detail = await wantedDetail(pid);
      } catch {
        // Active-only policy: do not keep postings whose current status cannot be verified.
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

const wantedAdapter: SourceAdapter = {
  name: "wanted",
  async collect({ serverOnly, wantedLimit }) {
    return fetchWanted(wantedLimit, serverOnly, true);
  },
};

// --- Toss careers adapter ---
//
// Discovery: the Toss career article feed lists career stories whose CTA buttons link
// to individual job-detail pages (https://toss.im/career/job-detail?job_id=...). The
// articles are ONLY a discovery surface — they are never rendered as postings. Each
// discovered job-detail page is fetched and parsed, and a posting is kept only when the
// page returns HTTP 200, exposes title + JD content (via Next __NEXT_DATA__ or HTML),
// and shows apply evidence (applyType / application form / requisitionId / apply button).

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

const tossAdapter: SourceAdapter = {
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

function selectAdapters(
  source: "all" | "wanted" | "toss",
  includeTossArticles: boolean
): SourceAdapter[] {
  const adapters: SourceAdapter[] = [];
  if (source === "all" || source === "wanted") adapters.push(wantedAdapter);
  if (source === "toss" || (source === "all" && includeTossArticles)) adapters.push(tossAdapter);
  return adapters;
}

// ---- Common active validator --------------------------------------------

const ACTIVE_POSTING_STATUSES: ReadonlySet<Posting["postingStatus"]> = new Set(["active", "open"]);

function dedupe(posts: Posting[]): Posting[] {
  const seen = new Set<string>();
  return posts.filter((p) => {
    const key = `${p.source}|${p.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Enforce the active-snapshot invariant for every source: keep only direct
 * individual postings whose status is verified active/open. This is the single
 * gate that guarantees career_article / search_page links and unknown-status
 * postings never leak into the snapshot, regardless of which adapter produced them.
 */
function keepActiveDirectPostings(posts: Posting[]): Posting[] {
  return posts.filter(
    (p) => p.linkType === "direct_posting" && ACTIVE_POSTING_STATUSES.has(p.postingStatus)
  );
}

// ---- Renderer -----------------------------------------------------------

const TAG_PRIORITY: Record<string, number> = {
  "internet-bank/fintech": 0,
  "commerce/payment": 1,
  "search/rag": 2,
  "backend-platform": 3,
  "ai-service": 4,
  other: 9,
};

function postSortKey(p: Posting): [number, number] {
  const text = [p.title, p.mainTasks, p.requirements, p.preferred, ...p.skills].join(" ");
  const javaBonus = hasKeyword(text, JAVA_SPRING_KEYWORDS) ? 0 : 1;
  const tagMin = Math.min(...p.tags.map((t) => TAG_PRIORITY[t] ?? 9));
  return [javaBonus, tagMin];
}

interface CollectionDiagnostics {
  requestedSource: string;
  serverOnly: boolean;
  wantedLimit: number;
  includeTossArticles: boolean;
  errors: string[];
}

function render(posts: Posting[], outPath: string, diagnostics: CollectionDiagnostics): void {
  posts.sort((a, b) => {
    const [aj, at] = postSortKey(a);
    const [bj, bt] = postSortKey(b);
    return aj !== bj ? aj - bj : at - bt;
  });

  const sourceCounts = new Map<string, number>();
  for (const p of posts) sourceCounts.set(p.source, (sourceCounts.get(p.source) ?? 0) + 1);
  const directActiveCount = posts.filter(
    (p) => p.linkType === "direct_posting" && ["active", "open"].includes(p.postingStatus)
  ).length;
  const nonDirectCount = posts.filter((p) => p.linkType !== "direct_posting").length;
  const urgentCount = posts.filter((p) => p.closeUrgency === "urgent").length;
  const soonCount = posts.filter((p) => p.closeUrgency === "soon").length;
  const noDeadlineCount = posts.filter((p) => p.closeUrgency === "no_deadline").length;

  const lines: string[] = [
    "# Live Posting Snapshot",
    "",
    "수집 기준: active-only. `link_type: direct_posting`이고 `posting_status: active/open`인 지원 가능한 개별 공고만 유지한다.",
    "닫힌 공고, 상태 확인 실패 공고, 회사 채용홈, 커리어 아티클, 검색 페이지는 snapshot에서 제외한다.",
    "",
    "## Collection Diagnostics",
    "",
    `- requested_source: ${diagnostics.requestedSource}`,
    `- server_only: ${diagnostics.serverOnly}`,
    `- wanted_limit: ${diagnostics.wantedLimit}`,
    `- include_toss_articles: ${diagnostics.includeTossArticles}`,
    `- total_collected: ${posts.length}`,
    `- direct_active_or_open_postings: ${directActiveCount}`,
    `- non_direct_leads: ${nonDirectCount}`,
    `- close_urgency_counts: urgent=${urgentCount}, soon=${soonCount}, no_deadline=${noDeadlineCount}`,
    `- source_counts: ${Array.from(sourceCounts.entries()).map(([k, v]) => `${k}=${v}`).join(", ") || "-"}`,
    `- source_errors: ${diagnostics.errors.length > 0 ? diagnostics.errors.join(" | ") : "-"}`,
    "",
  ];
  for (const p of posts) {
    lines.push(`- [${p.company}] ${p.title}`);
    lines.push(`  - source: ${p.source}`);
    lines.push(`  - link_type: ${p.linkType}`);
    lines.push(`  - posting_status: ${p.postingStatus}`);
    lines.push(`  - active_evidence: ${p.activeEvidence}`);
    if (p.openedAt) lines.push(`  - opened_at: ${p.openedAt}`);
    lines.push(`  - closes_at: ${p.closesAt}`);
    lines.push(`  - days_until_close: ${p.daysUntilClose}`);
    lines.push(`  - close_urgency: ${p.closeUrgency}`);
    lines.push(`  - tags: ${p.tags.join(", ")}`);
    if (p.summary) lines.push(`  - summary: ${p.summary}`);
    if (p.skills.length > 0) lines.push(`  - skills: ${p.skills.join(", ")}`);
    if (p.dueTime) lines.push(`  - due: ${p.dueTime}`);
    if (p.mainTasks) lines.push(`  - main_tasks: ${p.mainTasks}`);
    if (p.requirements) lines.push(`  - requirements: ${p.requirements}`);
    if (p.preferred) lines.push(`  - preferred: ${p.preferred}`);
    lines.push(`  - url: ${p.url}`);
  }

  const content = lines.join("\n").trimEnd() + "\n";
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, "utf-8");
  console.log(`Wrote live posting snapshot: ${outPath} (${posts.length} postings)`);
}

// ---- CLI ----------------------------------------------------------------

interface CliArgs {
  out: string;
  source: "all" | "wanted" | "toss";
  serverOnly: boolean;
  wantedLimit: number;
  includeTossArticles: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let out = resolve(REPO_ROOT, "career-os/data/runtime/live-position-postings.md");
  let source: "all" | "wanted" | "toss" = "all";
  let serverOnly = true;
  let wantedLimit = 120;
  let includeTossArticles = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === "--out" || arg === "--output") && argv[i + 1]) {
      out = argv[++i];
    } else if (arg === "--source" && argv[i + 1]) {
      const s = argv[++i];
      if (s === "wanted" || s === "toss" || s === "all") source = s;
    } else if (arg === "--max-wanted" && argv[i + 1]) {
      wantedLimit = parseInt(argv[++i], 10);
    } else if (arg === "--no-server-only") {
      serverOnly = false;
    } else if (arg === "--include-toss-articles") {
      includeTossArticles = true;
    }
  }
  return { out, source, serverOnly, wantedLimit, includeTossArticles };
}

async function main(): Promise<number> {
  const { out, source, serverOnly, wantedLimit, includeTossArticles } = parseArgs(process.argv.slice(2));
  const collected: Posting[] = [];
  const errors: string[] = [];

  for (const adapter of selectAdapters(source, includeTossArticles)) {
    try {
      collected.push(...(await adapter.collect({ serverOnly, wantedLimit })));
      if (adapter.note) errors.push(adapter.note);
    } catch (e) {
      errors.push(`${adapter.name}: ${e}`);
    }
  }

  const activePosts = keepActiveDirectPostings(dedupe(collected));
  render(activePosts, out, {
    requestedSource: source,
    serverOnly,
    wantedLimit,
    includeTossArticles,
    errors,
  });
  if (errors.length > 0) {
    console.error(`WARN source errors: ${errors.join("; ")}`);
  }
  return 0;
}

main().then(process.exit).catch((e) => {
  console.error(e);
  process.exit(1);
});
