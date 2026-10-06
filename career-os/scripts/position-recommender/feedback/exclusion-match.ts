import type { PositionExclusion } from "../../../services/career-backend/src/positions/schema.ts";
import { formatSeoulIsoDate } from "../../lib/date-format.ts";

/**
 * 개인 제외 규칙으로 공고 하나를 판정하는 순수 함수 모음이다.
 *
 * 수집기(`exclusions.ts`)와 plugin 의 `check_position_exclusions` 가 같은 판정을 쓰도록
 * 네트워크와 Backend client 를 끌어오지 않는 파일로 나눴다. plugin 번들이 이 파일만 가져간다.
 */

export function normalizePostingUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("invalid posting URL");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ["fbclid", "gclid"].includes(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.href;
}

/** Backend 의 `companyKey` 와 같은 정규화다. 회사별 선호의 `companyKey` 와 견줄 때만 쓴다. */
export function companyKeyOf(company: string): string {
  return company.replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

export function isExpired(rule: PositionExclusion, now: Date): boolean {
  if (!rule.expiresAt) return false;
  return formatSeoulIsoDate(now.toISOString()) > rule.expiresAt;
}

/** 판정에 쓰는 공고의 사실이다. `source` 와 `identityHash` 는 수집기나 커넥터가 준 값만 담는다. */
export type PostingFacts = {
  source?: string;
  identityHash?: string;
  url: string;
  company: string;
  title: string;
};

export type ExclusionBasis = "identity" | "url" | "company" | "company-role";

export type ExclusionIndex = {
  identities: Set<string>;
  /** `source|정규화 URL`. 공고의 source 를 아는 판정에 쓴다. */
  urlsBySource: Set<string>;
  /** 정규화 URL. 공고의 source 를 모르는 판정에 쓴다. 같은 주소는 같은 공고다. */
  urls: Set<string>;
  companies: Set<string>;
  companyRoles: Array<{ company: string; titleKeywords: string[] }>;
  /** 식별자로만 비교할 수 있는 규칙(URL 없음)과 식별자·URL 을 함께 가진 규칙의 source. */
  identityRules: Array<{ source: string; hasUrl: boolean }>;
  /** 정규화하지 못한 URL 을 가진 규칙 수. 이 규칙은 비교할 수 없다. */
  unreadableRules: number;
};

export function indexExclusions(rules: PositionExclusion[], now: Date): ExclusionIndex {
  const index: ExclusionIndex = {
    identities: new Set(),
    urlsBySource: new Set(),
    urls: new Set(),
    companies: new Set(),
    companyRoles: [],
    identityRules: [],
    unreadableRules: 0,
  };
  for (const rule of rules.filter((candidate) => !isExpired(candidate, now))) {
    if (rule.scope === "company") {
      index.companies.add(rule.company);
      continue;
    }
    if (rule.scope === "company-role") {
      index.companyRoles.push({
        company: rule.company,
        titleKeywords: rule.titleKeywords.map((keyword) => keyword.toLowerCase()),
      });
      continue;
    }
    if (rule.identityHash) {
      index.identities.add(`${rule.source}|${rule.identityHash}`);
      index.identityRules.push({ source: rule.source, hasUrl: Boolean(rule.url) });
    }
    if (rule.url) {
      try {
        const url = normalizePostingUrl(rule.url);
        index.urlsBySource.add(`${rule.source}|${url}`);
        index.urls.add(url);
      } catch {
        index.unreadableRules += 1;
      }
    }
  }
  return index;
}

function tryNormalize(url: string): string | null {
  try {
    return normalizePostingUrl(url);
  } catch {
    return null;
  }
}

/** 수집기와 같은 순서로 비교한다. 식별자, URL, 회사, 회사와 역할이다. */
export function matchExclusion(index: ExclusionIndex, post: PostingFacts): ExclusionBasis | null {
  if (
    post.source &&
    post.identityHash &&
    index.identities.has(`${post.source}|${post.identityHash}`)
  )
    return "identity";
  const url = tryNormalize(post.url);
  if (url && (post.source ? index.urlsBySource.has(`${post.source}|${url}`) : index.urls.has(url)))
    return "url";
  if (index.companies.has(post.company)) return "company";
  const title = post.title.toLowerCase();
  if (
    index.companyRoles.some(
      (rule) =>
        rule.company === post.company &&
        rule.titleKeywords.some((keyword) => title.includes(keyword)),
    )
  )
    return "company-role";
  return null;
}

export type PostingVerdict =
  | { verdict: "excluded"; basis: ExclusionBasis | "company-preference" }
  | { verdict: "clear" }
  | { verdict: "undeterminable"; basis: "invalid-url" | "identity-missing" | "rule-unreadable" };

/**
 * 공고 하나가 제외인지 `excluded`, `clear`, `undeterminable` 로 판정한다.
 *
 * `clear` 는 이 공고에 적용되는 모든 규칙을 비교했고 걸리는 것이 없다는 뜻이다.
 * 비교할 수 없는 규칙이 하나라도 남으면 `undeterminable` 이고 추천하지 않는다.
 * 규칙이 읽혔다는 사실과 이 공고를 판정할 수 있다는 사실은 다르다.
 *
 * - 공고에 식별자가 없는데 식별자로만 비교하는 규칙(URL 없음)이 있다.
 *   공고의 source 를 모르면 모든 source 의 규칙이, 알면 같은 source 의 규칙이 해당한다.
 * - 공고의 source 를 알고 식별자가 없는데 같은 source 의 규칙이 식별자와 URL 을 함께 가진다.
 *   URL 이 바뀐 같은 공고일 수 있다.
 * - 공고 URL 이나 규칙 URL 을 정규화하지 못했다.
 *
 * `excludedCompanyKeys` 는 회사별 선호에서 `exclude` 인 `companyKey` 모음이다.
 */
export function judgePosting(
  index: ExclusionIndex,
  post: PostingFacts,
  excludedCompanyKeys: ReadonlySet<string> = new Set(),
): PostingVerdict {
  const basis = matchExclusion(index, post);
  if (basis) return { verdict: "excluded", basis };
  if (excludedCompanyKeys.has(companyKeyOf(post.company)))
    return { verdict: "excluded", basis: "company-preference" };
  if (tryNormalize(post.url) === null) return { verdict: "undeterminable", basis: "invalid-url" };
  if (index.unreadableRules > 0) return { verdict: "undeterminable", basis: "rule-unreadable" };
  if (!post.identityHash) {
    const pending = index.identityRules.some((rule) =>
      rule.hasUrl
        ? post.source === rule.source
        : post.source === undefined || post.source === rule.source,
    );
    if (pending) return { verdict: "undeterminable", basis: "identity-missing" };
  }
  return { verdict: "clear" };
}
