import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PositionExclusion as BackendPositionExclusion } from "../../../services/recommendation-api/src/positions/schema.ts";
import { collectLivePostings, parseArgs } from "../collect_live_postings.ts";
import {
  filterExcludedPostings,
  loadPositionExclusions,
  validateCareerDownsideExclusion,
  type EnrichedPositionExclusion,
  type PositionExclusions,
  type PositionExclusionsSource,
} from "./exclusions.ts";
import type { Posting } from "../live-postings/types.ts";

/** 규칙은 Backend 가 소유한다. 테스트는 그 응답만 대역으로 세운다. */
function exclusionsSource(rules: unknown[]): PositionExclusionsSource {
  return { getExclusions: async () => rules as BackendPositionExclusion[] };
}

function failingExclusionsSource(): PositionExclusionsSource {
  return {
    getExclusions: async () => {
      throw new Error("추천 API에 연결하지 못했습니다.");
    },
  };
}

// 실제 개인 규칙과 지원 이력은 공개 테스트 fixture에 복제하지 않는다.
const posting: Posting = {
  source: "toss-careers",
  company: "테스트 회사",
  title: "Server Developer (AI Platform)",
  url: "https://toss.im/career/job-detail?job_id=fixture-old",
  identityHash: "toss-careers:fixture-old",
  linkType: "direct_posting",
  postingStatus: "active",
  activeEvidence: "공식 API active",
  openedAt: "",
  closesAt: "no_deadline",
  daysUntilClose: "no_deadline",
  closeUrgency: "no_deadline",
  category: "개발",
  summary: "",
  tags: [],
  skills: [],
  dueTime: "",
  mainTasks: "서비스 개발",
  requirements: "백엔드 경험",
  preferred: "",
};
const config: PositionExclusions = {
  schemaVersion: 1,
  exclusions: [{ source: posting.source, identityHash: posting.identityHash, url: posting.url }],
};
const backendPostingRule = {
  scope: "posting",
  source: posting.source,
  identityHash: posting.identityHash,
  url: posting.url,
  decisionKind: "manual",
  reason: "검증용 제외 규칙",
  evidenceUrls: [posting.url],
  decidedAt: "2026-09-10",
};

describe("개인 공고 제외", () => {
  test("같은 소스의 ID 또는 정규화 URL만 제외한다", () => {
    const posts = [
      posting,
      { ...posting, url: "https://example.com/changed" },
      { ...posting, identityHash: undefined, url: `${posting.url}&utm_source=mail#apply` },
      {
        ...posting,
        identityHash: undefined,
        url: "https://toss.im/career/job-detail/?utm_medium=email&job_id=fixture-old",
      },
      {
        ...posting,
        title: "Server Developer (Payments)",
        identityHash: "toss-careers:other",
        url: "https://toss.im/career/job-detail?job_id=other",
      },
      {
        ...posting,
        identityHash: "toss-careers:new",
        url: "https://toss.im/career/job-detail?job_id=new",
      },
      { ...posting, source: "wanted" as const },
    ];
    const result = filterExcludedPostings(posts, config);
    expect(result.eligible).toEqual(posts.slice(4));
    expect(result.rejectedBySource.get("toss-careers")).toBe(4);
  });

  test("최종 후보풀과 진단에 제외 공고 본문이나 식별자가 남지 않는다", async () => {
    const dir = mkdtempSync(join(tmpdir(), "position-exclusions-"));
    try {
      const out = join(dir, "pool.json");
      const kept = {
        ...posting,
        identityHash: "toss-careers:new",
        url: "https://toss.im/career/job-detail?job_id=new",
      };
      const code = await collectLivePostings(
        parseArgs(["--source", "toss", "--output", out]),
        [
          {
            id: "toss-careers",
            name: "fixture",
            collect: async () => [posting, kept],
          },
        ],
        exclusionsSource([backendPostingRule]),
      );
      const raw = readFileSync(out, "utf8");
      const pool = JSON.parse(raw);
      expect(code).toBe(0);
      expect(pool.candidates.map((p: Posting) => p.url)).toEqual([kept.url]);
      expect(pool.sourceDiagnostics[0].importedCount).toBe(1);
      expect(pool.sourceDiagnostics[0].skippedCount).toBe(1);
      expect(raw).not.toContain("fixture-old");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("Backend 오류와 계약을 벗어난 규칙은 수집과 출력 전에 중단한다", async () => {
    const dir = mkdtempSync(join(tmpdir(), "position-exclusions-"));
    try {
      const out = join(dir, "pool.json");
      let calls = 0;
      const sources: PositionExclusionsSource[] = [
        failingExclusionsSource(),
        // 모르는 소스 이름, 필수 칸 누락, 회사 제외의 근거 부족이다.
        exclusionsSource([{ ...backendPostingRule, source: "unknown-board" }]),
        exclusionsSource([{ scope: "posting", source: "toss-careers" }]),
        exclusionsSource([
          {
            scope: "company",
            company: "테스트 회사",
            decisionKind: "career-downside",
            reason: "근거가 하나뿐이다",
            evidenceUrls: ["https://example.com/company"],
            decidedAt: "2026-09-10",
          },
        ]),
      ];
      for (const source of sources) {
        await expect(
          collectLivePostings(
            parseArgs(["--output", out]),
            [
              {
                id: "toss-careers",
                name: "fixture",
                collect: async () => {
                  calls++;
                  return [posting];
                },
              },
            ],
            source,
          ),
        ).rejects.toThrow("FAIL position exclusions");
        expect(existsSync(out)).toBe(false);
      }
      expect(calls).toBe(0);
      expect((await loadPositionExclusions(exclusionsSource([]))).exclusions).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("Backend가 오류를 내면 수집 명령이 종료 코드 1로 끝난다", async () => {
    const server = Bun.serve({
      port: 0,
      fetch: () =>
        Response.json({ error: { code: "INTERNAL_ERROR", message: "실패" } }, { status: 500 }),
    });
    const dir = mkdtempSync(join(tmpdir(), "position-exclusions-"));
    try {
      const child = Bun.spawn(
        [
          "bun",
          `${import.meta.dir}/../collect_live_postings.ts`,
          "--source",
          "toss",
          "--output",
          join(dir, "pool.json"),
        ],
        {
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            NO_PROXY: "127.0.0.1,localhost",
            CAREER_RECOMMENDATION_API_URL: `http://127.0.0.1:${server.port}`,
            CAREER_RECOMMENDATION_API_TOKEN: "token-123456789012345678901234567890",
            CAREER_RECOMMENDATION_API_TOKEN_FILE: undefined,
          },
        },
      );
      const [stderr, exitCode] = await Promise.all([
        new Response(child.stderr).text(),
        child.exited,
      ]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("FAIL position exclusions");
      expect(existsSync(join(dir, "pool.json"))).toBe(false);
    } finally {
      server.stop(true);
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  test("회사 규칙은 정확히 같은 회사의 공고만 제외한다", () => {
    const companyRule: EnrichedPositionExclusion = {
      scope: "company",
      company: "테스트 회사",
      decisionKind: "career-downside",
      reason: "회사의 모든 백엔드 역할에 적용되는 제외 근거를 확인했다.",
      evidenceUrls: ["https://example.com/company", "https://example.com/engineering"],
      decidedAt: "2026-09-10",
    };
    const result = filterExcludedPostings(
      [
        posting,
        {
          ...posting,
          company: "다른 회사",
          identityHash: "other",
          url: "https://example.com/jobs/2",
        },
      ],
      { schemaVersion: 2, exclusions: [companyRule] },
    );
    expect(result.eligible.map((item) => item.company)).toEqual(["다른 회사"]);
  });

  test("고정 판정 축 없이 제외를 허용하고 회사 제외에는 근거 둘을 요구한다", () => {
    const base: EnrichedPositionExclusion = {
      scope: "posting",
      source: posting.source,
      identityHash: posting.identityHash,
      url: posting.url,
      decisionKind: "career-downside",
      reason: "검증용",
      evidenceUrls: [posting.url],
      decidedAt: "2026-09-10",
    };
    expect(() => validateCareerDownsideExclusion(base)).not.toThrow();
    expect(() =>
      validateCareerDownsideExclusion({
        ...base,
        scope: "company",
        company: "테스트 회사",
      }),
    ).toThrow("공개 근거 URL이 두 개");
  });

  test("회사 역할군 cooldown은 공고명에 맞는 역할만 만료일까지 제외한다", () => {
    const rule: EnrichedPositionExclusion = {
      scope: "company-role",
      company: "테스트 회사",
      titleKeywords: ["server developer", "백엔드"],
      decisionKind: "manual",
      reason: "최근 지원 결과에 따른 재지원 간격",
      evidenceUrls: [posting.url],
      decidedAt: "2026-09-14",
      expiresAt: "2027-03-31",
    };
    const frontend = {
      ...posting,
      title: "Frontend Developer",
      identityHash: "frontend",
      url: "https://example.com/jobs/frontend",
    };
    const otherCompany = {
      ...posting,
      company: "다른 회사",
      identityHash: "other",
      url: "https://example.com/jobs/other",
    };
    const config = { schemaVersion: 2 as const, exclusions: [rule] };

    expect(
      filterExcludedPostings([posting, frontend, otherCompany], config, new Date("2027-03-31"))
        .eligible,
    ).toEqual([frontend, otherCompany]);
    expect(
      filterExcludedPostings([posting, frontend, otherCompany], config, new Date("2027-04-01"))
        .eligible,
    ).toEqual([posting, frontend, otherCompany]);
  });
});
