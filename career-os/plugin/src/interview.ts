import { randomUUID } from "node:crypto";
import { z } from "zod";
import aiPlatform from "../../public/question-bank/ai-platform/questions.json" with { type: "json" };
import behavioral from "../../public/question-bank/behavioral/questions.json" with { type: "json" };
import cs from "../../public/question-bank/cs/questions.json" with { type: "json" };
import database from "../../public/question-bank/database/questions.json" with { type: "json" };
import javaSpring from "../../public/question-bank/java-spring/questions.json" with { type: "json" };
import operations from "../../public/question-bank/operations/questions.json" with { type: "json" };
import systemDesign from "../../public/question-bank/system-design/questions.json" with { type: "json" };
import { INTERVIEW_BARS } from "../../scripts/interview-drill/follow-up-policy.ts";
import {
  dueForReview,
  selectFromBank,
  toDrillProgress,
  type DrillProgress,
  type SelectableQuestion,
} from "../../scripts/interview-drill/question-selection.ts";
import { CareerBackend, CareerError } from "./backend.ts";
import { seoulDate } from "./seoul-date.ts";

// The public bank is bundled so the connector never reads files. The order matches the CLI's
// TECH_CATEGORIES (scripts/interview-drill/drill-engine.ts) so both pick the same questions on the
// same day; contract-parity.test.ts compares the id lists. The bank files are validated by
// scripts/question-bank-collector/validate.ts, so they are not parsed again at runtime.
export const publicTechQuestions = [
  ...javaSpring,
  ...database,
  ...cs,
  ...operations,
  ...systemDesign,
  ...aiPlatform,
] as unknown as SelectableQuestion[];
export const publicBehavioralQuestions = behavioral as unknown as SelectableQuestion[];

// Field names, length limits, and enum values are the Backend's (services/career-backend/src/interview/schema.ts).
// They are rewritten here because the bundle must not carry Backend code; contract-parity.test.ts compares the keys.
const nonEmpty = z.string().trim().min(1);
const drillTypeSchema = z.enum(["tech", "behavioral"]);

export const interviewQuestionSchema = z.strictObject({
  id: nonEmpty.max(100),
  topic: nonEmpty.max(100),
  category: nonEmpty.max(100),
  difficulty: z.enum(["basic", "intermediate", "advanced"]),
  question: nonEmpty.max(2_000),
  intent: nonEmpty.max(2_000),
  answerSignals: z.array(nonEmpty).min(1),
  bar: z.enum(INTERVIEW_BARS).optional(),
  followUps: z.array(nonEmpty).optional(),
  positionFitHint: nonEmpty.max(2_000).optional(),
  tags: z.array(nonEmpty).optional(),
  sequenceHint: z.enum(["opening", "early", "middle", "late", "closing"]).optional(),
});

// Same as the Backend's attemptBodySchema except attemptId: the agent has no shell to make a UUID.
export const attemptInputSchema = z.strictObject({
  attemptId: z.uuid().optional(),
  drillType: drillTypeSchema,
  questionId: nonEmpty.max(100),
  topic: nonEmpty.max(100),
  question: nonEmpty.max(2_000),
  score: z.enum(["pass", "shallow", "fail", "unknown"]),
  feedback: nonEmpty.max(500).optional(),
  targetCompany: nonEmpty.max(100).optional(),
  targetRole: nonEmpty.max(100).optional(),
  targetValueAxis: nonEmpty.max(100).optional(),
  rootQuestionId: nonEmpty.max(100).optional(),
  parentQuestion: nonEmpty.max(2_000).optional(),
  followUpDepth: z.number().int().min(1).max(4).optional(),
  followUpAxis: z.enum(["clarification", "decision", "counterexample", "operations", "evidence-boundary"]).optional(),
  stopReason: z.enum(["depth-limit", "needs-study", "answer-complete", "session-ended"]).optional(),
});

export const personalQuestionInputSchema = z.strictObject({
  drillType: drillTypeSchema,
  enabled: z.boolean(),
  question: interviewQuestionSchema,
});

export const getInterviewQuestionsSchema = z.strictObject({
  drillType: drillTypeSchema,
  targetBar: z.enum(INTERVIEW_BARS).optional(),
  count: z.number().int().min(1).max(10).optional(),
});

export const listPersonalQuestionsSchema = z.strictObject({ drillType: drillTypeSchema });

const topicProgress = z.object({
  drillType: drillTypeSchema,
  topic: z.string(),
  passCount: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  nextReviewDate: z.string().nullable(),
  lastPassedDate: z.string().nullable(),
});
const progressResponse = z.object({ items: z.array(topicProgress) });
const personalQuestionsResponse = z.object({ items: z.array(interviewQuestionSchema) });
const attemptResponse = z.object({ attemptId: z.uuid(), evaluatedOn: z.string(), progress: topicProgress });
const personalQuestionUpsertResponse = z.object({
  questionId: z.string(),
  drillType: drillTypeSchema,
  topic: z.string(),
  enabled: z.boolean(),
  updatedAt: z.string(),
});

export type GetInterviewQuestionsArgs = z.infer<typeof getInterviewQuestionsSchema>;
export type ListPersonalQuestionsArgs = z.infer<typeof listPersonalQuestionsSchema>;
export type AttemptInput = z.infer<typeof attemptInputSchema>;
export type PersonalQuestionInput = z.infer<typeof personalQuestionInputSchema>;

// The bank carries bookkeeping fields (normalizedFrom, publicSafe, source); results carry only these.
const resultKeys = [
  "id",
  "topic",
  "category",
  "difficulty",
  "question",
  "intent",
  "answerSignals",
  "bar",
  "followUps",
  "positionFitHint",
  "tags",
  "sequenceHint",
] as const;

function resultQuestion(question: SelectableQuestion, progress: DrillProgress, today: string) {
  const picked: Record<string, unknown> = {};
  for (const key of resultKeys) if (question[key] !== undefined) picked[key] = question[key];
  return {
    ...picked,
    sourceScope: question.sourceScope,
    dueForReview: dueForReview(progress, question.topic, today),
  };
}

const drillQuery = (drillType: string) => `drillType=${encodeURIComponent(drillType)}`;

export async function getInterviewQuestions(
  backend: CareerBackend,
  args: GetInterviewQuestionsArgs,
  now: () => Date,
) {
  const { drillType, targetBar, count } = args;
  const [progress, personal] = await Promise.all([
    backend.request("GET", `/api/interview/v1/progress?${drillQuery(drillType)}`, progressResponse),
    backend.request("GET", `/api/interview/v1/personal-questions?${drillQuery(drillType)}`, personalQuestionsResponse),
  ]);
  const today = seoulDate(now());
  const drillProgress = toDrillProgress(progress.items);
  // Same order as the CLI's loadQuestionBank: public questions, then personal ones.
  const bank: SelectableQuestion[] = [
    ...(drillType === "tech" ? publicTechQuestions : publicBehavioralQuestions).map((question) => ({
      ...question,
      sourceScope: "public" as const,
    })),
    ...personal.items.map((question) => ({ ...question, sourceScope: "personal" as const })),
  ];
  const selected = selectFromBank(bank, drillProgress, { today, maxCount: count ?? 5, target: targetBar });
  return {
    drillType,
    today,
    questions: selected.map((question) => resultQuestion(question, drillProgress, today)),
  };
}

export function listPersonalQuestions(backend: CareerBackend, args: ListPersonalQuestionsArgs) {
  return backend.request(
    "GET",
    `/api/interview/v1/personal-questions?${drillQuery(args.drillType)}`,
    personalQuestionsResponse,
  );
}

// Sent once with attemptId as the Idempotency-Key. When the outcome is unknown the error carries
// that attemptId, so a resend with it replays the Backend's stored response instead of recording twice.
export async function saveInterviewAttempt(backend: CareerBackend, args: AttemptInput) {
  const attemptId = args.attemptId ?? randomUUID();
  try {
    return await backend.request(
      "POST",
      "/api/interview/v1/attempts",
      attemptResponse,
      { ...args, attemptId },
      attemptId,
    );
  } catch (error) {
    if (error instanceof CareerError && error.code === "CAREER_NETWORK")
      throw new CareerError("CAREER_NETWORK", { attemptId });
    // Attempts carry no version, so a 409 comes from the Idempotency-Key: the request with this
    // attemptId is still being processed. A later resend with the same arguments gets the stored
    // response. The other 409, the same key with another body, cannot happen while the arguments stay the same.
    if (error instanceof CareerError && error.code === "CAREER_VERSION_CONFLICT")
      throw new CareerError("CAREER_ATTEMPT_PENDING", { attemptId });
    throw error;
  }
}

// A new key per call, like the CLI (InterviewBackendClient.upsertPersonalQuestion): a key made from
// the body would turn re-enabling a disabled question with the same body into a replay of the first answer.
export function savePersonalQuestion(backend: CareerBackend, args: PersonalQuestionInput) {
  const { drillType, enabled, question } = args;
  return backend.request(
    "PUT",
    `/api/interview/v1/personal-questions/${encodeURIComponent(question.id)}`,
    personalQuestionUpsertResponse,
    { enabled, drillType, question },
    `personal-question:${randomUUID()}`,
  );
}
