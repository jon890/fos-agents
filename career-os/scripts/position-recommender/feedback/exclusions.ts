import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { POSITION_EXCLUSIONS_PATH } from "../../../config/position-exclusions.ts";
import { sourceIdSchema } from "../live-postings/contracts.ts";
import type { Posting } from "../live-postings/types.ts";
import { UPSIDE_AXES, UpsideAxisJudgment } from "../recommendation/schema.ts";

export const defaultExclusionsPath = resolve(import.meta.dir, "../../..", POSITION_EXCLUSIONS_PATH);

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
    axes: z.array(UpsideAxisJudgment).length(UPSIDE_AXES.length).optional(),
    evidenceUrls: z.array(z.string().url().startsWith("https://")).min(1),
    decidedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
      z.union([legacyPostingExclusionSchema, postingExclusionSchema, companyExclusionSchema]),
    ),
  })
  .strict();

export const positionExclusionsSchema = z.union([versionOneSchema, versionTwoSchema]);
export type PositionExclusions = z.infer<typeof positionExclusionsSchema>;
export type EnrichedPositionExclusion =
  z.infer<typeof postingExclusionSchema> | z.infer<typeof companyExclusionSchema>;
type PositionExclusion = PositionExclusions["exclusions"][number];

function isCompanyExclusion(
  rule: PositionExclusion,
): rule is z.infer<typeof companyExclusionSchema> {
  return "scope" in rule && rule.scope === "company";
}

export function validateCareerDownsideExclusion(rule: EnrichedPositionExclusion): void {
  if (rule.decisionKind !== "career-downside") return;
  if (!rule.axes || rule.axes.length !== UPSIDE_AXES.length) {
    throw new Error(
      "FAIL position exclusions: career-downside 규칙에는 네 축의 판단이 필요합니다.",
    );
  }
  const names = new Set(rule.axes.map((axis) => axis.axis));
  if (names.size !== UPSIDE_AXES.length || UPSIDE_AXES.some((axis) => !names.has(axis))) {
    throw new Error("FAIL position exclusions: career-downside 규칙의 축이 빠졌거나 중복됐습니다.");
  }
  if (rule.axes.some((axis) => axis.direction === "상향")) {
    throw new Error("FAIL position exclusions: 상향 축이 있는 대상은 자동 제외할 수 없습니다.");
  }
  if (!rule.axes.some((axis) => axis.direction === "하향")) {
    throw new Error("FAIL position exclusions: 명확한 하향 축이 하나 이상 필요합니다.");
  }
  if (rule.scope === "company" && rule.evidenceUrls.length < 2) {
    throw new Error(
      "FAIL position exclusions: 회사 전체 제외에는 공개 근거 URL이 두 개 이상 필요합니다.",
    );
  }
}

export function loadPositionExclusions(path = defaultExclusionsPath): PositionExclusions {
  try {
    const parsed = positionExclusionsSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    if (parsed.schemaVersion === 2) {
      for (const rule of parsed.exclusions) {
        if ("scope" in rule) validateCareerDownsideExclusion(rule);
      }
    }
    return parsed;
  } catch {
    // 개인 식별자와 파일 본문을 오류나 후보풀에 남기지 않는다.
    throw new Error(
      "FAIL position exclusions: 설정을 읽거나 검증할 수 없습니다. 비공개 작업본과 설정을 확인하세요.",
    );
  }
}

export function filterExcludedPostings(posts: Posting[], config: PositionExclusions) {
  const rules = positionExclusionsSchema.parse(config).exclusions;
  const identities = new Set<string>();
  const urls = new Set<string>();
  const companies = new Set<string>();
  for (const rule of rules) {
    if (isCompanyExclusion(rule)) {
      companies.add(rule.company);
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
      !companies.has(post.company)
    )
      return true;
    rejectedBySource.set(post.source, (rejectedBySource.get(post.source) ?? 0) + 1);
    return false;
  });
  return { eligible, rejectedBySource };
}
