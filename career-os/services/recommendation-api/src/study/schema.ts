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
