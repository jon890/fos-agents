import { z } from "zod";
import { CareerBackend, CareerError } from "./backend.ts";
import { idempotencyKey } from "./idempotency.ts";
import { seoulDate } from "./seoul-date.ts";

// Field names and enum values are the Backend's (services/career-backend/src/study/schema.ts).
// Length limits are shorter than the Backend's on purpose: fos-assistant rejects an approval-bound
// call whose serialized arguments exceed 16KB of UTF-8, before it reaches this connector, so every
// argument that passes this schema must fit in that budget. study.test.ts checks the worst case.
// Strings are not trimmed so the limit bounds the bytes actually sent.
const nonBlank = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => value.trim().length > 0);
const categorySchema = z.enum(["techBlog", "geek", "ai", "video"]);
const careerValueSchema = z.enum(["current-work", "target-role", "engineering-judgment", "product-business"]);
// Same shapes as readingContentKey (scripts/study-topic-recommender/url_identity.ts).
const contentKeySchema = z.string().regex(/^(url:[0-9a-f]{64}|youtube:[A-Za-z0-9_-]{6,20})$/);
const utcIsoSchema = z.string().refine((value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
});

const maxItemsAcrossTopics = 8;

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
          topicKey: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
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

export type GetStudyCandidatesArgs = z.infer<typeof getStudyCandidatesSchema>;
export type SaveStudyRecommendationArgs = z.infer<typeof saveStudyRecommendationSchema>;

const candidatePageResponse = z.object({
  candidates: z.array(
    z.object({
      contentKey: z.string(),
      title: z.string(),
      url: z.string(),
      sourceName: z.string(),
      category: categorySchema,
      kind: z.string(),
      published: z.string(),
      excerpt: z.string().optional(),
    }),
  ),
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

export async function getStudyCandidates(backend: CareerBackend, args: GetStudyCandidatesArgs) {
  const query = new URLSearchParams({ limit: String(args.limit ?? 20) });
  if (args.category) query.set("category", args.category);
  let page: z.infer<typeof candidatePageResponse>;
  try {
    page = await backend.request("GET", `/api/study/v1/candidates?${query}`, candidatePageResponse);
  } catch (error) {
    // The only 409 on this path is CANDIDATE_CONTEXT_MISSING: no learning-interests document yet.
    if (error instanceof CareerError && error.code === "CAREER_VERSION_CONFLICT")
      throw new CareerError("CAREER_LEARNING_INTERESTS_MISSING");
    throw error;
  }
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

// reportId and Idempotency-Key are the CLI's (study-library/recommendations.ts reportIdForMorningReading,
// study-library/client.ts createRecommendationRun), so one report per Seoul day whichever side saves it.
export async function saveStudyRecommendation(
  backend: CareerBackend,
  args: SaveStudyRecommendationArgs,
  now: () => Date,
) {
  const generatedAt = args.generatedAt ?? now().toISOString();
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
      throw new CareerError("CAREER_STUDY_CONFLICT");
    }
    // The outcome is unknown; resending with this generatedAt reuses the same Idempotency-Key.
    if (error.code === "CAREER_NETWORK") throw new CareerError("CAREER_NETWORK", { reportId, generatedAt });
    throw error;
  }
}
