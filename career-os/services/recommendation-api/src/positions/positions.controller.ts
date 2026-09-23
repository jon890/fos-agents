import { Body, Controller, Get, HttpCode, Param, Post, Put } from "@nestjs/common";

import { ApiError } from "../common/api-error.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PositionsService } from "./positions.service.js";
import {
  analysisPolicySchema,
  analysisResultsRequestSchema,
  collectionRequestSchema,
  companyPreferenceUpdateSchema,
  companyTierResultsRequestSchema,
  exclusionsRequestSchema,
  type AnalysisPolicy,
  type AnalysisQueueResponse,
  type AnalysisResultsRequest,
  type AnalysisResultsResponse,
  type CollectionRequest,
  type CompanyPreference,
  type CompanyTierResultsRequest,
  type CompanyTierResultsResponse,
  type ExclusionsRequest,
  type PositionExclusion,
  type PositionPreparationResponse,
  type RecommendationResponse,
} from "./schema.js";

/**
 * 포지션 도메인의 모든 경로다.
 *
 * 쓰기 경로에는 공통 멱등 interceptor 가 걸린다. 본문 검증은 계약 schema 를 그대로 쓴다.
 */
@Controller("api/positions/v1")
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  @Put("analysis-policy")
  @HttpCode(200)
  configurePolicy(
    @Body(new ZodValidationPipe(analysisPolicySchema)) body: AnalysisPolicy,
  ): Promise<AnalysisPolicy> {
    return this.positions.configurePolicy(body);
  }

  @Get("company-preferences")
  listCompanyPreferences(): Promise<CompanyPreference[]> {
    return this.positions.listCompanyPreferences();
  }

  @Put("company-preferences/:companyKey")
  @HttpCode(200)
  updateCompanyPreference(
    @Param("companyKey") companyKey: string,
    @Body(new ZodValidationPipe(companyPreferenceUpdateSchema))
    body: Omit<CompanyPreference, "updatedAt">,
  ): Promise<CompanyPreference> {
    return this.positions.updateCompanyPreference(companyKey, body);
  }

  @Get("exclusions")
  listExclusions(): Promise<PositionExclusion[]> {
    return this.positions.listExclusions();
  }

  /** 제외 규칙 전체를 받은 배열로 바꾸고 바뀐 뒤의 목록을 돌려준다. */
  @Put("exclusions")
  @HttpCode(200)
  replaceExclusions(
    @Body(new ZodValidationPipe(exclusionsRequestSchema)) body: ExclusionsRequest,
  ): Promise<PositionExclusion[]> {
    return this.positions.replaceExclusions(body);
  }

  @Post("collection-runs")
  @HttpCode(201)
  saveCollection(
    @Body(new ZodValidationPipe(collectionRequestSchema)) body: CollectionRequest,
  ): Promise<PositionPreparationResponse> {
    return this.positions.saveCollection(body);
  }

  @Post("collection-runs/:collectionRunId/analysis-runs")
  @HttpCode(201)
  createAnalysisRun(
    @Param("collectionRunId") collectionRunId: string,
  ): Promise<AnalysisQueueResponse> {
    return this.positions.createPositionAnalysisRun(collectionRunId);
  }

  @Post("analysis-runs/:analysisRunId/results")
  @HttpCode(200)
  saveAnalysisResults(
    @Param("analysisRunId") analysisRunId: string,
    @Body(new ZodValidationPipe(analysisResultsRequestSchema)) body: AnalysisResultsRequest,
  ): Promise<AnalysisResultsResponse> {
    return this.positions.saveAnalysisResults(analysisRunId, body);
  }

  @Post("company-tier-runs/:companyTierRunId/results")
  @HttpCode(200)
  saveCompanyTierResults(
    @Param("companyTierRunId") companyTierRunId: string,
    @Body(new ZodValidationPipe(companyTierResultsRequestSchema)) body: CompanyTierResultsRequest,
  ): Promise<CompanyTierResultsResponse> {
    return this.positions.saveCompanyTierResults(companyTierRunId, body);
  }

  /**
   * 추천 실행을 만든다.
   *
   * 본문에서 읽는 것은 `analysisRunId` 하나다.
   * 계약이 나머지 필드를 정하지 않으므로 schema 로 본문 전체를 막지 않는다.
   */
  @Post("recommendation-runs")
  @HttpCode(201)
  createRecommendation(@Body() body: { analysisRunId?: unknown }): Promise<RecommendationResponse> {
    if (typeof body?.analysisRunId !== "string") {
      throw new ApiError(400, "BAD_REQUEST", "analysisRunId가 필요합니다.");
    }
    return this.positions.createRecommendation(body.analysisRunId);
  }

  /** 수집 실행과 공고 분석 실행과 추천 실행을 같은 경로로 조회한다. */
  @Get("runs/:runId")
  getRun(@Param("runId") runId: string): Promise<AnalysisQueueResponse | RecommendationResponse> {
    return this.positions.getRun(runId);
  }
}
