import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const nullableHttpsUrl = z.url().refine((value) => value.startsWith("https://"), {
  message: "HTTPS URL이어야 합니다.",
}).nullable();

export const sourceKeySchema = nonEmpty.max(100);
export const cursorModeSchema = z.enum(["recent", "archive"]);

export const studySourcePutSchema = z.object({
  title: nonEmpty.max(255),
  category: nonEmpty.max(50),
  url: nullableHttpsUrl,
  feedUrl: nullableHttpsUrl,
  adapter: z.enum(["feed", "page", "youtube"]),
  enabled: z.boolean(),
  note: z.string().max(500).nullable().optional(),
  expectedVersion: z.number().int().nonnegative(),
}).strict().superRefine((source, context) => {
  if (!source.url && !source.feedUrl) {
    context.addIssue({ code: "custom", path: ["url"], message: "url 또는 feedUrl 중 하나가 필요합니다." });
  }
  if (source.adapter === "feed" && !source.feedUrl) {
    context.addIssue({ code: "custom", path: ["feedUrl"], message: "feed 어댑터에는 feedUrl이 필요합니다." });
  }
  if (source.adapter === "page" && !source.url) {
    context.addIssue({ code: "custom", path: ["url"], message: "page 어댑터에는 url이 필요합니다." });
  }
  if (source.adapter === "youtube" && (!source.url || !source.feedUrl)) {
    context.addIssue({ code: "custom", path: ["feedUrl"], message: "youtube 어댑터에는 채널 url과 feedUrl이 필요합니다." });
  }
});

export type StudySourcePut = z.infer<typeof studySourcePutSchema>;
export type StudySource = Omit<StudySourcePut, "expectedVersion"> & {
  sourceKey: string;
  note: string | null;
  version: number;
};

export type StudySourceUpsertResponse = { source: StudySource; version: number };
export type StudyCursorResult = {
  sourceKey: string;
  mode: z.infer<typeof cursorModeSchema>;
  cursor: Record<string, unknown> | null;
  version: number;
};

const ingestionItemSchema = z.object({
  contentKey: nonEmpty.max(191),
  canonicalUrl: z.url().refine((value) => value.startsWith("https://"), { message: "HTTPS URL이어야 합니다." }),
  url: z.url().refine((value) => value.startsWith("https://"), { message: "HTTPS URL이어야 합니다." }),
  title: nonEmpty.max(500),
  published: z.string().max(100),
  publishedAt: z.iso.datetime().nullable(),
  excerpt: z.string().max(2_000).nullable(),
  kind: z.enum(["feed-article", "feed-video", "page-link", "page-video"]),
  tags: z.array(z.string()).max(0),
  collectedAt: z.iso.datetime(),
}).strict();

const cursorJsonSchema = z.record(z.string(), z.unknown()).nullable().superRefine((cursor, context) => {
  if (cursor && Buffer.byteLength(JSON.stringify(cursor), "utf8") > 64 * 1024) {
    context.addIssue({ code: "custom", message: "cursor JSON은 64KiB 이하여야 합니다." });
  }
});

export const studyIngestionSchema = z.object({
  sourceKey: sourceKeySchema,
  mode: cursorModeSchema,
  items: z.array(ingestionItemSchema).max(100),
  cursor: cursorJsonSchema,
  expectedCursorVersion: z.number().int().nonnegative(),
  idempotencyKey: nonEmpty.max(200),
}).strict().superRefine((value, context) => {
  const seen = new Set<string>();
  for (const [index, item] of value.items.entries()) {
    if (seen.has(item.contentKey)) {
      context.addIssue({ code: "custom", path: ["items", index, "contentKey"], message: "같은 배치에 중복 contentKey가 있습니다." });
    }
    seen.add(item.contentKey);
  }
});

export const studyCandidatesQuerySchema = z.object({
  sourceKey: sourceKeySchema.optional(),
  category: z.enum(["techBlog", "geek", "ai", "video"]).optional(),
  publishedFrom: z.iso.datetime().optional(),
  publishedTo: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: nonEmpty.optional(),
}).strict();

export type StudyIngestion = z.infer<typeof studyIngestionSchema>;
export type StudyCandidatesQuery = z.infer<typeof studyCandidatesQuerySchema>;
export type StudyIngestionResult = { idempotencyKey: string; acceptedCount: number; cursorVersion: number };
export type StudyCandidatePage = {
  candidates: Array<{
    id: string;
    contentKey: string;
    canonicalUrl: string;
    sourceKey: string;
    sourceName: string;
    category: "techBlog" | "geek" | "ai" | "video";
    title: string;
    url: string;
    published: string;
    excerpt?: string;
    kind: "feed-article" | "feed-video" | "page-link" | "page-video";
    previouslyRecommended: false;
  }>;
  recentStudyTopicKeys: string[];
  nextCursor: string | null;
  historyVersion: number;
  candidateContextVersion: string;
};
