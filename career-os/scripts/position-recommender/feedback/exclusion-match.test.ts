import { describe, expect, test } from "bun:test";
import type { PositionExclusion } from "../../../services/career-backend/src/positions/schema.ts";
import {
  indexExclusions,
  judgePosting,
  matchExclusion,
  type PostingFacts,
} from "./exclusion-match.ts";
import { filterExcludedPostings } from "./exclusions.ts";
import { backendPostingRule, config, posting, variantPostings } from "./exclusions.fixture.ts";

// 합성 데이터만 쓴다. 규칙과 공고는 exclusions.fixture.ts 를 수집기 시험과 같이 쓴다.
const now = new Date("2026-10-07T00:00:00Z");
const hashOnly: PositionExclusion = (({ url: _url, ...rule }) => rule)(backendPostingRule);

function verdictOf(
  rules: PositionExclusion[],
  facts: PostingFacts,
  excludedCompanies: string[] = [],
) {
  return judgePosting(indexExclusions(rules, now), facts, new Set(excludedCompanies));
}

const identified: PostingFacts = {
  source: posting.source,
  identityHash: posting.identityHash,
  url: posting.url,
  company: posting.company,
  title: posting.title,
};
const unidentified: PostingFacts = {
  url: posting.url,
  company: posting.company,
  title: posting.title,
};

describe("공고 제외 판정", () => {
  test("수집기가 거르는 공고와 판정이 제외로 읽는 공고가 같다", () => {
    const { eligible } = filterExcludedPostings(variantPostings, config, now);
    const judgedClear = variantPostings.filter(
      (post) => verdictOf(config, post).verdict !== "excluded",
    );
    expect(judgedClear).toEqual(eligible);
    expect(judgedClear).toEqual(variantPostings.slice(4));
  });

  test("식별자만 가진 활성 제외는 URL 이 달라도 같은 source 와 식별자를 막는다", () => {
    expect(verdictOf([hashOnly], identified)).toEqual({ verdict: "excluded", basis: "identity" });
    expect(
      verdictOf([hashOnly], { ...identified, url: "https://toss.im/career/renamed?job_id=other" }),
    ).toEqual({ verdict: "excluded", basis: "identity" });
  });

  test("source 와 식별자가 같으면 규칙의 URL 과 공고의 URL 이 달라도 제외한다", () => {
    expect(verdictOf(config, { ...identified, url: "https://example.com/moved" })).toEqual({
      verdict: "excluded",
      basis: "identity",
    });
  });

  test("tracking, fragment, query 순서, 끝 슬래시만 다른 URL 은 같은 공고다", () => {
    const rule: PositionExclusion = {
      ...backendPostingRule,
      identityHash: undefined,
      url: "https://jobs.example.com/posting/7?b=2&a=1",
    };
    const variants = [
      "https://jobs.example.com/posting/7?a=1&b=2",
      "https://jobs.example.com/posting/7/?a=1&b=2",
      "https://jobs.example.com/posting/7?a=1&b=2#apply",
      "https://jobs.example.com/posting/7?utm_source=mail&a=1&b=2&fbclid=x&gclid=y",
      "https://jobs.example.com/posting/7?b=2&utm_medium=email&a=1",
    ];
    for (const url of variants)
      expect({
        url,
        ...verdictOf([rule], { ...identified, identityHash: undefined, url }),
      }).toEqual({
        url,
        verdict: "excluded",
        basis: "url",
      });
    // 의미가 있는 query 값이 다르면 다른 공고다.
    expect(
      verdictOf([rule], {
        ...identified,
        identityHash: undefined,
        url: "https://jobs.example.com/posting/7?a=9&b=2",
      }),
    ).toEqual({ verdict: "clear" });
  });

  test("source 를 모르는 공고는 어느 source 의 규칙이든 정규화 URL 이 같으면 제외한다", () => {
    expect(verdictOf(config, { ...unidentified, url: `${posting.url}&utm_source=x#top` })).toEqual({
      verdict: "excluded",
      basis: "url",
    });
  });

  test("다른 source 는 같은 식별자와 같은 URL 이어도 제외하지 않는다", () => {
    const other: PostingFacts = { ...identified, source: "wanted" };
    expect(verdictOf(config, other)).toEqual({ verdict: "clear" });
    expect(matchExclusion(indexExclusions(config, now), other)).toBeNull();
  });

  test("다른 식별자와 다른 URL 은 제외하지 않는다", () => {
    expect(
      verdictOf(config, {
        ...identified,
        identityHash: "toss-careers:other",
        url: "https://toss.im/career/job-detail?job_id=other",
      }),
    ).toEqual({ verdict: "clear" });
  });

  test("만료된 규칙은 보지 않고 만료일 당일까지는 본다", () => {
    const expiring: PositionExclusion = { ...backendPostingRule, expiresAt: "2026-10-06" };
    expect(verdictOf([expiring], identified)).toEqual({ verdict: "clear" });
    expect(
      judgePosting(indexExclusions([{ ...expiring, expiresAt: "2026-10-07" }], now), identified),
    ).toEqual({ verdict: "excluded", basis: "identity" });
    // 만료된 식별자 전용 규칙은 비교할 규칙에도 들지 않는다.
    expect(verdictOf([{ ...hashOnly, expiresAt: "2026-10-06" }], unidentified)).toEqual({
      verdict: "clear",
    });
  });

  test("회사와 회사·역할 규칙과 회사별 제외 선호를 막는다", () => {
    const evidence = {
      decisionKind: "manual" as const,
      reason: "검증용 제외 규칙",
      evidenceUrls: ["https://jobs.example.com/evidence"],
      decidedAt: "2026-09-10",
    };
    const companyRule: PositionExclusion = {
      scope: "company",
      company: posting.company,
      ...evidence,
    };
    expect(verdictOf([companyRule], unidentified)).toEqual({
      verdict: "excluded",
      basis: "company",
    });
    const role: PositionExclusion = {
      scope: "company-role",
      company: posting.company,
      titleKeywords: ["ai platform"],
      ...evidence,
    };
    expect(verdictOf([role], unidentified)).toEqual({ verdict: "excluded", basis: "company-role" });
    expect(verdictOf([role], { ...unidentified, title: "Payments Developer" })).toEqual({
      verdict: "clear",
    });
    // 대소문자와 연속 공백만 다른 회사 이름도 같은 회사다. 수집기도 같은 비교를 쓴다.
    expect(
      verdictOf([{ ...companyRule, company: "TEST  Corp" }], {
        ...unidentified,
        company: "test corp",
      }),
    ).toEqual({
      verdict: "excluded",
      basis: "company",
    });
    expect(
      verdictOf([{ ...role, company: "TEST  Corp" }], { ...unidentified, company: "Test Corp" }),
    ).toEqual({
      verdict: "excluded",
      basis: "company-role",
    });
    expect(verdictOf([], unidentified, ["테스트 회사"])).toEqual({
      verdict: "excluded",
      basis: "company-preference",
    });
    expect(
      verdictOf([], { ...unidentified, company: "  테스트   회사 " }, ["테스트 회사"]),
    ).toEqual({
      verdict: "excluded",
      basis: "company-preference",
    });
  });
});

describe("식별 불가 판정", () => {
  test("식별자만으로 비교하는 규칙이 있는데 공고의 식별자를 모르면 판정하지 않는다", () => {
    expect(verdictOf([hashOnly], unidentified)).toEqual({
      verdict: "undeterminable",
      basis: "identity-missing",
    });
    expect(verdictOf([hashOnly], { ...unidentified, source: posting.source })).toEqual({
      verdict: "undeterminable",
      basis: "identity-missing",
    });
  });

  test("공고의 source 를 알면 다른 source 의 식별자 전용 규칙은 해당하지 않는다", () => {
    expect(verdictOf([hashOnly], { ...unidentified, source: "wanted" })).toEqual({
      verdict: "clear",
    });
  });

  test("식별자와 URL 을 함께 가진 규칙은 source 를 아는 공고가 식별자를 모를 때만 판정하지 않는다", () => {
    const elsewhere = { ...unidentified, url: "https://toss.im/career/moved?job_id=1" };
    expect(verdictOf(config, { ...elsewhere, source: posting.source })).toEqual({
      verdict: "undeterminable",
      basis: "identity-missing",
    });
    // source 를 모르면 URL 이 비교할 수 있는 유일한 근거다.
    expect(verdictOf(config, elsewhere)).toEqual({ verdict: "clear" });
    expect(verdictOf(config, { ...elsewhere, source: "wanted" })).toEqual({ verdict: "clear" });
  });

  test("식별자로 이미 걸리면 식별 불가보다 제외가 먼저다", () => {
    expect(
      verdictOf([hashOnly, { ...hashOnly, identityHash: "toss-careers:x" }], identified),
    ).toEqual({
      verdict: "excluded",
      basis: "identity",
    });
  });

  test("식별자를 아는 공고는 식별자 전용 규칙과 견줘 걸리지 않으면 clear 다", () => {
    expect(verdictOf([hashOnly], { ...identified, identityHash: "toss-careers:other" })).toEqual({
      verdict: "clear",
    });
  });

  test("정규화하지 못하는 공고 URL 은 판정하지 않는다", () => {
    for (const url of [
      "http://jobs.example.com/a",
      "not a url",
      "https://user:pw@jobs.example.com/a",
    ])
      expect({ url, ...verdictOf([], { ...unidentified, url }) }).toEqual({
        url,
        verdict: "undeterminable",
        basis: "invalid-url",
      });
  });

  test("정규화하지 못하는 규칙 URL 이 있으면 걸리지 않은 공고를 판정하지 않는다", () => {
    const broken: PositionExclusion = {
      ...backendPostingRule,
      identityHash: undefined,
      url: "http://insecure.example.com/a",
    };
    expect(
      verdictOf([broken], {
        ...identified,
        identityHash: undefined,
        url: "https://jobs.example.com/z",
      }),
    ).toEqual({
      verdict: "undeterminable",
      basis: "rule-unreadable",
    });
  });

  test("규칙이 없으면 식별자를 몰라도 clear 다", () => {
    expect(verdictOf([], unidentified)).toEqual({ verdict: "clear" });
  });
});
