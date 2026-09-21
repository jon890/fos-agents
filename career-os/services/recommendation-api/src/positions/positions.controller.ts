import { Body, Controller, Get, HttpCode, Param, Post, Put } from "@nestjs/common";

import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PositionsService } from "./positions.service.js";
import {
  analysisPolicySchema,
  analysisResultsRequestSchema,
  collectionRequestSchema,
  companyPreferenceUpdateSchema,
  companyTierResultsRequestSchema,
  type AnalysisPolicy,
  type AnalysisQueueResponse,
  type AnalysisResultsRequest,
  type AnalysisResultsResponse,
  type CollectionRequest,
  type CompanyPreference,
  type CompanyTierResultsRequest,
  type CompanyTierResultsResponse,
  type PositionPreparationResponse,
} from "./schema.js";

/**
 * 분석 정책과 회사 선호와 수집 실행의 경로다.
 *
 * 쓰기 넷에는 공통 멱등 interceptor 가 걸린다. 본문 검증은 계약 schema 를 그대로 쓴다.
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
}
