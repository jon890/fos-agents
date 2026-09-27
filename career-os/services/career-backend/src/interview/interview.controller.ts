import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query } from "@nestjs/common";

import { toContractError, ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { InterviewService } from "./interview.service.js";
import {
  attemptBodySchema,
  personalQuestionBodySchema,
  progressQuerySchema,
  type AttemptBody,
  type PersonalQuestionBody,
  type TopicProgress,
} from "./schema.js";

@Controller("api/interview/v1")
export class InterviewController {
  constructor(private readonly interview: InterviewService) {}

  @Get("progress")
  getProgress(@Query("drillType") drillType: string): Promise<{ items: TopicProgress[] }> {
    try {
      return this.interview.listProgress(progressQuerySchema.parse({ drillType }).drillType);
    } catch (error) {
      return toContractError(error);
    }
  }

  @Post("attempts")
  @HttpCode(201)
  createAttempt(
    @Headers("idempotency-key") idempotencyKey: string,
    @Body(new ZodValidationPipe(attemptBodySchema)) body: AttemptBody,
  ) {
    return this.interview.createAttempt(idempotencyKey, body);
  }

  @Get("personal-questions")
  getPersonalQuestions(@Query("drillType") drillType: string) {
    try {
      return this.interview.listEnabledPersonalQuestions(progressQuerySchema.parse({ drillType }).drillType);
    } catch (error) {
      return toContractError(error);
    }
  }

  @Put("personal-questions/:questionId")
  @HttpCode(200)
  upsertPersonalQuestion(
    @Param("questionId") questionId: string,
    @Body(new ZodValidationPipe(personalQuestionBodySchema)) body: PersonalQuestionBody,
  ) {
    return this.interview.upsertPersonalQuestion(questionId, body);
  }
}
