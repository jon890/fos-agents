import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";

import { toContractError, ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { StudyService } from "./study.service.js";
import {
  cursorModeSchema,
  sourceKeySchema,
  studyCandidatesQuerySchema,
  studyIngestionSchema,
  studyPublicationSchema,
  studyRecommendationControlSchema,
  studyRecommendationRunSchema,
  studySourcePutSchema,
  type StudyCandidatePage,
  type StudyCandidatesQuery,
  type StudyCursorResult,
  type StudyIngestion,
  type StudyIngestionResult,
  type StudyPublication,
  type StudyPublicationResult,
  type StudyRecommendationControl,
  type StudyRecommendationRun,
  type StudyRecommendationRunResult,
  type StudySourcePut,
  type StudySourceUpsertResponse,
} from "./schema.js";

@Controller("api/study/v1")
export class StudyController {
  constructor(private readonly study: StudyService) {}

  @Get("sources")
  listSources() {
    return this.study.listSources();
  }

  @Put("sources/:sourceKey")
  @HttpCode(200)
  upsertSource(
    @Param("sourceKey") sourceKey: string,
    @Body(new ZodValidationPipe(studySourcePutSchema)) body: StudySourcePut,
  ): Promise<StudySourceUpsertResponse> {
    return this.study.upsertSource(this.sourceKey(sourceKey), body);
  }

  @Get("sources/:sourceKey/cursor")
  getCursor(
    @Param("sourceKey") sourceKey: string,
    @Query("mode") mode: string,
  ): Promise<StudyCursorResult> {
    try {
      return this.study.getCursor(this.sourceKey(sourceKey), cursorModeSchema.parse(mode));
    } catch (error) {
      return toContractError(error);
    }
  }

  @Post("ingestions")
  @HttpCode(201)
  createIngestion(
    @Body(new ZodValidationPipe(studyIngestionSchema)) body: StudyIngestion,
  ): Promise<StudyIngestionResult> {
    return this.study.createIngestion(body);
  }

  @Get("candidates")
  getCandidates(
    @Query(new ZodValidationPipe(studyCandidatesQuerySchema)) query: StudyCandidatesQuery,
  ): Promise<StudyCandidatePage> {
    return this.study.getCandidates(query);
  }

  @Post("recommendation-runs")
  @HttpCode(201)
  createRecommendationRun(
    @Body(new ZodValidationPipe(studyRecommendationRunSchema)) body: StudyRecommendationRun,
  ): Promise<StudyRecommendationRunResult> {
    return this.study.createRecommendationRun(body);
  }

  @Get("recommendation-runs/:reportId/status")
  getRecommendationRunStatus(@Param("reportId") reportId: string): Promise<{ reportId: string; exists: boolean }> {
    return this.study.getRecommendationRunStatus(this.reportId(reportId));
  }

  @Post("publications")
  @HttpCode(201)
  createPublication(
    @Body(new ZodValidationPipe(studyPublicationSchema)) body: StudyPublication,
  ): Promise<StudyPublicationResult> {
    return this.study.createPublication(body);
  }

  @Put("recommendation-control")
  @HttpCode(200)
  updateRecommendationControl(
    @Body(new ZodValidationPipe(studyRecommendationControlSchema)) body: StudyRecommendationControl,
  ): Promise<StudyRecommendationControl> {
    return this.study.updateRecommendationControl(body);
  }

  private sourceKey(value: string): string {
    try {
      return sourceKeySchema.parse(value);
    } catch (error) {
      return toContractError(error);
    }
  }

  private reportId(value: string): string {
    try {
      return sourceKeySchema.max(40).parse(value);
    } catch (error) {
      return toContractError(error);
    }
  }
}
