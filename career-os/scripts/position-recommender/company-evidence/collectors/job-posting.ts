import type { CompanyEvidenceCollector } from "./types.ts";
import { compactSummary, dateAfter } from "./types.ts";

export const jobPostingCollector: CompanyEvidenceCollector = {
  name: "job-posting",
  sourceTypes: ["job-posting"],
  refreshEveryRun: true,
  enabled: (input) => input.activePostings.length > 0,
  async collect(input) {
    const first = input.activePostings
      .map((posting) => Date.parse(posting.firstSeenAt))
      .filter(Number.isFinite);
    const oldest = first.length ? Math.min(...first) : input.now.getTime();
    const recent = first.filter((value) => value >= input.now.getTime() - 30 * 86_400_000).length;
    const shortHistory = oldest > input.now.getTime() - 30 * 86_400_000;
    return {
      diagnostics: [],
      evidence: [
        {
          sourceType: "job-posting",
          url: input.activePostings[0]!.url,
          title: `${input.companyName} 활성 공고`,
          summary: compactSummary(
            `활성 공고 ${input.activePostings.length}건, 최근 30일 신규 ${recent}건.${shortHistory ? " 수집 이력이 30일보다 짧아 증가 추세는 판단하기 어렵다." : ""}`,
          ),
          payloadJson: {
            postings: input.activePostings.map((posting) => ({
              title: posting.title,
              firstSeenAt: posting.firstSeenAt,
            })),
          },
          observedAt: input.now.toISOString(),
          validUntil: dateAfter(input.now, 0),
        },
      ],
    };
  },
};
