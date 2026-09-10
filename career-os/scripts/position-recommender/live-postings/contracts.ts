import { z } from "zod";

export const SOURCE_IDS = [
  "wanted",
  "toss-careers",
  "coupang-careers",
  "kakaopay",
  "kakaopay-securities",
  "kakaomobility",
  "kakaobank-careers",
  "kurly-careers",
  "naver-careers",
  "samsung-careers",
  "sk-careers",
  "cj-careers",
  "krafton-careers",
  "line-careers",
  "daangn-careers",
  "woowahan-careers",
] as const;

export const SOURCE_ALIASES = [
  "toss",
  "coupang",
  "kakaobank",
  "kurly",
  "samsung",
  "sk",
  "cj",
  "krafton",
  "line",
  "daangn",
  "woowahan",
] as const;

export const DISCOVERY_MODES = [
  "broad",
  "official-listing",
  "official-sitemap",
  "official-detail",
] as const;

export const sourceIdSchema = z.enum(SOURCE_IDS);
export const discoveryModeSchema = z.enum(DISCOVERY_MODES);

const nonEmptyString = z.string().trim().min(1);
const httpUrl = z.url().refine((value) => value.startsWith("https://"), {
  message: "공고 URL은 HTTPS여야 한다.",
});

export const postingSchema = z
  .object({
    source: sourceIdSchema,
    discoveryMode: discoveryModeSchema.optional(),
    company: nonEmptyString,
    title: nonEmptyString,
    url: httpUrl,
    identityHash: nonEmptyString.optional(),
    linkType: z.enum(["direct_posting", "career_article", "search_page"]),
    postingStatus: z.enum(["active", "open", "unknown"]),
    activeEvidence: nonEmptyString,
    openedAt: z.string(),
    closesAt: z.string(),
    daysUntilClose: z.string(),
    closeUrgency: z.enum(["urgent", "soon", "normal", "no_deadline", "unknown"]),
    category: z.string(),
    summary: z.string(),
    tags: z.array(z.string()),
    skills: z.array(z.string()),
    dueTime: z.string(),
    mainTasks: z.string(),
    requirements: z.string(),
    preferred: z.string(),
  })
  .strict();

export const postingCandidateSchema = postingSchema
  .extend({
    id: nonEmptyString,
  })
  .strict();

/**
 * 소스별 수집 진단. 세 개수의 뜻을 어댑터가 임의로 정하지 않는다.
 * `collection_health.ts` 가 이 값으로 실행 전체의 성패를 판정하기 때문이다.
 *
 * - `collectedCount`: 어댑터가 `Posting` 으로 만들어 넘긴 공고 수. 원본 목록 건수가 아니다.
 * - `importedCount`: 그중 공통 생명주기 검사를 통과해 후보풀에 들어간 수. 수집기가 채운다.
 * - `skippedCount`: 대상 역할이나 고용 형태가 아니어서 의도적으로 뺀 수.
 * - `failedCount`: 요청이나 파싱이 실패해 판단하지 못한 수.
 *
 * 원본 목록 건수처럼 소스마다 다른 값은 `message` 에 적는다.
 */
export const sourceDiagnosticSchema = z
  .object({
    source: sourceIdSchema,
    status: z.enum(["ok", "partial", "failed"]),
    collectedCount: z.number().int().nonnegative(),
    importedCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    discoveryModes: z.array(discoveryModeSchema),
    message: z.string(),
  })
  .strict();

export const postingCandidatePoolSchema = z
  .object({
    schemaVersion: z.literal(1),
    collectionRunId: nonEmptyString,
    collectedAt: z.iso.datetime(),
    requestedSource: nonEmptyString,
    configuredSources: z.array(sourceIdSchema).min(1),
    policy: z
      .object({
        selection: z.literal("llm"),
        activeDirectOnly: z.literal(true),
        fixedPreferenceKeywordsUsed: z.boolean(),
        sourcePriorityUsed: z.literal(false),
      })
      .strict(),
    candidates: z.array(postingCandidateSchema),
    sourceDiagnostics: z.array(sourceDiagnosticSchema),
    errors: z.array(z.string()),
  })
  .strict()
  .superRefine((pool, context) => {
    const ids = new Set<string>();
    const urls = new Set<string>();
    pool.candidates.forEach((candidate, index) => {
      if (ids.has(candidate.id)) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "id"],
          message: `중복 공고 ID: ${candidate.id}`,
        });
      }
      if (urls.has(candidate.url)) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "url"],
          message: `중복 공고 URL: ${candidate.url}`,
        });
      }
      ids.add(candidate.id);
      urls.add(candidate.url);
    });
  });

export type SourceId = z.infer<typeof sourceIdSchema>;
export type DiscoveryMode = z.infer<typeof discoveryModeSchema>;
export type Posting = z.infer<typeof postingSchema>;
export type PostingCandidate = z.infer<typeof postingCandidateSchema>;
export type SourceDiagnostic = z.infer<typeof sourceDiagnosticSchema>;
export type PostingCandidatePool = z.infer<typeof postingCandidatePoolSchema>;
