import { z } from "zod";

export const INTERVIEW_SOURCE_ADAPTERS = ["feed", "page", "youtube", "static"] as const;
export const INTERVIEW_SOURCE_CLASSES = [
  "official-reference",
  "engineering-practice",
  "conference-talk",
  "open-source-guide",
] as const;
export const INTERVIEW_SOURCE_USAGES = [
  "answer-authority",
  "scenario-discovery",
  "coverage-map",
] as const;
export const INTERVIEW_TOPICS = [
  "java-spring",
  "database",
  "cs",
  "operations",
  "system-design",
  "ai-platform",
  "behavioral",
] as const;

const nonEmptyString = z.string().trim().min(1);
const httpsUrl = z.url().refine((value) => value.startsWith("https://"), {
  message: "HTTPS URL이어야 한다.",
});

export const interviewQuestionSourceSchema = z.object({
  key: nonEmptyString.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: nonEmptyString,
  sourceClass: z.enum(INTERVIEW_SOURCE_CLASSES),
  usages: z.array(z.enum(INTERVIEW_SOURCE_USAGES)).min(1),
  topics: z.array(z.enum(INTERVIEW_TOPICS)).min(1),
  url: httpsUrl,
  feedUrl: httpsUrl.optional(),
  adapter: z.enum(INTERVIEW_SOURCE_ADAPTERS),
  enabled: z.boolean().optional(),
}).superRefine((source, context) => {
  if (source.adapter === "feed" && !source.feedUrl) {
    context.addIssue({
      code: "custom",
      path: ["feedUrl"],
      message: "feed 어댑터에는 feedUrl이 필요하다.",
    });
  }
  if (source.adapter === "youtube" && !new URL(source.url).hostname.endsWith("youtube.com")) {
    context.addIssue({
      code: "custom",
      path: ["url"],
      message: "youtube 어댑터에는 YouTube 채널 URL이 필요하다.",
    });
  }
  if (source.usages.includes("answer-authority") && source.sourceClass !== "official-reference") {
    context.addIssue({
      code: "custom",
      path: ["usages"],
      message: "답변의 정답 근거는 official-reference만 맡을 수 있다.",
    });
  }
  if (source.sourceClass === "open-source-guide" && source.adapter !== "static") {
    context.addIssue({
      code: "custom",
      path: ["adapter"],
      message: "오픈소스 면접 가이드는 고정 출처로만 등록한다.",
    });
  }
});

export const interviewQuestionSourcesConfigSchema = z.object({
  _meta: z.object({
    purpose: nonEmptyString,
    schemaVersion: z.literal(1),
  }),
  sources: z.array(interviewQuestionSourceSchema).min(1),
}).superRefine((config, context) => {
  const keys = new Set<string>();
  config.sources.forEach((source, index) => {
    if (keys.has(source.key)) {
      context.addIssue({
        code: "custom",
        path: ["sources", index, "key"],
        message: `중복 key: ${source.key}`,
      });
    }
    keys.add(source.key);
  });
});

export const interviewSourceCandidateSchema = z.object({
  id: nonEmptyString,
  sourceKey: nonEmptyString,
  sourceTitle: nonEmptyString,
  sourceClass: z.enum(INTERVIEW_SOURCE_CLASSES),
  usages: z.array(z.enum(INTERVIEW_SOURCE_USAGES)).min(1),
  topics: z.array(z.enum(INTERVIEW_TOPICS)).min(1),
  title: nonEmptyString,
  url: httpsUrl,
  published: z.string(),
  excerpt: z.string().optional(),
  kind: z.enum(["article", "video", "source-root"]),
});

export const interviewSourceCandidatePoolSchema = z.object({
  generatedAt: z.iso.datetime(),
  policy: z.object({
    selection: z.literal("llm"),
    discoverySourcesAreAnswerAuthority: z.literal(false),
    maxCandidatesPerSource: z.number().int().positive(),
  }),
  candidates: z.array(interviewSourceCandidateSchema),
  collectionLog: z.array(z.object({
    sourceKey: nonEmptyString,
    status: z.enum(["collected", "source-root", "no-candidates"]),
    candidateCount: z.number().int().nonnegative(),
  })),
}).superRefine((pool, context) => {
  const ids = new Set<string>();
  pool.candidates.forEach((candidate, index) => {
    if (ids.has(candidate.id)) {
      context.addIssue({
        code: "custom",
        path: ["candidates", index, "id"],
        message: `중복 candidate id: ${candidate.id}`,
      });
    }
    ids.add(candidate.id);
  });
});

export type InterviewQuestionSource = z.infer<typeof interviewQuestionSourceSchema>;
export type InterviewQuestionSourcesConfig = z.infer<typeof interviewQuestionSourcesConfigSchema>;
export type InterviewSourceCandidate = z.infer<typeof interviewSourceCandidateSchema>;
export type InterviewSourceCandidatePool = z.infer<typeof interviewSourceCandidatePoolSchema>;

