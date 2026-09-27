import { Injectable } from "@nestjs/common";

import { ApiError } from "../common/api-error.js";
import { InterviewRepository } from "./repository/interview.repository.js";
import { seoulDate } from "./review-schedule.js";
import type {
  AttemptBody,
  InterviewQuestion,
  PersonalQuestionBody,
  TopicProgress,
} from "./schema.js";

@Injectable()
export class InterviewClock {
  now(): Date {
    return new Date();
  }
}

@Injectable()
export class InterviewService {
  constructor(
    private readonly repository: InterviewRepository,
    private readonly clock: InterviewClock,
  ) {}

  async listProgress(drillType: TopicProgress["drillType"]): Promise<{ items: TopicProgress[] }> {
    return { items: await this.repository.listProgress(drillType, this.repository.reader()) };
  }

  async createAttempt(idempotencyKey: string, input: AttemptBody) {
    if (idempotencyKey !== input.attemptId) {
      throw new ApiError(400, "BAD_REQUEST", "Idempotency-Key와 attemptId가 같아야 합니다.");
    }
    const evaluatedOn = seoulDate(this.clock.now());
    const progress = await this.repository.recordAttempt(input, evaluatedOn);
    return { attemptId: input.attemptId, evaluatedOn, progress };
  }

  async listEnabledPersonalQuestions(drillType: TopicProgress["drillType"]): Promise<{ items: InterviewQuestion[] }> {
    return { items: await this.repository.listEnabledPersonalQuestions(drillType, this.repository.reader()) };
  }

  async upsertPersonalQuestion(questionId: string, input: PersonalQuestionBody) {
    if (questionId !== input.question.id) {
      throw new ApiError(400, "BAD_REQUEST", "경로 questionId와 question.id가 같아야 합니다.");
    }
    return this.repository.upsertPersonalQuestion(questionId, input.drillType, input.enabled, input.question);
  }
}
