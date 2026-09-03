import { z } from "zod";

export const READING_CATEGORIES = ["techBlog", "geek", "ai", "video"] as const;
export const READING_CAREER_VALUES = [
  "current-work",
  "target-role",
  "engineering-judgment",
  "product-business",
] as const;
export const READING_SOURCE_ADAPTER_IDS = ["feed", "page", "youtube"] as const;
export const READING_CANDIDATE_KINDS = [
  "feed-article",
  "feed-video",
  "page-link",
  "page-video",
] as const;
export const READING_COLLECTION_STATUSES = [
  "collected",
  "page-links",
  "no-public-url",
  "no-articles",
] as const;

export const DEFAULT_MAX_CANDIDATES_PER_SOURCE = 48;
export const READING_CANDIDATE_EXCERPT_MAX_LENGTH = 2_000;
export const READING_SELECTION_TEXT_MAX_LENGTH = 300;

const nonEmptyString = z.string().trim().min(1);
const topicKey = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const httpsUrl = z.url().refine((value) => value.startsWith("https://"), {
  message: "HTTPS URL이어야 한다.",
});

export const readingCategorySchema = z.enum(READING_CATEGORIES);
export const readingCareerValueSchema = z.enum(READING_CAREER_VALUES);
export const readingSourceAdapterIdSchema = z.enum(READING_SOURCE_ADAPTER_IDS);
export const readingCandidateKindSchema = z.enum(READING_CANDIDATE_KINDS);
export const readingCollectionStatusSchema = z.enum(READING_COLLECTION_STATUSES);

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
  if (source.adapter === "youtube" && !source.url) {
    context.addIssue({
      code: "custom",
      path: ["url"],
      message: "youtube 어댑터에는 채널 url이 필요하다.",
    });
  }
});

export const readingSourcesConfigSchema = z.object({
  _meta: z.object({
    purpose: nonEmptyString,
    schemaVersion: z.literal(6),
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
  contentKey: nonEmptyString,
  canonicalUrl: httpsUrl,
  sourceKey: nonEmptyString,
  sourceName: nonEmptyString,
  category: readingCategorySchema,
  title: nonEmptyString,
  url: httpsUrl,
  published: z.string(),
  excerpt: z.string().max(READING_CANDIDATE_EXCERPT_MAX_LENGTH).optional(),
  kind: readingCandidateKindSchema,
  previouslyRecommended: z.boolean(),
});

export const readingCollectionLogSchema = z.object({
  sourceKey: nonEmptyString,
  status: readingCollectionStatusSchema,
  candidateCount: z.number().int().nonnegative(),
});

export const readingCandidatePoolSchema = z.object({
  generatedAt: z.iso.datetime(),
  recentStudyTopicKeys: z.array(topicKey),
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
  const contentKeys = new Set<string>();
  const recentTopicKeys = new Set<string>();
  pool.recentStudyTopicKeys.forEach((key, index) => {
    if (recentTopicKeys.has(key)) {
      context.addIssue({
        code: "custom",
        path: ["recentStudyTopicKeys", index],
        message: `중복 topicKey: ${key}`,
      });
    }
    recentTopicKeys.add(key);
  });
  pool.candidates.forEach((candidate, index) => {
    if (seen.has(candidate.id)) {
      context.addIssue({
        code: "custom",
        path: ["candidates", index, "id"],
        message: `중복 candidateId: ${candidate.id}`,
      });
    }
    seen.add(candidate.id);
    if (contentKeys.has(candidate.contentKey)) {
      context.addIssue({
        code: "custom",
        path: ["candidates", index, "contentKey"],
        message: `중복 contentKey: ${candidate.contentKey}`,
      });
    }
    contentKeys.add(candidate.contentKey);
  });
});

export const readingSelectionItemSchema = z.object({
  candidateId: nonEmptyString,
  summary: z.string().trim().min(1).max(READING_SELECTION_TEXT_MAX_LENGTH),
  reason: z.string().trim().min(1).max(READING_SELECTION_TEXT_MAX_LENGTH),
  careerValue: readingCareerValueSchema,
});

export const readingSelectionSchema = z.object({
  topics: z.array(z.object({
    topicKey,
    title: z.string().trim().min(1).max(READING_SELECTION_TEXT_MAX_LENGTH),
    careerQuestion: z.string().trim().min(1).max(READING_SELECTION_TEXT_MAX_LENGTH),
    items: z.array(readingSelectionItemSchema).min(1),
  })),
});

export const readingRecommendationSchema = z.object({
  contentKey: nonEmptyString,
  canonicalUrl: httpsUrl,
  sourceKey: nonEmptyString,
  sourceName: nonEmptyString,
  category: readingCategorySchema,
  title: nonEmptyString,
  url: httpsUrl,
  published: z.string(),
  summary: nonEmptyString,
  reason: nonEmptyString,
  careerValue: readingCareerValueSchema,
});

export const readingStudyTopicSchema = z.object({
  topicKey,
  title: nonEmptyString,
  careerQuestion: nonEmptyString,
  items: z.array(readingRecommendationSchema).min(1),
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
    aiSources: z.number().int().nonnegative(),
    videoSources: z.number().int().nonnegative(),
  }),
  collectionLog: z.array(readingCollectionLogSchema),
  topics: z.array(readingStudyTopicSchema),
}).superRefine((report, context) => {
  const topicKeys = new Set<string>();
  const contentKeys = new Set<string>();
  report.topics.forEach((topic, topicIndex) => {
    if (topicKeys.has(topic.topicKey)) {
      context.addIssue({
        code: "custom",
        path: ["topics", topicIndex, "topicKey"],
        message: `중복 topicKey: ${topic.topicKey}`,
      });
    }
    topicKeys.add(topic.topicKey);
    topic.items.forEach((item, itemIndex) => {
      if (contentKeys.has(item.contentKey)) {
        context.addIssue({
          code: "custom",
          path: ["topics", topicIndex, "items", itemIndex, "contentKey"],
          message: `중복 contentKey: ${item.contentKey}`,
        });
      }
      contentKeys.add(item.contentKey);
    });
  });
});

export const readingHistoryEntrySchema = z.object({
  contentKey: nonEmptyString,
  canonicalUrl: httpsUrl,
  sourceKey: nonEmptyString,
  category: readingCategorySchema,
  title: nonEmptyString,
  studyTopic: nonEmptyString,
  studyTopicKey: topicKey,
  careerValue: readingCareerValueSchema,
  recommendedAt: z.iso.datetime(),
  reportId: nonEmptyString,
});

export const morningStudyHistorySchema = z.object({
  schemaVersion: z.literal(1),
  reports: z.array(z.object({
    reportId: nonEmptyString,
    recommendedAt: z.iso.datetime(),
  })),
  entries: z.array(readingHistoryEntrySchema),
}).superRefine((history, context) => {
  const keys = new Set<string>();
  history.entries.forEach((entry, index) => {
    if (keys.has(entry.contentKey)) {
      context.addIssue({ code: "custom", path: ["entries", index, "contentKey"], message: `중복 contentKey: ${entry.contentKey}` });
    }
    keys.add(entry.contentKey);
  });
  const reportIds = new Set<string>();
  history.reports.forEach((report, index) => {
    if (reportIds.has(report.reportId)) {
      context.addIssue({ code: "custom", path: ["reports", index, "reportId"], message: `중복 reportId: ${report.reportId}` });
    }
    reportIds.add(report.reportId);
  });
});

export type ReadingCategory = z.infer<typeof readingCategorySchema>;
export type ReadingCareerValue = z.infer<typeof readingCareerValueSchema>;
export type ReadingSourceAdapterId = z.infer<typeof readingSourceAdapterIdSchema>;
export type ReadingCandidateKind = z.infer<typeof readingCandidateKindSchema>;
export type ReadingCollectionStatus = z.infer<typeof readingCollectionStatusSchema>;
export type ReadingSource = z.infer<typeof readingSourceSchema>;
export type ReadingSourcesConfig = z.infer<typeof readingSourcesConfigSchema>;
export type ReadingCandidate = z.infer<typeof readingCandidateSchema>;
export type ReadingCollectionLog = z.infer<typeof readingCollectionLogSchema>;
export type ReadingCandidatePool = z.infer<typeof readingCandidatePoolSchema>;
export type ReadingSelectionItem = z.infer<typeof readingSelectionItemSchema>;
export type ReadingSelection = z.infer<typeof readingSelectionSchema>;
export type ReadingRecommendation = z.infer<typeof readingRecommendationSchema>;
export type ReadingStudyTopic = z.infer<typeof readingStudyTopicSchema>;
export type MorningReadingReport = z.infer<typeof morningReadingReportSchema>;
export type ReadingHistoryEntry = z.infer<typeof readingHistoryEntrySchema>;
export type MorningStudyHistory = z.infer<typeof morningStudyHistorySchema>;

export interface NormalizedReadingSources {
  sources: ReadingSource[];
  itemsByCategory: Record<ReadingCategory, ReadingSource[]>;
}

export interface ReadingSelectionResult {
  topics: ReadingStudyTopic[];
}
