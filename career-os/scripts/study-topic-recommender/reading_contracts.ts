import { z } from "zod";

export const READING_CATEGORIES = ["techBlog", "geek"] as const;
export const READING_SOURCE_ADAPTER_IDS = ["feed", "page"] as const;
export const READING_CANDIDATE_KINDS = ["feed-article", "page-link"] as const;
export const READING_COLLECTION_STATUSES = [
  "collected",
  "page-links",
  "no-public-url",
  "no-articles",
] as const;

export const DEFAULT_MAX_CANDIDATES_PER_SOURCE = 8;
export const READING_SELECTION_TEXT_MAX_LENGTH = 300;

const nonEmptyString = z.string().trim().min(1);
const httpsUrl = z.url().refine((value) => value.startsWith("https://"), {
  message: "HTTPS URL이어야 한다.",
});

export const readingCategorySchema = z.enum(READING_CATEGORIES);
export const readingSourceAdapterIdSchema = z.enum(READING_SOURCE_ADAPTER_IDS);
export const readingCandidateKindSchema = z.enum(READING_CANDIDATE_KINDS);
export const readingCollectionStatusSchema = z.enum(READING_COLLECTION_STATUSES);

export const readingCategoryPolicySchema = z.object({
  slots: z.number().int().nonnegative(),
});

export const readingSourceSchema = z.object({
  key: nonEmptyString,
  category: readingCategorySchema,
  title: nonEmptyString,
  url: httpsUrl.optional(),
  feedUrl: httpsUrl.optional(),
  enabled: z.boolean().optional(),
  adapter: readingSourceAdapterIdSchema.optional(),
}).superRefine((source, context) => {
  if (!source.url && !source.feedUrl) {
    context.addIssue({
      code: "custom",
      path: ["url"],
      message: "url 또는 feedUrl 중 하나가 필요하다.",
    });
  }
  if (source.adapter === "feed" && !source.feedUrl) {
    context.addIssue({
      code: "custom",
      path: ["feedUrl"],
      message: "feed 어댑터에는 feedUrl이 필요하다.",
    });
  }
  if (source.adapter === "page" && !source.url) {
    context.addIssue({
      code: "custom",
      path: ["url"],
      message: "page 어댑터에는 url이 필요하다.",
    });
  }
});

export const readingSourcesConfigSchema = z.object({
  _meta: z.object({
    purpose: nonEmptyString,
    schemaVersion: z.literal(3),
  }),
  categories: z.object({
    techBlog: readingCategoryPolicySchema,
    geek: readingCategoryPolicySchema,
  }),
  sources: z.array(readingSourceSchema),
}).superRefine((config, context) => {
  const seen = new Set<string>();
  config.sources.forEach((source, index) => {
    if (seen.has(source.key)) {
      context.addIssue({
        code: "custom",
        path: ["sources", index, "key"],
        message: `중복 key: ${source.key}`,
      });
    }
    seen.add(source.key);
  });
});

export const readingCandidateSchema = z.object({
  id: nonEmptyString,
  sourceKey: nonEmptyString,
  sourceName: nonEmptyString,
  category: readingCategorySchema,
  title: nonEmptyString,
  url: httpsUrl,
  published: z.string(),
  kind: readingCandidateKindSchema,
  recentlyRecommended: z.boolean(),
});

export const readingCollectionLogSchema = z.object({
  sourceKey: nonEmptyString,
  status: readingCollectionStatusSchema,
  candidateCount: z.number().int().nonnegative(),
});

export const readingCandidatePoolSchema = z.object({
  generatedAt: z.iso.datetime(),
  policy: z.object({
    selection: z.literal("llm"),
    fixedKeywordsUsed: z.literal(false),
    sourcePriorityUsed: z.literal(false),
    maxCandidatesPerSource: z.number().int().positive(),
  }),
  candidates: z.array(readingCandidateSchema),
  collectionLog: z.array(readingCollectionLogSchema),
}).superRefine((pool, context) => {
  const seen = new Set<string>();
  pool.candidates.forEach((candidate, index) => {
    if (seen.has(candidate.id)) {
      context.addIssue({
        code: "custom",
        path: ["candidates", index, "id"],
        message: `중복 candidateId: ${candidate.id}`,
      });
    }
    seen.add(candidate.id);
  });
});

export const readingSelectionItemSchema = z.object({
  candidateId: nonEmptyString,
  summary: z.string().trim().min(1).max(READING_SELECTION_TEXT_MAX_LENGTH),
  reason: z.string().trim().min(1).max(READING_SELECTION_TEXT_MAX_LENGTH),
});

export const readingSelectionSchema = z.object({
  selections: z.object({
    techBlog: z.array(readingSelectionItemSchema),
    geek: z.array(readingSelectionItemSchema),
  }),
});

export const readingRecommendationSchema = z.object({
  sourceKey: nonEmptyString,
  sourceName: nonEmptyString,
  category: readingCategorySchema,
  title: nonEmptyString,
  url: httpsUrl,
  published: z.string(),
  summary: nonEmptyString,
  reason: nonEmptyString,
});

export const morningReadingReportSchema = z.object({
  generatedAt: z.iso.datetime(),
  sourceOfTruth: z.object({
    config: z.literal("config/external-reading-sources.ts"),
    collectedArticles: z.literal("state/reading-candidates.json"),
  }),
  counts: z.object({
    activeSources: z.number().int().nonnegative(),
    sourcesWithCandidates: z.number().int().nonnegative(),
    collectedArticles: z.number().int().nonnegative(),
    techBlogSources: z.number().int().nonnegative(),
    geekSources: z.number().int().nonnegative(),
  }),
  collectionLog: z.array(readingCollectionLogSchema),
  recommendations: z.object({
    techBlog: z.array(readingRecommendationSchema),
    geek: z.array(readingRecommendationSchema),
  }),
});

export type ReadingCategory = z.infer<typeof readingCategorySchema>;
export type ReadingSourceAdapterId = z.infer<typeof readingSourceAdapterIdSchema>;
export type ReadingCandidateKind = z.infer<typeof readingCandidateKindSchema>;
export type ReadingCollectionStatus = z.infer<typeof readingCollectionStatusSchema>;
export type ReadingCategoryPolicy = z.infer<typeof readingCategoryPolicySchema>;
export type ReadingSource = z.infer<typeof readingSourceSchema>;
export type ReadingSourcesConfig = z.infer<typeof readingSourcesConfigSchema>;
export type ReadingCandidate = z.infer<typeof readingCandidateSchema>;
export type ReadingCollectionLog = z.infer<typeof readingCollectionLogSchema>;
export type ReadingCandidatePool = z.infer<typeof readingCandidatePoolSchema>;
export type ReadingSelectionItem = z.infer<typeof readingSelectionItemSchema>;
export type ReadingSelection = z.infer<typeof readingSelectionSchema>;
export type ReadingRecommendation = z.infer<typeof readingRecommendationSchema>;
export type MorningReadingReport = z.infer<typeof morningReadingReportSchema>;

export interface NormalizedReadingSources {
  categories: Record<ReadingCategory, ReadingCategoryPolicy>;
  sources: ReadingSource[];
  itemsByCategory: Record<ReadingCategory, ReadingSource[]>;
}

export interface ReadingSelectionResult {
  recommendations: Record<ReadingCategory, ReadingRecommendation[]>;
}

export interface ReadingHistoryEntry {
  generatedAt?: string;
  articleUrls?: string[];
}
