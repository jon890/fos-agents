import { z } from "zod";
import { CareerBackend, CareerError } from "./backend.ts";
import { idempotencyKey } from "./idempotency.ts";
import { seoulDate } from "./seoul-date.ts";

// Field names and enum values are the Backend's (services/career-backend/src/study/schema.ts).
// Length limits are shorter than the Backend's on purpose: fos-assistant rejects an approval-bound
// call whose serialized arguments exceed 16KB of UTF-8, before it reaches this connector, so every
// argument that passes this schema must fit in that budget. study.test.ts checks the worst case.
// Strings are not trimmed so the limit bounds the bytes actually sent. Control characters, line
// breaks included, are rejected: JSON escapes them to six bytes each (\u0001), more than a Hangul
// syllable's three, which would break the worst-case bound.
const nonBlank = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => value.trim().length > 0)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value));
const categorySchema = z.enum(["techBlog", "geek", "ai", "video"]);
const careerValueSchema = z.enum(["current-work", "target-role", "engineering-judgment", "product-business"]);
// Same shapes as readingContentKey (scripts/study-topic-recommender/url_identity.ts).
const contentKeySchema = z.string().regex(/^(url:[0-9a-f]{64}|youtube:[A-Za-z0-9_-]{6,20})$/);
const utcIsoSchema = z.string().refine((value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
});

const maxItemsAcrossTopics = 8;
// A generatedAt far from now would file the report under another Seoul day.
const maxGeneratedAtLagMs = 24 * 60 * 60 * 1000;
const maxGeneratedAtLeadMs = 5 * 60 * 1000;

export const getStudyCandidatesSchema = z.strictObject({
  limit: z.number().int().min(1).max(20).optional(),
  category: categorySchema.optional(),
});

// Duplicate topicKey or contentKey and overlaps between picks and rejections are judged by the Backend.
export const saveStudyRecommendationSchema = z
  .strictObject({
    candidateContextVersion: nonBlank(100),
    generatedAt: utcIsoSchema.optional(),
    topics: z
      .array(
        z.strictObject({
          // Same shape as the notebook's topicKey (scripts/study-topic-recommender/reading_contracts.ts), capped at 80.
          topicKey: z.string().regex(/^(?=.{1,80}$)[a-z0-9]+(?:-[a-z0-9]+)*$/),
          title: nonBlank(60),
          careerQuestion: nonBlank(100).nullable(),
          items: z
            .array(
              z.strictObject({
                contentKey: contentKeySchema,
                summary: nonBlank(100),
                reason: nonBlank(100),
                careerValue: careerValueSchema.nullable(),
              }),
            )
            .min(1),
        }),
      )
      .max(4),
    rejections: z.array(z.strictObject({ contentKey: contentKeySchema, reason: nonBlank(50) })).max(20),
  })
  .superRefine((value, context) => {
    const total = value.topics.reduce((sum, topic) => sum + topic.items.length, 0);
    if (total > maxItemsAcrossTopics)
      context.addIssue({ code: "custom", path: ["topics"], message: `items 합계는 ${maxItemsAcrossTopics}개 이하다` });
  });

// Read only and not approval-bound, so the Backend's filters pass through. The limit is capped
// below the Backend's 100 to keep one result small; nextCursor walks the rest.
export const listStudyCandidatesSchema = z.strictObject({
  limit: z.number().int().min(1).max(50).optional(),
  category: categorySchema.optional(),
  sourceKey: nonBlank(100).optional(),
  // Same rule as the Backend query (z.iso.datetime), so a value it would reject never reaches fetch.
  publishedFrom: z.iso.datetime().optional(),
  publishedTo: z.iso.datetime().optional(),
  cursor: nonBlank(1000).optional(),
});

export type GetStudyCandidatesArgs = z.infer<typeof getStudyCandidatesSchema>;
export type SaveStudyRecommendationArgs = z.infer<typeof saveStudyRecommendationSchema>;
export type ListStudyCandidatesArgs = z.infer<typeof listStudyCandidatesSchema>;

const candidateRow = z.object({
  contentKey: z.string(),
  title: z.string(),
  url: z.string(),
  sourceName: z.string(),
  category: categorySchema,
  kind: z.string(),
  published: z.string(),
  excerpt: z.string().optional(),
});
// list_study_candidates also needs the source identity; get_study_candidates keeps its older shape.
const listedCandidateRow = candidateRow.extend({ canonicalUrl: z.string(), sourceKey: z.string() });
const candidatePageResponse = <R extends z.ZodType>(row: R) =>
  z.object({
    candidates: z.array(row),
    recentStudyTopicKeys: z.array(z.string()),
    nextCursor: z.string().nullable(),
    historyVersion: z.number().int().nonnegative(),
    candidateContextVersion: z.string(),
    learningInterests: z.object({ version: z.number().int(), body: z.string() }),
  });
const recommendationRunResponse = z.object({ reportId: z.string(), historyVersion: z.number().int().nonnegative() });
const recommendationStatusResponse = z.object({ reportId: z.string(), exists: z.boolean() });

// External text is not carried at length in tool results.
const maxExcerptLength = 500;
const truncate = (text: string) => {
  const chars = Array.from(text);
  return chars.length > maxExcerptLength ? chars.slice(0, maxExcerptLength).join("") : text;
};


// Resolves to null when the Backend answers 409. The only 409 on this path is
// CANDIDATE_CONTEXT_MISSING: no learning-interests document yet.
async function fetchCandidatePage<R extends z.ZodType>(
  backend: CareerBackend,
  query: URLSearchParams,
  row: R,
): Promise<z.infer<ReturnType<typeof candidatePageResponse<R>>> | null> {
  try {
    return await backend.request("GET", `/api/study/v1/candidates?${query}`, candidatePageResponse(row));
  } catch (error) {
    if (error instanceof CareerError && error.code === "CAREER_VERSION_CONFLICT") return null;
    throw error;
  }
}

export async function getStudyCandidates(backend: CareerBackend, args: GetStudyCandidatesArgs) {
  const query = new URLSearchParams({ limit: String(args.limit ?? 20) });
  if (args.category) query.set("category", args.category);
  const page = await fetchCandidatePage(backend, query, candidateRow);
  if (!page) throw new CareerError("CAREER_LEARNING_INTERESTS_MISSING");
  return {
    candidateContextVersion: page.candidateContextVersion,
    historyVersion: page.historyVersion,
    learningInterests: page.learningInterests,
    recentStudyTopicKeys: page.recentStudyTopicKeys,
    nextCursor: page.nextCursor,
    candidates: page.candidates.map(({ contentKey, title, url, sourceName, category, kind, published, excerpt }) => ({
      contentKey,
      title,
      url,
      sourceName,
      category,
      kind,
      published,
      ...(excerpt === undefined ? {} : { excerpt: truncate(excerpt) }),
    })),
  };
}

// A starting point for research, not a verdict: an empty page says nothing about what exists on
// the web. A missing learning-interests document is a state the caller can work around, not an error.
// The interests body is left to get_context_document, so only its version travels here.
export async function listStudyCandidates(backend: CareerBackend, args: ListStudyCandidatesArgs) {
  const query = new URLSearchParams({ limit: String(args.limit ?? 20) });
  for (const key of ["category", "sourceKey", "publishedFrom", "publishedTo", "cursor"] as const) {
    const value = args[key];
    if (value !== undefined) query.set(key, value);
  }
  const page = await fetchCandidatePage(backend, query, listedCandidateRow);
  if (!page) return { status: "learning_interests_missing" as const };
  return {
    status: page.candidates.length > 0 ? ("ok" as const) : ("empty" as const),
    candidateContextVersion: page.candidateContextVersion,
    learningInterestsVersion: page.learningInterests.version,
    historyVersion: page.historyVersion,
    recentStudyTopicKeys: page.recentStudyTopicKeys,
    nextCursor: page.nextCursor,
    hasMore: page.nextCursor !== null,
    candidates: page.candidates.map(
      ({ contentKey, canonicalUrl, sourceKey, sourceName, title, url, category, kind, published, excerpt }) => ({
        contentKey,
        canonicalUrl,
        url,
        sourceKey,
        sourceName,
        title,
        category,
        kind,
        published,
        ...(excerpt === undefined ? {} : { excerpt: truncate(excerpt) }),
      }),
    ),
  };
}

// reportId and Idempotency-Key are the CLI's (study-library/recommendations.ts reportIdForMorningReading,
// study-library/client.ts createRecommendationRun), so one report per Seoul day whichever side saves it.
export async function saveStudyRecommendation(
  backend: CareerBackend,
  args: SaveStudyRecommendationArgs,
  now: () => Date,
) {
  const nowMs = now().getTime();
  const generatedAt = args.generatedAt ?? new Date(nowMs).toISOString();
  const offsetMs = new Date(generatedAt).getTime() - nowMs;
  if (offsetMs < -maxGeneratedAtLagMs || offsetMs > maxGeneratedAtLeadMs) throw new CareerError("CAREER_INVALID_INPUT");
  const reportId = `morning-${seoulDate(new Date(generatedAt))}`;
  const body = {
    reportId,
    generatedAt,
    candidateContextVersion: args.candidateContextVersion,
    topics: args.topics,
    rejections: args.rejections,
  };
  try {
    const result = await backend.request(
      "POST",
      "/api/study/v1/recommendation-runs",
      recommendationRunResponse,
      body,
      idempotencyKey("recommendation", { reportId, generatedAt }),
    );
    return { reportId, generatedAt, historyVersion: result.historyVersion };
  } catch (error) {
    if (!(error instanceof CareerError)) throw error;
    // A second save on the same day is always 409, so tell it apart from a stale or repeated pick;
    // otherwise the conversation would ask for approval again and again.
    if (error.code === "CAREER_VERSION_CONFLICT") {
      const exists = await backend
        .request(
          "GET",
          `/api/study/v1/recommendation-runs/${encodeURIComponent(reportId)}/status`,
          recommendationStatusResponse,
        )
        .then((status) => status.exists)
        .catch(() => false);
      if (exists) throw new CareerError("CAREER_STUDY_ALREADY_SAVED", { reportId });
      // Every other 409: the context changed, a recent topic or item was picked again, or the
      // same request is still in flight or was sent with another body (IDEMPOTENCY_CONFLICT).
      throw new CareerError("CAREER_STUDY_CONFLICT");
    }
    // The outcome is unknown; resending with this generatedAt reuses the same Idempotency-Key.
    if (error.code === "CAREER_NETWORK") throw new CareerError("CAREER_NETWORK", { reportId, generatedAt });
    throw error;
  }
}
