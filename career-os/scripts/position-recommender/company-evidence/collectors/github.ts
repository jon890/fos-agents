import type { CompanyEvidenceCollector } from "./types.ts";
import { compactSummary, dateAfter } from "./types.ts";

type GithubRepo = {
  name: string;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
};

export const githubCollector: CompanyEvidenceCollector = {
  name: "github",
  sourceTypes: ["github"],
  enabled: (input) => Boolean(input.preference?.githubOrg),
  async collect(input) {
    const org = input.preference!.githubOrg!;
    const response = await input.fetcher(
      `https://api.github.com/orgs/${encodeURIComponent(org)}/repos?per_page=100&sort=pushed`,
      {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "career-os" },
      },
    );
    if (!response.ok) return { evidence: [], diagnostics: [`github: HTTP ${response.status}`] };
    const value = await response.json();
    if (!Array.isArray(value))
      return { evidence: [], diagnostics: ["github: 저장소 목록 형식 오류"] };
    const repos = value
      .filter((entry): entry is GithubRepo => entry && typeof entry.name === "string")
      .slice(0, 20)
      .map((repo) => ({
        name: repo.name,
        language: repo.language,
        stars: repo.stargazers_count,
        pushedAt: repo.pushed_at,
      }));
    const recent = repos.filter(
      (repo) => Date.parse(repo.pushedAt) >= input.now.getTime() - 365 * 86_400_000,
    );
    const languages = [...new Set(repos.map((repo) => repo.language).filter(Boolean))].slice(0, 5);
    return {
      diagnostics: [],
      evidence: [
        {
          sourceType: "github",
          url: `https://github.com/${encodeURIComponent(org)}`,
          title: `${input.companyName} GitHub`,
          summary: compactSummary(
            `최근 1년 push한 저장소 ${recent.length}개, 확인한 저장소 ${repos.length}개. 주요 언어: ${languages.join(", ") || "미확인"}.`,
          ),
          payloadJson: { repos },
          observedAt: input.now.toISOString(),
          validUntil: dateAfter(input.now, 30),
        },
      ],
    };
  },
};
