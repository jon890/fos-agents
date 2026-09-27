import type { PositionExclusion as BackendPositionExclusion } from "../../../services/career-backend/src/positions/schema.ts";
import { formatSeoulIsoDate } from "../../lib/date-format.ts";
import { CareerBackendHttpError } from "../../lib/career-backend-http.ts";
import { sourceIdSchema } from "../live-postings/contracts.ts";
import {
  createCareerBackendClient,
} from "../career-backend/client.ts";
import type { Posting } from "../live-postings/types.ts";

/**
 * 제외 규칙을 돌려주는 자리다. 운영에서는 Backend client 가, 테스트에서는 대역이 채운다.
 *
 * 규칙은 `fos_career.position_exclusions` 가 소유한다. ADR-123 을 따른다.
 */
export type PositionExclusionsSource = {
  getExclusions(): Promise<BackendPositionExclusion[]>;
};

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

export type PositionExclusions = BackendPositionExclusion[];
export type EnrichedPositionExclusion = BackendPositionExclusion;
type PositionExclusion = BackendPositionExclusion;

function isCompanyExclusion(
  rule: PositionExclusion,
): rule is Extract<PositionExclusion, { scope: "company" }> {
  return rule.scope === "company";
}

function isCompanyRoleExclusion(
  rule: PositionExclusion,
): rule is Extract<PositionExclusion, { scope: "company-role" }> {
  return rule.scope === "company-role";
}

function isExpired(rule: PositionExclusion, now: Date): boolean {
  if (!rule.expiresAt) return false;
  return formatSeoulIsoDate(now.toISOString()) > rule.expiresAt;
}

function validatePositionExclusions(rules: BackendPositionExclusion[]): PositionExclusions {
  for (const rule of rules) {
    if (rule.scope === "posting") {
      sourceIdSchema.parse(rule.source);
    }
  }
  return rules;
}

/**
 * 제외 규칙을 읽지 못한 원인을 갈래로만 남긴다.
 *
 * 규칙 본문과 개인 식별자는 오류 문구에 담지 않는다.
 * 원인까지 한 문구로 뭉치면 수집이 멈췄을 때 어디를 볼지 알 수 없어 갈래만 구분한다.
 * zod 의 오류 문구는 어긋난 값을 그대로 담으므로 쓰지 않는다.
 */
function exclusionFailureReason(error: unknown): string {
    if (error instanceof CareerBackendHttpError) {
    if (error.status === null || error.status >= 500) {
      return "커리어 Backend 에 연결하지 못했습니다. 주소와 서버 상태를 확인하세요.";
    }
    if (error.status === 401 || error.status === 403) {
      return "커리어 Backend 인증이 거절됐습니다. token 을 확인하세요.";
    }
  }
  return "커리어 Backend 가 돌려준 제외 규칙이 계약을 만족하지 않습니다.";
}

/**
 * 외부 요청을 보내기 전에 개인 제외 규칙을 Backend 에서 읽는다.
 *
 * Backend 가 응답하지 않으면 중단한다. 오래된 규칙으로 수집을 이어 가면
 * 제외하기로 한 회사의 공고가 모델 입력에 들어간다.
 */
export async function loadPositionExclusions(
  source: PositionExclusionsSource = createCareerBackendClient(),
): Promise<PositionExclusions> {
  try {
    return validatePositionExclusions(await source.getExclusions());
  } catch (error) {
    throw new Error(`FAIL position exclusions: ${exclusionFailureReason(error)}`);
  }
}

export function filterExcludedPostings(
  posts: Posting[],
  config: PositionExclusions,
  now = new Date(),
) {
  const rules = validatePositionExclusions(config).filter((rule) => !isExpired(rule, now));
  const identities = new Set<string>();
  const urls = new Set<string>();
  const companies = new Set<string>();
  const companyRoles: Array<{ company: string; titleKeywords: string[] }> = [];
  for (const rule of rules) {
    if (isCompanyExclusion(rule)) {
      companies.add(rule.company);
      continue;
    }
    if (isCompanyRoleExclusion(rule)) {
      companyRoles.push({
        company: rule.company,
        titleKeywords: rule.titleKeywords.map((keyword) => keyword.toLowerCase()),
      });
      continue;
    }
    if (rule.identityHash) identities.add(`${rule.source}|${rule.identityHash}`);
    if (rule.url) urls.add(`${rule.source}|${normalizePostingUrl(rule.url)}`);
  }
  const rejectedBySource = new Map<string, number>();
  const eligible = posts.filter((post) => {
    let urlMatch = false;
    try {
      urlMatch = urls.has(`${post.source}|${normalizePostingUrl(post.url)}`);
    } catch {
      /* 후보 스키마에서 검사한다. */
    }
    if (
      !identities.has(`${post.source}|${post.identityHash ?? ""}`) &&
      !urlMatch &&
      !companies.has(post.company) &&
      !companyRoles.some(
        (rule) =>
          rule.company === post.company &&
          rule.titleKeywords.some((keyword) => post.title.toLowerCase().includes(keyword)),
      )
    )
      return true;
    rejectedBySource.set(post.source, (rejectedBySource.get(post.source) ?? 0) + 1);
    return false;
  });
  return { eligible, rejectedBySource };
}
