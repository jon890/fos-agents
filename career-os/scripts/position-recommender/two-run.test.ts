import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openCareerStore } from "../lib/career-store/database.ts";
import {
  legacyCase,
  materializeBody,
  PREFIX,
} from "../lib/career-store/positions/legacy-fixture.ts";
import {
  restoreCareerWorkspaceEnv,
  useCareerWorkspaceEnv,
} from "../lib/career-store/test-support.ts";
import { collectLivePostings, parseArgs } from "./collect_live_postings.ts";
import { posting } from "./feedback/exclusions.fixture.ts";
import type { Posting } from "./live-postings/types.ts";
import {
  defaultOperations,
  runPositionCommand,
  type PositionRunOperations,
} from "./position_run.ts";
import { runDirectoryPaths } from "./run-dir.ts";

/**
 * 공고 추천을 같은 작업 폴더에서 두 번 돌린다. 외부 사이트 수집만 대역이고,
 * 제외 규칙 적용, 저장, 큐, 반영, 추천, 리포트는 실제 실행기 경로다.
 */
afterEach(restoreCareerWorkspaceEnv);

const POLICY = {
  schemaVersion: 2,
  dailyAnalysisLimit: 20,
  prioritySlots: 16,
  agingSlots: 4,
  staleAfterDays: 30,
  defaultCompanyTier: 3,
  dailyCompanyTierLimit: 5,
  companyTierStaleAfterDays: 90,
};

function listing(
  key: string,
  company: string,
  mainTasks = "LLM 서비스의 서버를 개발한다",
): Posting {
  return {
    ...posting,
    company,
    title: `Server Developer (AI Platform) ${key}`,
    url: `https://toss.im/career/job-detail?job_id=${key}`,
    identityHash: `toss-careers:${key}`,
    mainTasks,
  };
}

const tierTemplate = (
  materializeBody(
    `${PREFIX}/company-tier-runs/x/results`,
    legacyCase("ok-08-post-company-tier-results").request.body,
  ) as {
    results: Array<Record<string, unknown>>;
  }
).results[0]!;
const analysisTemplate = (
  legacyCase("ok-10-post-analysis-results").request.body as {
    results: Array<Record<string, unknown>>;
  }
).results[0]!;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function operationsWith(postings: Posting[]): PositionRunOperations {
  return {
    ...defaultOperations,
    // 회사 근거 수집은 외부 사이트를 부르므로 이 검사에서는 건너뛴다.
    collectEvidence: undefined,
    async collect(paths) {
      return collectLivePostings(
        parseArgs(["--source", "toss", "--output", paths.postingCandidates]),
        [{ id: "toss-careers", name: "fixture", collect: async () => postings }],
      );
    },
  };
}

type Queue = {
  candidates: Array<{
    positionId: string;
    analysisStatus: string;
    resultStatus: string;
    posting: { title: string };
  }>;
};

/** 실행 폴더 하나로 수집부터 리포트까지 돌리고, 분석 큐와 추천 결과를 돌려준다. */
async function runOnce(root: string, name: string, postings: Posting[]) {
  const directory = join(root, "runs", `position-recommendation-${name}`);
  mkdirSync(directory, { recursive: true });
  const paths = runDirectoryPaths(directory);
  const lines: string[] = [];
  const options = {
    operations: operationsWith(postings),
    writeLine: (line: string) => lines.push(line),
  };
  const run = async (command: string) => {
    const code = await runPositionCommand([command, "--run", directory], options);
    expect(`${command}:${code}`, lines.join("\n")).toBe(`${command}:0`);
  };

  await run("collect");
  const companyCount = existsSync(paths.companyTierQueue)
    ? readJson<{ companies: Array<{ companyKey: string }> }>(paths.companyTierQueue).companies
        .length
    : 0;
  if (companyCount > 0) {
    const queue = readJson<{ companies: Array<{ companyKey: string }> }>(paths.companyTierQueue);
    const updates = readJson<Record<string, unknown>>(paths.companyTierUpdates);
    writeJson(paths.companyTierUpdates, {
      ...updates,
      results: queue.companies.map((company) => ({
        ...tierTemplate,
        companyKey: company.companyKey,
      })),
    });
    await run("commit-company-tiers");
  }
  const queue = readJson<Queue>(paths.analysisQueue);
  const open = queue.candidates.filter((candidate) => candidate.resultStatus === "pending");
  if (open.length > 0) {
    const updates = readJson<Record<string, unknown>>(paths.analysisUpdates);
    writeJson(paths.analysisUpdates, {
      ...updates,
      results: open.map((candidate) => ({ ...analysisTemplate, positionId: candidate.positionId })),
    });
    await run("commit-analyses");
  }
  await run("finalize");
  const recommendation = readJson<{
    ranking: Array<{ candidateId: string; company: string }>;
    analysisSummary: {
      analyzedNowCount: number;
      reusedCount: number;
      pendingCount: number;
      personalExcludedCount: number;
    };
  }>(paths.recommendation);
  return { companyCount, queue, recommendation, lines, paths };
}

test("두 번째 실행은 바뀌지 않은 공고를 다시 분석하지 않고 제외한 공고를 후보에 넣지 않는다", async () => {
  const root = useCareerWorkspaceEnv({
    "position-preferences": "- AI 서비스 백엔드",
    "application-state": "- 지원 중인 곳 없음",
  });
  const settings = join(root, "settings");
  mkdirSync(settings);
  writeJson(join(settings, "policy.json"), POLICY);
  const excluded = listing("excluded", "제외 회사");
  writeJson(join(settings, "exclusions.json"), {
    schemaVersion: 2,
    exclusions: [
      {
        scope: "posting",
        source: excluded.source,
        identityHash: excluded.identityHash,
        url: excluded.url,
        decisionKind: "manual",
        reason: "지원하지 않기로 했다",
        evidenceUrls: [excluded.url],
        decidedAt: "2026-11-01",
      },
    ],
  });
  const output: string[] = [];
  const write = (line: string) => output.push(line);
  expect(
    await runPositionCommand(["configure-policy", "--input", join(settings, "policy.json")], {
      writeLine: write,
    }),
  ).toBe(0);
  expect(
    await runPositionCommand(["exclusions", "put", "--input", join(settings, "exclusions.json")], {
      writeLine: write,
    }),
  ).toBe(0);
  expect(await runPositionCommand(["exclusions", "get"], { writeLine: write })).toBe(0);
  expect(JSON.parse(output.at(-1)!).exclusions).toHaveLength(1);

  const first = await runOnce(root, "first", [
    listing("a", "회사 A"),
    listing("b", "회사 B"),
    excluded,
  ]);
  expect(first.companyCount).toBe(2);
  expect(first.queue.candidates.map((candidate) => candidate.analysisStatus)).toEqual([
    "new",
    "new",
  ]);
  expect(first.recommendation.ranking.map((entry) => entry.company).sort()).toEqual([
    "회사 A",
    "회사 B",
  ]);
  expect(first.recommendation.analysisSummary).toMatchObject({
    analyzedNowCount: 2,
    reusedCount: 0,
    personalExcludedCount: 1,
  });
  const reportLine = first.lines.find((line) => line.startsWith("리포트 사본: "))!;
  const reportCopy = reportLine.slice("리포트 사본: ".length);
  expect(reportCopy).toMatch(/\/reports\/\d{4}-\d{2}-\d{2}-position\.html$/);
  expect(readFileSync(reportCopy, "utf8")).toBe(readFileSync(first.paths.report, "utf8"));

  // 두 번째 실행: A 는 그대로, B 는 주요 업무가 바뀌었다. 제외한 공고도 다시 수집된다.
  const second = await runOnce(root, "second", [
    listing("a", "회사 A"),
    listing("b", "회사 B", "에이전트 플랫폼의 서버를 개발한다"),
    excluded,
  ]);
  expect(second.companyCount).toBe(0);
  expect(
    second.queue.candidates.map((candidate) => [candidate.posting.title, candidate.analysisStatus]),
  ).toEqual([["Server Developer (AI Platform) b", "changed"]]);
  expect(second.recommendation.ranking.map((entry) => entry.company).sort()).toEqual([
    "회사 A",
    "회사 B",
  ]);
  expect(second.recommendation.analysisSummary).toMatchObject({
    analyzedNowCount: 1,
    reusedCount: 1,
    pendingCount: 0,
    personalExcludedCount: 1,
  });

  const db = openCareerStore();
  expect(db.get("SELECT COUNT(*) AS n FROM position_analyses")).toEqual({ n: 3 });
  expect(db.get("SELECT COUNT(*) AS n FROM position_recommendation_runs")).toEqual({ n: 2 });
  expect(db.get("SELECT COUNT(*) AS n FROM positions WHERE company_name = '제외 회사'")).toEqual({
    n: 0,
  });
  expect(db.get("SELECT COUNT(*) AS n FROM company_tier_assessments")).toEqual({ n: 2 });
});
