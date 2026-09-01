// 소스별 상태를 정규화한 뒤 모든 공고에 적용하는 공통 생명주기 경계다.

import type {
  Posting,
  PostingEligibilityDecision,
  PostingEligibilityOptions,
  PostingEligibilityPolicy,
  PostingRejectionCode,
} from "./types.ts";
import {
  isContractRole,
  isNonTargetTitle,
  isTargetRole,
} from "./policy.ts";

const ACTIVE_POSTING_STATUSES: ReadonlySet<Posting["postingStatus"]> = new Set(["active", "open"]);

export function dedupe(posts: Posting[]): Posting[] {
  const seen = new Set<string>();
  const officialRoleKeys = new Set(
    posts
      .filter((p) => p.source !== "wanted" && p.discoveryMode === "official-detail")
      .map(roleKey)
  );

  return posts.filter((p) => {
    // Official detail pages are authoritative when the same company and role were
    // also discovered through Wanted. Keep Wanted-only roles intact.
    if (p.source === "wanted" && officialRoleKeys.has(roleKey(p))) return false;
    const urlKey = `${p.source}|url|${p.url}`;
    const hashKey = p.identityHash ? `${p.source}|hash|${p.identityHash}` : "";
    if (seen.has(urlKey) || (hashKey && seen.has(hashKey))) return false;
    seen.add(urlKey);
    if (hashKey) seen.add(hashKey);
    return true;
  });
}

function isExpired(posting: Posting, evaluatedAt: Date): boolean {
  const remainingDays = Number(posting.daysUntilClose);
  if (Number.isFinite(remainingDays) && remainingDays < 0) return true;

  const dateOnly = posting.closesAt.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/)?.[1];
  if (!dateOnly) return false;
  const evaluatedDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(evaluatedAt);
  return dateOnly < evaluatedDate;
}

export function createPostingEligibilityPolicy(
  options: PostingEligibilityOptions = {},
): PostingEligibilityPolicy {
  const targetRoleOnly = options.targetRoleOnly ?? true;
  return {
    evaluate(posting, evaluatedAt = new Date()): PostingEligibilityDecision {
      if (posting.linkType !== "direct_posting") {
        return { eligible: false, rejectionCode: "not_direct_posting" };
      }
      if (!ACTIVE_POSTING_STATUSES.has(posting.postingStatus)) {
        return { eligible: false, rejectionCode: "unverified_status" };
      }
      if (isExpired(posting, evaluatedAt)) {
        return { eligible: false, rejectionCode: "expired_deadline" };
      }

      const fullText = [
        posting.company,
        posting.title,
        posting.category,
        posting.summary,
        posting.mainTasks,
        posting.requirements,
        posting.preferred,
      ].join(" ");
      if (isContractRole(fullText)) {
        return { eligible: false, rejectionCode: "ineligible_employment" };
      }
      if (targetRoleOnly && (isNonTargetTitle(posting.title) || !isTargetRole(fullText))) {
        return { eligible: false, rejectionCode: "not_target_role" };
      }
      return { eligible: true };
    },
  };
}

export const activePostingEligibilityPolicy = createPostingEligibilityPolicy();

export interface PostingEligibilityResult {
  eligible: Posting[];
  rejectedCounts: Partial<Record<PostingRejectionCode, number>>;
  rejectedBySource: Map<string, number>;
}

export function filterEligiblePostings(
  posts: Posting[],
  evaluatedAt = new Date(),
  policy: PostingEligibilityPolicy = activePostingEligibilityPolicy,
): PostingEligibilityResult {
  const eligible: Posting[] = [];
  const rejectedCounts: Partial<Record<PostingRejectionCode, number>> = {};
  const rejectedBySource = new Map<string, number>();
  for (const posting of posts) {
    const decision = policy.evaluate(posting, evaluatedAt);
    if (decision.eligible) {
      eligible.push(posting);
      continue;
    }
    if (decision.rejectionCode) {
      rejectedCounts[decision.rejectionCode] = (rejectedCounts[decision.rejectionCode] ?? 0) + 1;
    }
    rejectedBySource.set(posting.source, (rejectedBySource.get(posting.source) ?? 0) + 1);
  }
  return { eligible, rejectedCounts, rejectedBySource };
}

function roleKey(posting: Posting): string {
  const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  return `${normalize(posting.company)}|${normalize(posting.title)}`;
}

export function keepActiveDirectPostings(posts: Posting[]): Posting[] {
  return filterEligiblePostings(posts).eligible;
}
