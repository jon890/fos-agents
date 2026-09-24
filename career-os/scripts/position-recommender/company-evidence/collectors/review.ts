import type { CompanyEvidenceCollector } from "./types.ts";
import { compactSummary, dateAfter } from "./types.ts";

const labels = ["커리어 향상", "업무와 삶의 균형", "급여 및 복지", "사내 문화", "경영진"] as const;

/** 리뷰 본문이 시작되기 전의 회사 집계 구역만 읽는다. */
export function parseBlindRatings(
  html: string,
): { overall: number; reviewCount: number; categories: Record<string, number> } | null {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
  const start = text.indexOf("항목별 평점");
  if (start < 0) return null;
  const header = text.slice(0, start + 500);
  const overallMatch =
    /Rating Score\s*([1-5](?:\.\d)?)/.exec(header) ?? /평점\s*([1-5](?:\.\d)?)/.exec(header);
  const countMatch = /([\d,]+)\s*개 리뷰/.exec(header) ?? /리뷰\s*([\d,]+)/.exec(header);
  const categoryText = text.slice(start, start + 500);
  const categories: Record<string, number> = {};
  for (const label of labels) {
    const match = new RegExp(`([1-5](?:\\.\\d)?)\\s*${label}`).exec(categoryText);
    if (!match) return null;
    categories[label] = Number(match[1]);
  }
  if (!overallMatch || !countMatch) return null;
  return {
    overall: Number(overallMatch[1]),
    reviewCount: Number(countMatch[1]!.replaceAll(",", "")),
    categories,
  };
}

export const reviewCollector: CompanyEvidenceCollector = {
  name: "review",
  sourceTypes: ["review"],
  enabled: (input) => Boolean(input.preference?.blindCompanySlug),
  async collect(input) {
    const url = `https://www.teamblind.com/kr/company/${encodeURIComponent(input.preference!.blindCompanySlug!)}/reviews`;
    const response = await input.fetcher(url);
    if (!response.ok) return { evidence: [], diagnostics: [`review: HTTP ${response.status}`] };
    const ratings = parseBlindRatings(await response.text());
    if (!ratings) return { evidence: [], diagnostics: ["review: 평점을 찾지 못함"] };
    return {
      diagnostics: [],
      evidence: [
        {
          sourceType: "review",
          url,
          title: `${input.companyName} Blind 평점`,
          summary: compactSummary(
            `전체 ${ratings.overall}점, 급여 및 복지 ${ratings.categories["급여 및 복지"]}점, 리뷰 ${ratings.reviewCount}건.`,
          ),
          payloadJson: ratings,
          observedAt: input.now.toISOString(),
          validUntil: dateAfter(input.now, 60),
        },
      ],
    };
  },
};
