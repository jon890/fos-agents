import { z } from "zod";
import type { PositionExclusion as BackendPositionExclusion } from "../../../services/recommendation-api/src/positions/schema.ts";
import { formatSeoulIsoDate } from "../../lib/date-format.ts";
import { sourceIdSchema } from "../live-postings/contracts.ts";
import { createRecommendationApiClient } from "../recommendation-api/client.ts";
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

const legacyPostingExclusionSchema = z
  .object({
    source: sourceIdSchema,
    identityHash: z.string().trim().min(1).optional(),
    url: z
      .string()
      .refine((value) => {
        try {
          normalizePostingUrl(value);
          return true;
        } catch {
          return false;
        }
      })
      .optional(),
  })
  .strict()
  .refine((rule) => Boolean(rule.identityHash || rule.url));

const exclusionEvidenceSchema = z
  .object({
    decisionKind: z.enum(["career-downside", "manual"]),
    reason: z.string().trim().min(1),
    axes: z.array(z.unknown()).optional(),
    evidenceUrls: z.array(z.string().url().startsWith("https://")).min(1),
    confidence: z.enum(["high", "medium", "low"]).optional(),
    decidedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    expiresAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();

const postingExclusionSchema = legacyPostingExclusionSchema.extend({
  scope: z.literal("posting"),
  ...exclusionEvidenceSchema.shape,
});

const companyExclusionSchema = z
  .object({
    scope: z.literal("company"),
    company: z.string().trim().min(1),
    ...exclusionEvidenceSchema.shape,
  })
  .strict();

const companyRoleExclusionSchema = z
  .object({
    scope: z.literal("company-role"),
    company: z.string().trim().min(1),
    titleKeywords: z.array(z.string().trim().min(1)).min(1),
    ...exclusionEvidenceSchema.shape,
  })
  .strict();

const versionOneSchema = z
  .object({
    schemaVersion: z.literal(1),
    exclusions: z.array(legacyPostingExclusionSchema),
  })
  .strict();

const versionTwoSchema = z
  .object({
    schemaVersion: z.literal(2),
    exclusions: z.array(
      z.union([
        legacyPostingExclusionSchema,
        postingExclusionSchema,
        companyExclusionSchema,
        companyRoleExclusionSchema,
      ]),
    ),
  })
  .strict();

export const positionExclusionsSchema = z.union([versionOneSchema, versionTwoSchema]);
export type PositionExclusions = z.infer<typeof positionExclusionsSchema>;
export type EnrichedPositionExclusion =
  | z.infer<typeof postingExclusionSchema>
  | z.infer<typeof companyExclusionSchema>
  | z.infer<typeof companyRoleExclusionSchema>;
type PositionExclusion = PositionExclusions["exclusions"][number];

function isCompanyExclusion(
  rule: PositionExclusion,
): rule is z.infer<typeof companyExclusionSchema> {
  return "scope" in rule && rule.scope === "company";
}

function isCompanyRoleExclusion(
  rule: PositionExclusion,
): rule is z.infer<typeof companyRoleExclusionSchema> {
  return "scope" in rule && rule.scope === "company-role";
}

function isExpired(rule: PositionExclusion, now: Date): boolean {
  if (!("expiresAt" in rule) || !rule.expiresAt) return false;
  return formatSeoulIsoDate(now.toISOString()) > rule.expiresAt;
}

export function validateCareerDownsideExclusion(rule: EnrichedPositionExclusion): void {
  if (rule.decisionKind !== "career-downside") return;
  if (rule.scope === "company" && rule.evidenceUrls.length < 2) {
    throw new Error(
      "FAIL position exclusions: 회사 전체 제외에는 공개 근거 URL이 두 개 이상 필요합니다.",
    );
  }
}

/**
 * 외부 요청을 보내기 전에 개인 제외 규칙을 Backend 에서 읽는다.
 *
 * Backend 가 응답하지 않으면 중단한다. 오래된 규칙으로 수집을 이어 가면
 * 제외하기로 한 회사의 공고가 모델 입력에 들어간다.
 */
export async function loadPositionExclusions(
  source: PositionExclusionsSource = createRecommendationApiClient(),
): Promise<PositionExclusions> {
  try {
    const parsed = positionExclusionsSchema.parse({
      schemaVersion: 2,
      exclusions: await source.getExclusions(),
    });
    if (parsed.schemaVersion === 2) {
      for (const rule of parsed.exclusions) {
        if ("scope" in rule) validateCareerDownsideExclusion(rule);
      }
    }
    return parsed;
  } catch {
    // 개인 식별자와 규칙 본문을 오류나 후보풀에 남기지 않는다.
    throw new Error(
      "FAIL position exclusions: 제외 규칙을 읽거나 검증할 수 없습니다. 추천 API 연결과 인증을 확인하세요.",
    );
  }
}

export function filterExcludedPostings(
  posts: Posting[],
  config: PositionExclusions,
  now = new Date(),
) {
  const rules = positionExclusionsSchema
    .parse(config)
    .exclusions.filter((rule) => !isExpired(rule, now));
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
