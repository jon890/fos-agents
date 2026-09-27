import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const interviewDrillTypeSchema = z.enum(["tech", "behavioral"]);
export const interviewScoreSchema = z.enum(["pass", "shallow", "fail", "unknown"]);

export const interviewQuestionSchema = z.object({
  id: nonEmpty.max(100),
  topic: nonEmpty.max(100),
  category: nonEmpty.max(100),
  difficulty: z.enum(["basic", "intermediate", "advanced"]),
  question: nonEmpty.max(2_000),
  intent: nonEmpty.max(2_000),
  answerSignals: z.array(nonEmpty).min(1),
  bar: z.enum(["production", "large-scale", "global-scale"]).optional(),
  followUps: z.array(nonEmpty).optional(),
  positionFitHint: nonEmpty.max(2_000).optional(),
  tags: z.array(nonEmpty).optional(),
  sequenceHint: z.enum(["opening", "early", "middle", "late", "closing"]).optional(),
}).strict();

export const progressQuerySchema = z.object({ drillType: interviewDrillTypeSchema }).strict();

export const attemptBodySchema = z.object({
  attemptId: z.uuid(),
  drillType: interviewDrillTypeSchema,
  questionId: nonEmpty.max(100),
  topic: nonEmpty.max(100),
  question: nonEmpty.max(2_000),
  score: interviewScoreSchema,
  feedback: nonEmpty.max(500).optional(),
  targetCompany: nonEmpty.max(100).optional(),
  targetRole: nonEmpty.max(100).optional(),
  targetValueAxis: nonEmpty.max(100).optional(),
  rootQuestionId: nonEmpty.max(100).optional(),
  parentQuestion: nonEmpty.max(2_000).optional(),
  followUpDepth: z.number().int().min(1).max(4).optional(),
  followUpAxis: z.enum(["clarification", "decision", "counterexample", "operations", "evidence-boundary"]).optional(),
  stopReason: z.enum(["depth-limit", "needs-study", "answer-complete", "session-ended"]).optional(),
}).strict();

export const personalQuestionBodySchema = z.object({
  enabled: z.boolean(),
  drillType: interviewDrillTypeSchema,
  question: interviewQuestionSchema,
}).strict();

export const topicProgressSchema = z.object({
  drillType: interviewDrillTypeSchema,
  topic: z.string(),
  passCount: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  nextReviewDate: z.string().nullable(),
  lastPassedDate: z.string().nullable(),
});

export const progressResponseSchema = z.object({ items: z.array(topicProgressSchema) });
export const attemptResponseSchema = z.object({
  attemptId: z.uuid(),
  evaluatedOn: z.string(),
  progress: topicProgressSchema,
});
export const personalQuestionsResponseSchema = z.object({ items: z.array(interviewQuestionSchema) });
export const personalQuestionUpsertResponseSchema = z.object({
  questionId: z.string(),
  drillType: interviewDrillTypeSchema,
  topic: z.string(),
  enabled: z.boolean(),
  updatedAt: z.string(),
});

export type AttemptBody = z.infer<typeof attemptBodySchema>;
export type PersonalQuestionBody = z.infer<typeof personalQuestionBodySchema>;
export type TopicProgress = z.infer<typeof topicProgressSchema>;
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;
