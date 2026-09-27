import type {
  AttemptBody,
  InterviewQuestion,
  PersonalQuestionBody,
  TopicProgress,
} from "../../../services/career-backend/src/interview/schema.ts";
import {
  attemptResponseSchema,
  personalQuestionUpsertResponseSchema,
} from "../../../services/career-backend/src/interview/schema.ts";
import { z } from "zod";
import type { DrillType } from "../drill-engine.ts";

export type AttemptResponse = z.infer<typeof attemptResponseSchema>;
export type PersonalQuestionUpsertResponse = z.infer<typeof personalQuestionUpsertResponseSchema>;
export type PersonalQuestionRecord = {
  questionId: string;
  drillType: DrillType;
  enabled: boolean;
  question: InterviewQuestion;
};

export interface InterviewPracticeStore {
  readonly kind: "backend" | "file";
  listProgress(drillType: DrillType): Promise<TopicProgress[]>;
  recordAttempt(body: AttemptBody): Promise<AttemptResponse>;
  listPersonalQuestions(
    drillType: DrillType,
    options?: { includeDisabled?: boolean },
  ): Promise<PersonalQuestionRecord[]>;
  upsertPersonalQuestion(
    questionId: string,
    body: PersonalQuestionBody,
  ): Promise<PersonalQuestionUpsertResponse>;
}
