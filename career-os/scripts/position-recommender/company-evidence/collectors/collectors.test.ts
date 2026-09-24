import { describe, expect, test } from "bun:test";

import { githubCollector } from "./github.ts";
import { jobPostingCollector } from "./job-posting.ts";
import { collectCompanyEvidence } from "./registry.ts";
import { techBlogCollector } from "./tech-blog.ts";
import type { CollectorInput, CompanyEvidenceCollector, EvidenceFetcher } from "./types.ts";

const now = new Date("2026-09-24T00:00:00.000Z");

function input(
  fetcher: EvidenceFetcher,
  preference: CollectorInput["preference"] = {
    companyKey: "example",
    companyName: "예시",
    tier: 2,
    disposition: "analyze",
    updatedAt: now.toISOString(),
    techBlogFeedUrl: "https://example.com/feed",
    githubOrg: "example",
  },
): CollectorInput {
  return {
    companyKey: "example",
    companyName: "예시",
    preference,
    existingEvidence: [],
    activePostings: [
      { title: "백엔드 개발자", url: "https://example.com/jobs/1", firstSeenAt: "2026-09-18" },
    ],
    now,
    fetcher,
  };
}

function reply(body: string, status = 200): EvidenceFetcher {
  return async () => new Response(body, { status });
}

describe("인증키가 필요 없는 회사 근거 수집기", () => {
  test("RSS에서 제목과 분류와 발행일과 작성자를 저장한다", async () => {
    const xml = `<rss><channel><item><title>서비스 개선</title><category>Backend</category><pubDate>Mon, 21 Sep 2026 00:00:00 GMT</pubDate><dc:creator>개발팀</dc:creator></item></channel></rss>`;
    const result = await techBlogCollector.collect(input(reply(xml)));
    expect(result.diagnostics).toEqual([]);
    expect(result.evidence[0]?.sourceType).toBe("tech-blog");
    expect(result.evidence[0]?.summary).toContain("최근 90일 1건");
    expect(result.evidence[0]?.payloadJson.posts).toEqual([
      {
        title: "서비스 개선",
        category: ["Backend"],
        pubDate: "Mon, 21 Sep 2026 00:00:00 GMT",
        creator: "개발팀",
      },
    ]);
  });

  test("Atom도 같은 글 목록으로 읽는다", async () => {
    const xml = `<feed><entry><title>설계 기록</title><category term="Architecture"/><published>2026-09-22T00:00:00Z</published><author><name>개발팀</name></author></entry></feed>`;
    const result = await techBlogCollector.collect(input(reply(xml)));
    expect(result.evidence[0]?.payloadJson.posts).toEqual([
      {
        title: "설계 기록",
        category: ["Architecture"],
        pubDate: "2026-09-22T00:00:00Z",
        creator: "개발팀",
      },
    ]);
  });

  test("RSS 404와 GitHub 403은 근거 없이 진단만 남긴다", async () => {
    expect((await techBlogCollector.collect(input(reply("", 404)))).evidence).toEqual([]);
    const result = await githubCollector.collect(input(reply("", 403)));
    expect(result.evidence).toEqual([]);
    expect(result.diagnostics[0]).toContain("403");
  });

  test("주소가 없는 수집기는 건너뛰고 유효한 근거는 다시 모으지 않는다", async () => {
    let requests = 0;
    const fetcher: EvidenceFetcher = async () => {
      requests++;
      return new Response("{}");
    };
    const noFeed = input(fetcher, {
      companyKey: "example",
      companyName: "예시",
      tier: 2,
      disposition: "analyze",
      updatedAt: now.toISOString(),
    });
    await collectCompanyEvidence(noFeed, [techBlogCollector]);
    expect(requests).toBe(0);
    const withEvidence = input(fetcher);
    withEvidence.existingEvidence = [
      {
        sourceType: "tech-blog",
        url: "https://example.com/feed",
        summary: "이전 수집",
        payloadJson: {},
        observedAt: now.toISOString(),
        validUntil: "2026-10-01",
      },
    ];
    await collectCompanyEvidence(withEvidence, [techBlogCollector]);
    expect(requests).toBe(0);
  });

  test("한 수집기가 예외를 던져도 공고 근거를 남긴다", async () => {
    const broken: CompanyEvidenceCollector = {
      name: "broken",
      sourceTypes: ["tech-blog"],
      enabled: () => true,
      collect: async () => {
        throw new Error("고정된 실패");
      },
    };
    const result = await collectCompanyEvidence(input(reply("")), [broken, jobPostingCollector]);
    expect(result.diagnostics).toEqual(["broken: 수집 실패"]);
    expect(result.evidence.map((entry) => entry.sourceType)).toEqual(["job-posting"]);
    expect(result.evidence[0]?.summary).toContain("수집 이력이 30일보다 짧아");
  });

  test("GitHub 근거는 상위 20개만 담고 요약은 500자 이하다", async () => {
    const repos = Array.from({ length: 40 }, (_, index) => ({
      name: `repository-${index}`,
      language: `언어-${index}`,
      stargazers_count: index,
      pushed_at: "2026-09-20T00:00:00Z",
    }));
    const result = await githubCollector.collect(input(reply(JSON.stringify(repos))));
    expect((result.evidence[0]?.payloadJson.repos as unknown[]).length).toBe(20);
    expect(result.evidence[0]!.summary.length).toBeLessThanOrEqual(500);
  });
});
