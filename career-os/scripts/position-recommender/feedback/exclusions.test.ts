import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PositionExclusion as BackendPositionExclusion } from "../../../services/career-backend/src/positions/schema.ts";
import { collectLivePostings, parseArgs } from "../collect_live_postings.ts";
import { CareerBackendHttpError } from "../../lib/career-backend-http.ts";
import {
  filterExcludedPostings,
  loadPositionExclusions,
  type EnrichedPositionExclusion,
  type PositionExclusions,
  type PositionExclusionsSource,
} from "./exclusions.ts";
import type { Posting } from "../live-postings/types.ts";
import { backendPostingRule, config, posting, variantPostings } from "./exclusions.fixture.ts";
import { SUBPROCESS_TEST_TIMEOUT_MS } from "../../lib/test-timeouts.ts";

/** 규칙은 Backend 가 소유한다. 테스트는 그 응답만 대역으로 세운다. */
function exclusionsSource(rules: unknown[]): PositionExclusionsSource {
  return { getExclusions: async () => rules as BackendPositionExclusion[] };
}

function failingExclusionsSource(error: unknown = new Error("커리어 Backend에 연결하지 못했습니다.")) {
  return {
    getExclusions: async () => {
      throw error;
    },
  } satisfies PositionExclusionsSource;
}

describe("개인 공고 제외", () => {
  test("같은 소스의 ID 또는 정규화 URL만 제외한다", () => {
    const posts = variantPostings;
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
        // 모르는 소스 이름과 posting 규칙의 누락된 소스다.
        exclusionsSource([{ ...backendPostingRule, source: "unknown-board" }]),
        exclusionsSource([{ ...backendPostingRule, source: "" }]),
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
      expect(await loadPositionExclusions(exclusionsSource([]))).toEqual([]);
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
          process.execPath,
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
            CAREER_BACKEND_URL: `http://127.0.0.1:${server.port}`,
            CAREER_BACKEND_TOKEN: "token-123456789012345678901234567890",
            CAREER_BACKEND_TOKEN_FILE: undefined,
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
      [companyRule],
    );
    expect(result.eligible.map((item) => item.company)).toEqual(["다른 회사"]);
  }, SUBPROCESS_TEST_TIMEOUT_MS);

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
    const config = [rule];

    expect(
      filterExcludedPostings([posting, frontend, otherCompany], config, new Date("2027-03-31"))
        .eligible,
    ).toEqual([frontend, otherCompany]);
    expect(
      filterExcludedPostings([posting, frontend, otherCompany], config, new Date("2027-04-01"))
        .eligible,
    ).toEqual([posting, frontend, otherCompany]);
  });

  test("규칙을 읽지 못한 원인을 연결과 인증과 계약으로 갈라 적는다", async () => {
    const cases = [
      {
        error: new CareerBackendHttpError(null, "NETWORK", "연결 실패"),
        expected: "커리어 Backend 에 연결하지 못했습니다. 주소와 서버 상태를 확인하세요.",
      },
      {
        error: new CareerBackendHttpError(503, "INTERNAL_ERROR", "서버 오류"),
        expected: "커리어 Backend 에 연결하지 못했습니다. 주소와 서버 상태를 확인하세요.",
      },
      {
        error: new CareerBackendHttpError(401, "UNAUTHORIZED", "인증 실패"),
        expected: "커리어 Backend 인증이 거절됐습니다. token 을 확인하세요.",
      },
      {
        error: new CareerBackendHttpError(400, "BAD_REQUEST", "잘못된 요청"),
        expected: "커리어 Backend 가 돌려준 제외 규칙이 계약을 만족하지 않습니다.",
      },
    ];
    for (const { error, expected } of cases) {
      await expect(loadPositionExclusions(failingExclusionsSource(error))).rejects.toThrow(
        `FAIL position exclusions: ${expected}`,
      );
    }
  });

  test("계약을 어긴 규칙의 본문은 오류 문구에 담기지 않는다", async () => {
    const secret = "비공개-회사-이름";
    const source = exclusionsSource([{ ...backendPostingRule, source: "unknown-board", reason: secret }]);

    await expect(loadPositionExclusions(source)).rejects.toThrow(
      "FAIL position exclusions: 커리어 Backend 가 돌려준 제외 규칙이 계약을 만족하지 않습니다.",
    );
    await loadPositionExclusions(source).catch((error: unknown) => {
      expect(String((error as Error).message)).not.toContain(secret);
    });
  });
});
