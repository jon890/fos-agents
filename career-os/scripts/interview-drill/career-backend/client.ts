import { createHash } from "node:crypto";
import {
  attemptResponseSchema,
  personalQuestionUpsertResponseSchema,
  personalQuestionsResponseSchema,
  progressResponseSchema,
  type AttemptBody,
  type InterviewQuestion,
  type PersonalQuestionBody,
  type TopicProgress,
} from "../../../services/career-backend/src/interview/schema.ts";
import {
  careerBackendRequest,
  type CareerBackendHttpOptions,
} from "../../lib/career-backend-http.ts";
import type { DrillType } from "../drill-engine.ts";
import type { AttemptResponse, PersonalQuestionUpsertResponse } from "../store/port.ts";

export class InterviewBackendClient {
  constructor(private readonly options: CareerBackendHttpOptions) {}

  async listProgress(drillType: DrillType): Promise<TopicProgress[]> {
    const response = await careerBackendRequest(
      this.options,
      "GET",
      `/api/interview/v1/progress?drillType=${encodeURIComponent(drillType)}`,
      undefined,
      undefined,
      progressResponseSchema,
    );
    return response.items;
  }

  recordAttempt(body: AttemptBody): Promise<AttemptResponse> {
    return careerBackendRequest(
      this.options,
      "POST",
      "/api/interview/v1/attempts",
      body,
      body.attemptId,
      attemptResponseSchema,
    );
  }

  async listPersonalQuestions(drillType: DrillType): Promise<InterviewQuestion[]> {
    const response = await careerBackendRequest(
      this.options,
      "GET",
      `/api/interview/v1/personal-questions?drillType=${encodeURIComponent(drillType)}`,
      undefined,
      undefined,
      personalQuestionsResponseSchema,
    );
    return response.items;
  }

  upsertPersonalQuestion(
    questionId: string,
    body: PersonalQuestionBody,
  ): Promise<PersonalQuestionUpsertResponse> {
    const hash = createHash("sha256").update(JSON.stringify(body), "utf8").digest("hex");
    return careerBackendRequest(
      this.options,
      "PUT",
      `/api/interview/v1/personal-questions/${encodeURIComponent(questionId)}`,
      body,
      `personal-question:${hash}`,
      personalQuestionUpsertResponseSchema,
    );
  }
}
