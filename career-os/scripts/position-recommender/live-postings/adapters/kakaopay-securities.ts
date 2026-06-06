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
const HOST = "https://career.kakaopaysec.com";
const LISTING_URLS = [`${HOST}/`, `${HOST}/job_posting`];
const KNOWN_TARGET_URLS = [
  `${HOST}/job_posting/Rtv75CLr`,
  `${HOST}/job_posting/iWWBkQ7Z`,
];

async function fetchHtml(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

function absoluteUrl(pathOrUrl: string): string {
  return pathOrUrl.startsWith("http") ? pathOrUrl : `${HOST}${pathOrUrl}`;
}

function extractDetailUrls(html: string): string[] {
  const urls = new Set<string>();
  const re = /(?:https:\/\/career\.kakaopaysec\.com)?\/job_posting\/[A-Za-z0-9]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) urls.add(absoluteUrl(match[0]));
  for (const url of KNOWN_TARGET_URLS) urls.add(url);
  return [...urls];
}

function extractNextData(html: string): Record<string, unknown> | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pageProps(html: string): Record<string, unknown> {
  const nextData = extractNextData(html);
  const props = nextData?.props as Record<string, unknown> | undefined;
  return (props?.pageProps as Record<string, unknown> | undefined) ?? {};
}

function htmlText(html: string): string {
  return cleanDetail(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
    6000
  );
}

function asTextList(values: unknown[]): string {
  return values.map((value) => norm(value)).filter(Boolean).join(", ");
}

function careerText(career: unknown): string {
  if (!career || typeof career !== "object") return "";
  const c = career as Record<string, unknown>;
  const range = c.range as Record<string, unknown> | undefined;
  return range?.over ? `경력 ${range.over}년 이상` : norm(c.type);
}

function skillsFromText(text: string): string[] {
  const skills = ["Kubernetes", "AWS", "GCP", "LangChain", "LlamaIndex", "RAG", "Tool Calling", "Java", "Spring", "Kotlin", "Python", "API", "Agent", "LLM"];
  const low = text.toLowerCase();
  return skills.filter((skill) => low.includes(skill.toLowerCase())).slice(0, 12);
}

function postingFromDetail(url: string, html: string): Posting | null {
  const props = pageProps(html);
  const recruitment = (props.recruitment as Record<string, unknown> | undefined) ?? {};
  const title = norm(recruitment.title ?? recruitment.externalTitle);
  const status = norm(recruitment.status);
  const deadlineType = norm(recruitment.deadlineType);
  const employment = asTextList((recruitment.employmentType as unknown[]) ?? []);
  const jobGroup = (recruitment.jobGroup as Record<string, unknown> | undefined) ?? {};
  const locations = (recruitment.jobLocations as unknown[]) ?? [];
  const location = locations
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => norm(item.placeName ?? item.addressName))
    .filter(Boolean)
    .join(", ");
  const text = htmlText(html);
  const roleSignal = `${title} ${norm(jobGroup.title)} ${careerText(recruitment.career)} ${employment}`;
  const fullText = `${roleSignal} ${text}`;

  if (!title) return null;
  if (status !== "in_progress") return null;
  if (!/지원하기/.test(text)) return null;
  if (isExcludedCompany(fullText)) return null;
  if (isContractRole(fullText) || /intern|인턴|contract/i.test(employment)) return null;
  if (isNonServerTitle(title)) return null;
  if (!isServerRole(roleSignal) && !isServerRole(fullText)) return null;

  const id = url.match(/\/job_posting\/([A-Za-z0-9]+)/)?.[1] ?? url;
  return {
    source: "kakaopay-securities",
    discoveryMode: "official-detail",
    company: norm(recruitment.companyName) || "카카오페이증권",
    title,
    url,
    identityHash: `kakaopay-securities:${id}`,
    linkType: "direct_posting",
    postingStatus: "open",
    activeEvidence: `Ninehire detail status=${status}, deadlineType=${deadlineType || "unknown"}, apply button visible`,
    openedAt: norm(recruitment.createdAt),
    ...closeWindow(deadlineType === "until_filled" ? "" : recruitment.deadlineValue),
    category: norm(jobGroup.title),
    summary: location,
    tags: classify(fullText),
    skills: skillsFromText(fullText),
    careerUpsideHypothesis:
      "NHN 현재 맥락보다 금융 플랫폼과 내부 AI Agent/개발자 플랫폼 경험을 더 강하게 만들 수 있다는 커리어 상승 가설",
    careerUpsideEvidence: [
      "공식 JD의 AI Agent, Multi-Agent, RAG, Tool/Memory 또는 플랫폼 업무 범위",
      "금융/증권 도메인과 내부 플랫폼 개발 신호",
      "개발 생산성 자동화와 서버/API 설계 전이성",
    ],
    careerUpsideRiskFlags: [
      "Kubernetes/cloud 필수 수준이 높아 준비 비용 큼",
      "AI 역할은 모델/데이터 파이프라인 비중이 서버 개발보다 클 수 있음",
    ],
    dueTime: deadlineType === "until_filled" ? "" : norm(recruitment.deadlineValue),
    mainTasks: cleanDetail(text.match(/업무내용([\s\S]*?)(자격요건|지원자격|우대사항)/)?.[1] ?? text, 650),
    requirements: cleanDetail(text.match(/(자격요건|지원자격)([\s\S]*?)(우대사항|채용 프로세스)/)?.[2] ?? "", 650),
    preferred: cleanDetail(text.match(/우대사항([\s\S]*?)(채용 프로세스|입사 지원자 유의사항)/)?.[1] ?? "", 500),
  };
}

export const kakaopaySecuritiesAdapter: SourceAdapter = {
  id: "kakaopay-securities",
  name: "kakaopay-securities",
  async collect(): Promise<AdapterCollectionResult> {
    const errors: string[] = [];
    const urls = new Set<string>(KNOWN_TARGET_URLS);
    let failedCount = 0;
    for (const listingUrl of LISTING_URLS) {
      try {
        const listing = await fetchHtml(listingUrl);
        if (!listing.ok) {
          failedCount++;
          errors.push(`kakaopay-securities listing ${listingUrl.replace(HOST, "") || "/"}: HTTP ${listing.status}`);
          continue;
        }
        for (const url of extractDetailUrls(listing.text)) urls.add(url);
      } catch (error) {
        failedCount++;
        errors.push(`kakaopay-securities listing fetch failed: ${error}`);
      }
    }

    const postings: Posting[] = [];
    let skippedCount = 0;
    for (const url of urls) {
      try {
        const detail = await fetchHtml(url);
        if (!detail.ok) {
          failedCount++;
          errors.push(`kakaopay-securities detail ${url.replace(HOST, "")}: HTTP ${detail.status}`);
          continue;
        }
        const posting = postingFromDetail(url, detail.text);
        if (posting) postings.push(posting);
        else skippedCount++;
      } catch (error) {
        failedCount++;
        errors.push(`kakaopay-securities detail fetch failed: ${error}`);
      }
    }

    return {
      postings,
      diagnostics: {
        source: "kakaopay-securities",
        status: failedCount > 0 ? "partial" : "ok",
        collectedCount: postings.length,
        skippedCount,
        failedCount,
        discoveryModes: ["official-listing", "official-detail"],
        message:
          `kakaopay-securities diagnostics: detail_candidates=${urls.size}, accepted=${postings.length}, ` +
          `skipped=${skippedCount}, failed=${failedCount}`,
      },
      errors,
    };
  },
};
