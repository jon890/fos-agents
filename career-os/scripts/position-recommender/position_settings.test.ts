import { afterEach, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  restoreCareerWorkspaceEnv,
  useCareerWorkspaceEnv,
} from "../lib/career-store/test-support.ts";
import { createPositionStore } from "./position-store.ts";
import { PositionRunUsageError, runPositionCommand } from "./position_run.ts";

afterEach(restoreCareerWorkspaceEnv);

function inputFile(root: string, name: string, value: unknown): string {
  mkdirSync(join(root, "settings"), { recursive: true });
  const path = join(root, "settings", name);
  writeFileSync(path, JSON.stringify(value));
  return path;
}

const run = (argv: string[], lines: string[] = []) =>
  runPositionCommand(argv, { writeLine: (line) => lines.push(line) });

test("회사 선호와 제외 규칙은 조회 응답 꼴의 배열을 그대로 받아 넣는다", async () => {
  const root = useCareerWorkspaceEnv();
  const preferences = [
    {
      companyKey: "예시 회사",
      companyName: "예시 회사",
      tier: 1,
      disposition: "analyze",
      updatedAt: "2026-11-01T00:00:00.000Z",
    },
    {
      companyKey: "비교 회사",
      companyName: "비교 회사",
      tier: null,
      disposition: "benchmark",
      githubOrg: "example",
      updatedAt: "2026-11-01T00:00:00.000Z",
    },
  ];
  expect(
    await run(["configure-companies", "--input", inputFile(root, "companies.json", preferences)]),
  ).toBe(0);
  const saved = await createPositionStore().listCompanyPreferences();
  expect(saved.map(({ updatedAt: _updatedAt, ...rest }) => rest) as unknown[]).toEqual(
    [preferences[1]!, preferences[0]!].map(({ updatedAt: _updatedAt, ...rest }) => rest),
  );

  const rules = [
    {
      scope: "company",
      company: "예시 회사",
      decisionKind: "manual",
      reason: "재지원 간격",
      evidenceUrls: ["https://example.com/a"],
      decidedAt: "2026-11-01",
    },
  ];
  expect(
    await run(["exclusions", "put", "--input", inputFile(root, "exclusions.json", rules)]),
  ).toBe(0);
  const lines: string[] = [];
  expect(await run(["exclusions", "get"], lines)).toBe(0);
  expect(JSON.parse(lines[0]!)).toEqual({ schemaVersion: 2, exclusions: rules });
});

test("설정 파일 꼴의 회사 선호도 받는다", async () => {
  const root = useCareerWorkspaceEnv();
  const input = {
    schemaVersion: 1,
    preferences: [{ companyName: "예시 회사", tier: 2, disposition: "exclude" }],
  };
  expect(
    await run(["configure-companies", "--input", inputFile(root, "companies.json", input)]),
  ).toBe(0);
  expect(await createPositionStore().listCompanyPreferences()).toMatchObject([
    { companyKey: "예시 회사", tier: 2, disposition: "exclude" },
  ]);
});

test("--input 이 없으면 사용법 오류다", async () => {
  useCareerWorkspaceEnv();
  await expect(run(["configure-policy"])).rejects.toBeInstanceOf(PositionRunUsageError);
  await expect(run(["exclusions", "replace"])).rejects.toBeInstanceOf(PositionRunUsageError);
});

test("설정을 예전 값으로 되돌리는 요청도 반영한다", async () => {
  const root = useCareerWorkspaceEnv();
  const rule = (company: string) => ({
    scope: "company",
    company,
    decisionKind: "manual",
    reason: "재지원 간격",
    evidenceUrls: ["https://example.com/a"],
    decidedAt: "2026-11-01",
  });
  const one = inputFile(root, "one.json", [rule("a")]);
  const two = inputFile(root, "two.json", [rule("a"), rule("b")]);
  for (const file of [one, two, one])
    expect(await run(["exclusions", "put", "--input", file])).toBe(0);
  expect(
    (await createPositionStore().getExclusions()).map(
      (entry) => (entry as { company: string }).company,
    ),
  ).toEqual(["a"]);

  const policy = (dailyAnalysisLimit: number) => ({
    schemaVersion: 2,
    dailyAnalysisLimit,
    prioritySlots: dailyAnalysisLimit - 1,
    agingSlots: 1,
    staleAfterDays: 30,
    defaultCompanyTier: 3,
    dailyCompanyTierLimit: 5,
    companyTierStaleAfterDays: 90,
  });
  const high = inputFile(root, "high.json", policy(20));
  const low = inputFile(root, "low.json", policy(10));
  for (const file of [high, low, high])
    expect(await run(["configure-policy", "--input", file])).toBe(0);
  expect((await createPositionStore().getAnalysisPolicy()).dailyAnalysisLimit).toBe(20);

  const company = (tier: number) => [
    { companyKey: "예시", companyName: "예시", tier, disposition: "analyze" },
  ];
  for (const tier of [1, 2, 1]) {
    expect(
      await run([
        "configure-companies",
        "--input",
        inputFile(root, `tier-${tier}.json`, company(tier)),
      ]),
    ).toBe(0);
  }
  expect((await createPositionStore().listCompanyPreferences())[0]!.tier).toBe(1);
  const config = (tier: number) => ({
    schemaVersion: 1,
    preferences: [{ companyName: "예시", tier, disposition: "analyze" }],
  });
  for (const tier of [1, 3, 1]) {
    expect(
      await run([
        "configure-companies",
        "--input",
        inputFile(root, `config-${tier}.json`, config(tier)),
      ]),
    ).toBe(0);
  }
  expect((await createPositionStore().listCompanyPreferences())[0]!.tier).toBe(1);
});
