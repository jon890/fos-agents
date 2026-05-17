#!/usr/bin/env bun
/**
 * Collect lightweight public job postings for position recommendation.
 *
 * Sources:
 * - Wanted public navigation/jobs API for active broad tech postings.
 * - Toss career public post API for tech recruiting stories/postings.
 *
 * Output: markdown summary for Claude position recommender.
 *
 * Usage:
 *   bun collect_live_postings.ts --output <output-md> [--max-wanted N] [--source all|wanted|toss]
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";

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

interface Posting {
  source: string;
  company: string;
  title: string;
  url: string;
  category: string;
  summary: string;
  tags: string[];
  skills: string[];
  dueTime: string;
  mainTasks: string;
  requirements: string;
  preferred: string;
}

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

function isWantedActive(job: Record<string, unknown>): boolean {
  const status = norm(job.status ?? "").toLowerCase();
  if (!status) return true;
  return status === "active";
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

    if (serverOnly && isNonServerTitle(`${title} ${categoryText}`)) continue;
    if (serverOnly && !isServerRole(text)) continue;
    if (![...HARD_DOMAIN_KEYWORDS, ...AI_KEYWORDS, ...SERVER_KEYWORDS].some((k) => low.includes(k))) continue;

    const pid = item.id as number;
    let detail: Record<string, unknown> = {};
    if (includeDetail && pid) {
      try {
        detail = await wantedDetail(pid);
      } catch {
        // ignore detail fetch failures — use list-level data only
      }
    }
    if (includeDetail && Object.keys(detail).length > 0 && !isWantedActive(detail)) continue;

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

    out.push({
      source: "wanted",
      company: norm(companyDetail.name ?? company),
      title: norm(detail.position ?? title),
      url: `https://www.wanted.co.kr/wd/${pid}`,
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

async function fetchToss(maxPages = 8): Promise<Posting[]> {
  const base = "https://api-public.toss.im/api-public/v3/ipd-thor/api/v1/workspaces/13/posts";
  const headers = {
    "User-Agent": UA,
    Origin: "https://toss.im",
    Referer: "https://toss.im/career/jobs",
  };
  const out: Posting[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const r = await fetch(`${base}?page=${page}`, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`toss page ${page}: HTTP ${r.status}`);
    const data = (await r.json()) as { success?: { results?: unknown[] } };
    for (const rawItem of data.success?.results ?? []) {
      const item = rawItem as Record<string, unknown>;
      const title = norm(item.title);
      const company = norm(item.category ?? "토스");
      const short = norm(item.shortDescription ?? item.subtitle);
      const key = item.key ?? item.id;
      const text = `${company} ${title} ${short}`;
      const low = text.toLowerCase();

      if (![...HARD_DOMAIN_KEYWORDS, ...AI_KEYWORDS, ...SERVER_KEYWORDS].some((k) => low.includes(k))) continue;
      if (isNonServerTitle(title)) continue;
      if (isContractRole(text)) continue;
      if (!isServerRole(text)) continue;

      out.push({
        source: "toss-careers",
        company,
        title,
        url: `https://toss.im/career/article/${key}`,
        category: company,
        summary: short,
        tags: classify(text),
        skills: [],
        dueTime: "",
        mainTasks: "",
        requirements: "",
        preferred: "",
      });
    }
  }
  return out;
}

function dedupe(posts: Posting[]): Posting[] {
  const seen = new Set<string>();
  return posts.filter((p) => {
    const key = `${p.source}|${p.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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

function render(posts: Posting[], outPath: string): void {
  posts.sort((a, b) => {
    const [aj, at] = postSortKey(a);
    const [bj, bt] = postSortKey(b);
    return aj !== bj ? aj - bj : at - bt;
  });

  const lines: string[] = [
    "# Live Posting Snapshot",
    "",
    "수집 기준: 공개 채용/커리어 페이지, best-effort. 상세 JD는 최종 지원 전 원문 재확인 필요.",
    "",
  ];
  for (const p of posts) {
    lines.push(`- [${p.company}] ${p.title}`);
    lines.push(`  - source: ${p.source}`);
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
}

function parseArgs(argv: string[]): CliArgs {
  let out = "data/runtime/live-position-postings.md";
  let source: "all" | "wanted" | "toss" = "all";
  let serverOnly = true;
  let wantedLimit = 120;

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
    }
  }
  return { out, source, serverOnly, wantedLimit };
}

async function main(): Promise<number> {
  const { out, source, serverOnly, wantedLimit } = parseArgs(process.argv.slice(2));
  const posts: Posting[] = [];
  const errors: string[] = [];

  if (source === "all" || source === "wanted") {
    try {
      posts.push(...(await fetchWanted(wantedLimit, serverOnly, true)));
    } catch (e) {
      errors.push(`wanted: ${e}`);
    }
  }
  if (source === "all" || source === "toss") {
    try {
      posts.push(...(await fetchToss()));
    } catch (e) {
      errors.push(`toss: ${e}`);
    }
  }

  render(dedupe(posts), out);
  if (errors.length > 0) {
    console.error(`WARN source errors: ${errors.join("; ")}`);
  }
  return 0;
}

main().then(process.exit).catch((e) => {
  console.error(e);
  process.exit(1);
});
