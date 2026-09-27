import { randomUUID } from "node:crypto";
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
    // Backend 는 완료된 멱등 기록을 지우지 않는다. 본문으로 키를 만들면 끈 뒤 같은 본문으로
    // 다시 켜는 요청이 첫 응답의 재생으로 끝나 DB 가 바뀌지 않는다. 그래서 호출마다 새 키를 쓰고,
    // 네트워크 재시도는 careerBackendRequest 가 같은 키로 한다.
    const idempotencyKey = `personal-question:${randomUUID()}`;
    return careerBackendRequest(
      this.options,
      "PUT",
      `/api/interview/v1/personal-questions/${encodeURIComponent(questionId)}`,
      body,
      idempotencyKey,
      personalQuestionUpsertResponseSchema,
    );
  }
}
