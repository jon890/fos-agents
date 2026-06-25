import type { AdapterCollectionResult, Posting, SourceAdapter } from "../types.ts";
import {
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
const HOST = "https://www.samsungcareers.com";
const LIST_URL = `${HOST}/hr/list.data`;
const DETAIL_URL = `${HOST}/recruit/detail.data`;
const TARGET_COMPANIES = ["C10CAA", "C10CAH", "C60"];

interface SamsungListItem {
  seq: string;
  company: string;
  title: string;
  period: string;
  tags: string[];
}

interface SamsungDetailItem {
  titleKr?: string;
  taskKr?: string;
  qlfctKr?: string;
  favorKr?: string;
  memoKr?: string;
  workPlaceKr?: string;
}

interface SamsungDetailResponse {
  success?: boolean;
  data?: {
    result?: {
      title?: string;
      startdate?: string;
      enddate?: string;
      cmpNameKr?: string;
      introKr?: string;
      qlfctKr?: string;
      processKr?: string;
      dd?: string | number;
    };
    items?: SamsungDetailItem[];
  };
}

async function fetchText(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
  const r = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      "Accept-Language": "ko-KR,ko;q=0.9",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string): string {
  return cleanDetail(
    decodeHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    ),
    3000,
  );
}

function parseListItems(html: string): SamsungListItem[] {
  const items: SamsungListItem[] = [];
  const re = /<li>\s*<div>([\s\S]*?)<\/div>\s*<\/li>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const block = match[1];
    const dataValue = block.match(/data-value="([0-9,]+)"/)?.[1]?.replace(",", "");
    const company = cleanDetail(block.match(/<p class="company">([\s\S]*?)<\/p>/)?.[1] ?? "", 120);
    const title = cleanDetail(block.match(/<h3 class="title">([\s\S]*?)<\/h3>/)?.[1] ?? "", 180);
    const period = cleanDetail(block.match(/<span class="period">([\s\S]*?)<\/span>/)?.[1] ?? "", 120);
    const tags = [...block.matchAll(/<span class="flag grey">([\s\S]*?)<\/span>/g)]
      .map((m) => cleanDetail(m[1], 80))
      .filter(Boolean);
    if (dataValue && title) items.push({ seq: dataValue, company, title, period, tags });
  }
  return items;
}

async function fetchList(companyCode: string): Promise<{ ok: boolean; status: number; items: SamsungListItem[] }> {
  const body = new URLSearchParams({
    currentPageNo: "1",
    intNo: "0",
    strVal: "",
    strTxt: "",
    strKey: "",
    strCompany: companyCode,
    strType: "B",
    strOrderBy: "",
    strEntity: "",
  });
  const res = await fetchText(LIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });
  return { ok: res.ok, status: res.status, items: res.ok ? parseListItems(res.text) : [] };
}

async function fetchDetail(seq: string): Promise<SamsungDetailResponse | null> {
  const url = `${DETAIL_URL}?seqno=${encodeURIComponent(seq)}`;
  const res = await fetchText(url);
  if (!res.ok) return null;
  try {
    return JSON.parse(res.text) as SamsungDetailResponse;
  } catch {
    return null;
  }
}

function normalizeDate(raw: string | undefined): string {
  const value = norm(raw);
  const m = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return value;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function skillsFromText(text: string): string[] {
  const skills = ["Java", "Kotlin", "Spring", "Backend", "Server", "Cloud", "Kubernetes", "AI", "Data", "Platform", "Infra"];
  const low = text.toLowerCase();
  return skills.filter((skill) => low.includes(skill.toLowerCase())).slice(0, 12);
}

function postingFromDetail(listItem: SamsungListItem, detail: SamsungDetailResponse | null): Posting | null {
  const result = detail?.data?.result;
  const items = detail?.data?.items ?? [];
  const title = norm(result?.title) || listItem.title;
  const company = norm(result?.cmpNameKr) || listItem.company || "Samsung";
  const detailText = [
    result?.introKr,
    result?.qlfctKr,
    result?.processKr,
    ...items.flatMap((item) => [item.titleKr, item.taskKr, item.qlfctKr, item.favorKr, item.memoKr, item.workPlaceKr]),
  ].map((v) => cleanDetail(v, 1200)).filter(Boolean).join(" ");
  const fullText = `${company} ${title} ${listItem.tags.join(" ")} ${detailText}`;

  if (isExcludedCompany(fullText)) return null;
  if (isContractRole(fullText)) return null;
  if (isNonServerTitle(title)) return null;
  if (!isServerRole(fullText)) return null;

  const mainItem = items.find((item) => isServerRole(`${item.titleKr ?? ""} ${item.taskKr ?? ""}`)) ?? items[0];
  const due = normalizeDate(result?.enddate) || listItem.period.match(/~\s*([0-9.]+)/)?.[1]?.replace(/\./g, "-") || "";
  return {
    source: "samsung-careers",
    discoveryMode: "official-listing",
    company,
    title,
    url: `${HOST}/hr/?no=${listItem.seq}`,
    identityHash: `samsung-careers:${listItem.seq}`,
    linkType: "direct_posting",
    postingStatus: "open",
    activeEvidence: `Samsung Careers official list.data/detail.data returned seq=${listItem.seq}`,
    openedAt: normalizeDate(result?.startdate) || listItem.period.split("~")[0]?.trim() || "",
    ...closeWindow(due),
    category: "Engineering",
    summary: stripHtml(result?.introKr ?? `${company} 공식 채용공고`),
    tags: classify(fullText),
    skills: skillsFromText(fullText),
    careerUpsideHypothesis: "삼성 계열 대규모 엔터프라이즈·클라우드·플랫폼 환경에서 브랜드와 시스템 규모 레버리지를 얻을 수 있다는 커리어 상승 가설",
    careerUpsideEvidence: ["Samsung Careers official direct posting", "대기업 공식 채용 채널", "엔터프라이즈/플랫폼/인프라 역할 가능성"],
    careerUpsideRiskFlags: ["직무가 포괄 공고로 묶여 있으면 실제 서버 개발 비중 확인 필요", "삼성SDS 외 관계사는 후보자 타깃과의 도메인 정합 확인 필요"],
    dueTime: due,
    mainTasks: cleanDetail(mainItem?.taskKr ?? detailText, 650),
    requirements: cleanDetail([result?.qlfctKr, mainItem?.qlfctKr].filter(Boolean).join(" "), 650),
    preferred: cleanDetail(mainItem?.favorKr ?? "", 500),
  };
}

export const samsungCareersAdapter: SourceAdapter = {
  id: "samsung-careers",
  name: "samsung-careers",
  async collect(): Promise<AdapterCollectionResult> {
    const postings: Posting[] = [];
    const errors: string[] = [];
    let collectedRaw = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const companyCode of TARGET_COMPANIES) {
      try {
        const list = await fetchList(companyCode);
        if (!list.ok) {
          failedCount++;
          errors.push(`samsung-careers list ${companyCode}: HTTP ${list.status}`);
          continue;
        }
        collectedRaw += list.items.length;
        for (const item of list.items) {
          const detail = await fetchDetail(item.seq);
          const posting = postingFromDetail(item, detail);
          if (posting) postings.push(posting);
          else skippedCount++;
        }
      } catch (error) {
        failedCount++;
        errors.push(`samsung-careers fetch failed: ${error}`);
      }
    }

    return {
      postings,
      diagnostics: {
        source: "samsung-careers",
        status: failedCount > 0 ? "partial" : "ok",
        collectedCount: collectedRaw,
        skippedCount,
        failedCount,
        discoveryModes: ["official-listing", "official-detail"],
        message: `samsung-careers diagnostics: target_companies=${TARGET_COMPANIES.join(",")}, raw=${collectedRaw}, accepted=${postings.length}, skipped=${skippedCount}, failed=${failedCount}`,
      },
      errors,
    };
  },
};
