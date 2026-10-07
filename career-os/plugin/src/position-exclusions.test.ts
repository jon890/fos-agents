// check_position_exclusions: the verdict comes from the collector's matching code, never from the model.
// Rules and postings are synthetic; the rule fixtures are the collector tests' own.
import { describe, expect, test } from "bun:test";
import {
  backendPostingRule,
  posting,
  variantPostings,
} from "../../scripts/position-recommender/feedback/exclusions.fixture.ts";
import { CareerBackend, type FetchLike } from "./backend.ts";
import { CareerTools } from "./tools.ts";

const baseUrl = "https://career.example.com/";
const token = "x".repeat(40);
const now = new Date("2026-10-07T00:00:00Z");

type Rule = Record<string, unknown>;
const { url: _url, ...hashOnlyRule } = backendPostingRule;

function harness(
  exclusions: Rule[] | Response,
  companyPreferences: unknown[] | Response = [],
) {
  const requests: string[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(String(input));
    requests.push(`${init?.method} ${url.pathname}`);
    const body = url.pathname.endsWith("/exclusions") ? exclusions : companyPreferences;
    return body instanceof Response ? body : new Response(JSON.stringify(body));
  };
  return { requests, tools: new CareerTools(new CareerBackend({ baseUrl, token }, fetchImpl), undefined, () => now) };
}

const parse = (result: { content: [{ text: string }] }) => JSON.parse(result.content[0].text);
const facts = (post: { url: string; company: string; title: string; source?: string; identityHash?: string }) => ({
  url: post.url,
  company: post.company,
  title: post.title,
  ...(post.source ? { source: post.source } : {}),
  ...(post.identityHash ? { identityHash: post.identityHash } : {}),
});
const verdicts = (value: { results: { verdict: string; basis?: string }[] }) =>
  value.results.map((entry) => entry.verdict);

describe("check_position_exclusions", () => {
  test("읽기 요청 둘만 보내고 공고마다 판정과 근거 종류만 돌려준다", async () => {
    const { requests, tools } = harness([backendPostingRule]);
    const result = await tools.call("check_position_exclusions", { postings: [facts(posting)] });
    expect(result.isError).toBeUndefined();
    expect(requests.sort()).toEqual([
      "GET /api/positions/v1/company-preferences",
      "GET /api/positions/v1/exclusions",
    ]);
    expect(parse(result)).toEqual({
      readiness: "ready",
      missing: [],
      results: [{ position: 0, url: posting.url, verdict: "excluded", basis: "identity" }],
    });
    // 규칙의 사유와 근거 주소는 모델에게 돌려주지 않는다.
    expect(result.content[0].text).not.toContain(backendPostingRule.reason);
  });

  test("수집기 시험의 변형 공고가 같은 결과로 갈린다", async () => {
    const { tools } = harness([backendPostingRule]);
    const result = await tools.call("check_position_exclusions", {
      postings: variantPostings.map(facts),
    });
    // 식별자를 지운 변형은 source 를 알지만 규칙에 URL 이 있어 URL 로 비교한다.
    expect(verdicts(parse(result))).toEqual([
      "excluded",
      "excluded",
      "excluded",
      "excluded",
      "clear",
      "clear",
      "clear",
    ]);
  });

  test("식별자만 가진 규칙은 source 와 식별자를 넘기면 막고 넘기지 않으면 판정하지 않는다", async () => {
    const { tools } = harness([hashOnlyRule]);
    const moved = { ...facts(posting), url: "https://toss.im/career/moved" };
    const { source: _source, identityHash: _hash, ...bare } = moved;
    const value = parse(await tools.call("check_position_exclusions", { postings: [moved, bare] }));
    expect(value.results).toEqual([
      { position: 0, url: moved.url, verdict: "excluded", basis: "identity" },
      { position: 1, url: moved.url, verdict: "undeterminable", basis: "identity-missing" },
    ]);
  });

  test("만료된 규칙은 막지 않고 식별 불가의 이유도 되지 않는다", async () => {
    const { tools } = harness([{ ...hashOnlyRule, expiresAt: "2026-10-06" }]);
    const { source: _source, identityHash: _hash, ...bare } = facts(posting);
    const value = parse(await tools.call("check_position_exclusions", { postings: [facts(posting), bare] }));
    expect(verdicts(value)).toEqual(["clear", "clear"]);
  });

  test("회사별 선호가 제외인 회사는 막는다", async () => {
    const { tools } = harness([], [
      {
        companyKey: "테스트 회사",
        companyName: "테스트 회사",
        tier: null,
        disposition: "exclude",
        updatedAt: "2026-09-21T01:00:00.000Z",
      },
    ]);
    const value = parse(await tools.call("check_position_exclusions", { postings: [facts(posting)] }));
    expect(value.results[0]).toMatchObject({ verdict: "excluded", basis: "company-preference" });
  });

  for (const [label, exclusions, preferences] of [
    ["제외 규칙을 읽지 못하면", new Response("{}", { status: 503 }), []],
    ["회사별 선호를 읽지 못하면", [], new Response("{}", { status: 500 })],
  ] as const)
    test(`${label} 목록을 읽은 쪽과 무관하게 모든 공고를 판정하지 않는다`, async () => {
      const { tools } = harness(exclusions as Rule[] | Response, preferences as unknown[] | Response);
      const result = await tools.call("check_position_exclusions", { postings: [facts(posting), facts({ ...posting, url: "https://jobs.example.com/z" })] });
      expect(result.isError).toBeUndefined();
      const value = parse(result);
      expect(value.readiness).toBe("hold");
      expect(value.results.map((entry: { basis: string }) => entry.basis)).toEqual(["constraints-hold", "constraints-hold"]);
      expect(verdicts(value)).toEqual(["undeterminable", "undeterminable"]);
    });

  test("token 거절은 hold 가 아닌 CAREER_UNAUTHORIZED 오류다", async () => {
    const { tools } = harness(new Response("{}", { status: 401 }));
    const result = await tools.call("check_position_exclusions", { postings: [facts(posting)] });
    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe("CAREER_UNAUTHORIZED");
  });

  test("제외 규칙이 403 이어도 hold 가 아닌 CAREER_UNAUTHORIZED 오류다", async () => {
    const { tools } = harness([], new Response("{}", { status: 403 }));
    const result = await tools.call("check_position_exclusions", { postings: [facts(posting)] });
    expect(parse(result).error.code).toBe("CAREER_UNAUTHORIZED");
  });

  const invalidInputs: [string, unknown][] = [
    ["빈 목록", { postings: [] }],
    ["열한 개", { postings: Array.from({ length: 11 }, () => facts(posting)) }],
    ["모르는 source", { postings: [{ ...facts(posting), source: "unknown-board" }] }],
    ["source 없는 식별자", { postings: [{ ...facts(posting), source: undefined }] }],
    ["허용하지 않는 키", { postings: [{ ...facts(posting), summary: "x" }] }],
    ["http 주소가 아닌 빈 주소", { postings: [{ ...facts(posting), url: "" }] }],
  ];
  for (const [label, input] of invalidInputs)
    test(`입력이 ${label}이면 fetch 없이 CAREER_INVALID_INPUT 이다`, async () => {
      const { requests, tools } = harness([]);
      expect(parse(await tools.call("check_position_exclusions", input)).error.code).toBe("CAREER_INVALID_INPUT");
      expect(requests).toHaveLength(0);
    });

  test("http 주소와 정규화할 수 없는 주소는 판정하지 않는다", async () => {
    const { tools } = harness([]);
    const value = parse(
      await tools.call("check_position_exclusions", {
        postings: [{ ...facts(posting), source: undefined, identityHash: undefined, url: "http://jobs.example.com/a" }],
      }),
    );
    expect(value.results[0]).toMatchObject({ verdict: "undeterminable", basis: "invalid-url" });
  });
});
