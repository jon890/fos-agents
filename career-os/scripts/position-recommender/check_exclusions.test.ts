// 공고 제외 판정은 모델이 아니라 수집기와 같은 대조 코드가 한다(ADR-142).
// 규칙과 공고는 합성 데이터이고 수집기 테스트와 같은 fixture 를 쓴다.
import { afterEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CareerStoreError } from "../lib/career-store/errors.ts";
import {
  restoreCareerWorkspaceEnv,
  useCareerWorkspaceEnv,
} from "../lib/career-store/test-support.ts";
import { checkExclusions } from "./check_exclusions.ts";
import { backendPostingRule, posting, variantPostings } from "./feedback/exclusions.fixture.ts";
import { createPositionStore } from "./position-store.ts";
import { PositionRunUsageError, runPositionCommand } from "./position_run.ts";

afterEach(restoreCareerWorkspaceEnv);

const now = new Date("2026-10-07T00:00:00Z");
const { url: _url, ...hashOnlyRule } = backendPostingRule;
type Facts = { url: string; company: string; title: string; source?: string; identityHash?: string };
const facts = (post: Facts) => ({
  url: post.url,
  company: post.company,
  title: post.title,
  ...(post.source ? { source: post.source } : {}),
  ...(post.identityHash ? { identityHash: post.identityHash } : {}),
});

async function storeWith(exclusions: unknown[], excludedCompany?: string) {
  useCareerWorkspaceEnv();
  const store = createPositionStore();
  await store.replaceExclusions({ schemaVersion: 2, exclusions }, "exclusions:test");
  if (excludedCompany)
    await store.updateCompanyPreference(
      excludedCompany,
      { companyKey: excludedCompany, companyName: excludedCompany, tier: null, disposition: "exclude" },
      "company-preference:test",
    );
  return store;
}
const verdicts = (value: { results: Array<{ verdict: string }> }) => value.results.map((entry) => entry.verdict);

describe("공고 제외 판정", () => {
  test("공고마다 판정과 근거 종류만 돌려주고 규칙의 사유는 내지 않는다", async () => {
    const result = await checkExclusions(await storeWith([backendPostingRule]), { postings: [facts(posting)] }, now);
    expect(result).toEqual({
      results: [{ position: 0, url: posting.url, verdict: "excluded", basis: "identity" }],
    });
    expect(JSON.stringify(result)).not.toContain(backendPostingRule.reason);
  });

  test("수집기 테스트의 변형 공고가 같은 결과로 나뉜다", async () => {
    const result = await checkExclusions(
      await storeWith([backendPostingRule]),
      { postings: variantPostings.map(facts) },
      now,
    );
    expect(verdicts(result)).toEqual(["excluded", "excluded", "excluded", "excluded", "clear", "clear", "clear"]);
  });

  test("식별값만 가진 규칙은 source 와 식별값을 넘기면 막고 넘기지 않으면 판정하지 않는다", async () => {
    const moved = { ...facts(posting), url: "https://toss.im/career/moved" };
    const { source: _source, identityHash: _hash, ...bare } = moved;
    const result = await checkExclusions(await storeWith([hashOnlyRule]), { postings: [moved, bare] }, now);
    expect(result.results).toEqual([
      { position: 0, url: moved.url, verdict: "excluded", basis: "identity" },
      { position: 1, url: moved.url, verdict: "undeterminable", basis: "identity-missing" },
    ]);
  });

  test("회사 선호가 제외인 회사는 막는다", async () => {
    const result = await checkExclusions(await storeWith([], "테스트 회사"), { postings: [facts(posting)] }, now);
    expect(result.results[0]).toMatchObject({ verdict: "excluded", basis: "company-preference" });
  });

  test("규칙이 없으면 걸리지 않고, 정규화할 수 없는 주소는 판정하지 않는다", async () => {
    const { source: _source, identityHash: _hash, ...bare } = facts(posting);
    const result = await checkExclusions(
      await storeWith([]),
      { postings: [facts(posting), { ...bare, url: "http://jobs.example.com/a" }] },
      now,
    );
    expect(result.results).toEqual([
      { position: 0, url: posting.url, verdict: "clear" },
      { position: 1, url: "http://jobs.example.com/a", verdict: "undeterminable", basis: "invalid-url" },
    ]);
  });

  const invalidInputs: Array<[string, unknown]> = [
    ["빈 목록", { postings: [] }],
    ["열한 개", { postings: Array.from({ length: 11 }, () => facts(posting)) }],
    ["모르는 source", { postings: [{ ...facts(posting), source: "unknown-board" }] }],
    ["source 없는 식별값", { postings: [{ ...facts(posting), source: undefined }] }],
    ["허용하지 않는 키", { postings: [{ ...facts(posting), summary: "x" }] }],
    ["빈 주소", { postings: [{ ...facts(posting), url: "" }] }],
  ];
  for (const [label, input] of invalidInputs)
    test(`입력이 ${label}이면 저장소를 읽지 않고 BAD_REQUEST 다`, async () => {
      const untouched = {
        getExclusions: async () => {
          throw new Error("읽으면 안 됩니다.");
        },
        listCompanyPreferences: async () => {
          throw new Error("읽으면 안 됩니다.");
        },
      };
      const error = await checkExclusions(untouched, input, now).catch((caught) => caught);
      expect(error).toBeInstanceOf(CareerStoreError);
      expect((error as CareerStoreError).code).toBe("BAD_REQUEST");
    });
});

describe("position check-exclusions 명령", () => {
  test("입력 파일의 공고를 작업 폴더의 규칙으로 판정해 JSON 으로 낸다", async () => {
    await storeWith([backendPostingRule]);
    const input = join(process.env.CAREER_WORKSPACE_ROOT!, "postings.json");
    writeFileSync(input, JSON.stringify({ postings: [facts(posting)] }));
    const lines: string[] = [];
    expect(
      await runPositionCommand(["check-exclusions", "--input", input], { writeLine: (line) => lines.push(line) }),
    ).toBe(0);
    expect(JSON.parse(lines.join("\n")).results[0]).toMatchObject({ verdict: "excluded" });
  });

  test("--input 이 없거나 파일이 없거나 JSON 이 깨졌으면 사용법 오류다", async () => {
    await expect(runPositionCommand(["check-exclusions"])).rejects.toThrow(PositionRunUsageError);
    const root = useCareerWorkspaceEnv();
    await expect(
      runPositionCommand(["check-exclusions", "--input", join(root, "missing.json")]),
    ).rejects.toThrow(PositionRunUsageError);
    const broken = join(root, "broken.json");
    writeFileSync(broken, "{");
    await expect(runPositionCommand(["check-exclusions", "--input", broken])).rejects.toThrow(PositionRunUsageError);
  });
});
