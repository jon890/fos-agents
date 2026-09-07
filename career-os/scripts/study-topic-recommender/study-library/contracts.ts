import { z } from "zod";
import {
  readingCareerValueSchema,
  readingCandidateKindSchema,
  readingCategorySchema,
  readingSourceAdapterIdSchema,
  type ReadingCandidate,
} from "../reading_contracts.js";

const nonEmptyString = z.string().trim().min(1);
const nullableHttpsUrl = z.url().refine((value) => value.startsWith("https://"), {
  message: "HTTPS URL이어야 한다.",
}).nullable();
const cursorSchema = z.record(z.string(), z.unknown()).nullable();

export const studyLibrarySourceSchema = z.object({
  sourceKey: nonEmptyString,
  title: nonEmptyString,
  category: readingCategorySchema,
  url: nullableHttpsUrl,
  feedUrl: nullableHttpsUrl,
  adapter: readingSourceAdapterIdSchema,
  enabled: z.boolean(),
  version: z.number().int().nonnegative(),
});

export const studyLibrarySourcesResponseSchema = z.object({
  sources: z.array(studyLibrarySourceSchema),
});

export const studyLibrarySourceUpsertResponseSchema = z.object({
  source: studyLibrarySourceSchema,
  version: z.number().int().nonnegative(),
});

export const studyLibraryCursorResultSchema = z.object({
  sourceKey: nonEmptyString,
  mode: z.enum(["recent", "archive"]),
  cursor: cursorSchema,
  version: z.number().int().nonnegative(),
});

export const studyLibraryIngestionResultSchema = z.object({
  idempotencyKey: nonEmptyString,
  acceptedCount: z.number().int().nonnegative(),
  cursorVersion: z.number().int().nonnegative(),
});

export const studyLibraryCandidateSchema = z.object({
  id: nonEmptyString,
  contentKey: nonEmptyString,
  canonicalUrl: z.url().refine((value) => value.startsWith("https://"), {
    message: "HTTPS URL이어야 한다.",
  }),
  sourceKey: nonEmptyString,
  sourceName: nonEmptyString,
  category: readingCategorySchema,
  title: nonEmptyString,
  url: z.url().refine((value) => value.startsWith("https://"), {
    message: "HTTPS URL이어야 한다.",
  }),
  published: z.string(),
  excerpt: z.string().max(2_000).optional(),
  kind: readingCandidateKindSchema,
  previouslyRecommended: z.boolean(),
}).superRefine((candidate, context) => {
  if (candidate.id !== candidate.contentKey) {
    context.addIssue({
      code: "custom",
      path: ["id"],
      message: "Candidate.id는 contentKey와 같아야 한다.",
    });
  }
});

export const studyLibraryCandidatePageSchema = z.object({
  candidates: z.array(studyLibraryCandidateSchema),
  recentStudyTopicKeys: z.array(nonEmptyString),
  nextCursor: z.string().nullable(),
  historyVersion: z.number().int().nonnegative(),
});

export const studyLibraryRecommendationRunResultSchema = z.object({
  reportId: nonEmptyString,
  historyVersion: z.number().int().nonnegative(),
});

export const studyLibraryPublicationResultSchema = z.object({
  publicationId: nonEmptyString,
});

export const studyLibraryImportItemSchema = z.object({
  contentKey: nonEmptyString,
  canonicalUrl: z.url().refine((value) => value.startsWith("https://"), {
    message: "HTTPS URL이어야 한다.",
  }),
  sourceKey: nonEmptyString,
  title: nonEmptyString,
  category: readingCategorySchema,
  summary: z.string().trim().min(1).max(300).nullable(),
  reason: z.string().trim().min(1).max(300).nullable(),
  careerValue: readingCareerValueSchema.nullable(),
});

export const studyLibraryImportTopicSchema = z.object({
  topicKey: nonEmptyString,
  title: nonEmptyString,
  careerQuestion: z.string().trim().min(1).max(300).nullable(),
  items: z.array(studyLibraryImportItemSchema).min(1),
});

export const studyLibraryImportReportSchema = z.object({
  reportId: nonEmptyString,
  generatedAt: z.iso.datetime(),
  topics: z.array(studyLibraryImportTopicSchema).max(20),
});

export const studyLibraryImportPayloadSchema = z.object({
  importKey: nonEmptyString,
  reports: z.array(studyLibraryImportReportSchema).min(1).max(100),
});

export const studyLibraryImportDryRunResultSchema = z.object({
  previewHash: nonEmptyString,
  historyVersion: z.number().int().nonnegative(),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  warnings: z.array(z.string()),
});

export const studyLibraryApiErrorSchema = z.object({
  error: z.object({
    code: nonEmptyString,
    message: z.string(),
    requestId: nonEmptyString,
  }),
});

export const studyLibrarySourcePutPayloadSchema = z.object({
  title: nonEmptyString,
  category: readingCategorySchema,
  url: nullableHttpsUrl,
  feedUrl: nullableHttpsUrl,
  adapter: readingSourceAdapterIdSchema,
  enabled: z.boolean(),
  expectedVersion: z.number().int().nonnegative(),
});

export function toReadingCandidate(candidate: StudyLibraryCandidate): ReadingCandidate {
  return {
    id: candidate.contentKey,
    contentKey: candidate.contentKey,
    canonicalUrl: candidate.canonicalUrl,
    sourceKey: candidate.sourceKey,
    sourceName: candidate.sourceName,
    category: candidate.category,
    title: candidate.title,
    url: candidate.url,
    published: candidate.published,
    excerpt: candidate.excerpt,
    kind: candidate.kind,
    previouslyRecommended: candidate.previouslyRecommended,
  };
}

export type StudyLibrarySource = z.infer<typeof studyLibrarySourceSchema>;
export type StudyLibrarySourcesResponse = z.infer<typeof studyLibrarySourcesResponseSchema>;
export type StudyLibrarySourceUpsertResponse = z.infer<typeof studyLibrarySourceUpsertResponseSchema>;
export type StudyLibraryCursorResult = z.infer<typeof studyLibraryCursorResultSchema>;
export type StudyLibraryIngestionResult = z.infer<typeof studyLibraryIngestionResultSchema>;
export type StudyLibraryCandidate = z.infer<typeof studyLibraryCandidateSchema>;
export type StudyLibraryCandidatePage = z.infer<typeof studyLibraryCandidatePageSchema>;
export type StudyLibraryRecommendationRunResult = z.infer<typeof studyLibraryRecommendationRunResultSchema>;
export type StudyLibraryPublicationResult = z.infer<typeof studyLibraryPublicationResultSchema>;
export type StudyLibraryImportItem = z.infer<typeof studyLibraryImportItemSchema>;
export type StudyLibraryImportTopic = z.infer<typeof studyLibraryImportTopicSchema>;
export type StudyLibraryImportReport = z.infer<typeof studyLibraryImportReportSchema>;
export type StudyLibraryImportPayload = z.infer<typeof studyLibraryImportPayloadSchema>;
export type StudyLibraryImportDryRunResult = z.infer<typeof studyLibraryImportDryRunResultSchema>;
export type StudyLibraryApiError = z.infer<typeof studyLibraryApiErrorSchema>;
export type StudyLibrarySourcePutPayload = z.infer<typeof studyLibrarySourcePutPayloadSchema>;
