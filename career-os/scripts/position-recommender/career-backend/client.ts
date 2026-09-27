import { z } from "zod";
import { resolveCareerBackendConnection } from "../../lib/career-backend-config.ts";
import {
  careerBackendRequest,
  type CareerBackendHttpOptions,
} from "../../lib/career-backend-http.ts";
import {
  analysisPolicySchema,
  analysisQueueResponseSchema,
  analysisResultsResponseSchema,
  companyEvidenceSaveResponseSchema,
  storedCompanyEvidenceSchema,
  companyActivePostingSchema,
  companyPreferenceSchema,
  companyTierResultsResponseSchema,
  positionExclusionSchema,
  positionPreparationResponseSchema,
  recommendationResponseSchema,
  type AnalysisQueueResponse,
  type AnalysisResultsResponse,
  type StoredCompanyEvidence,
  type CompanyActivePosting,
  type CompanyEvidenceSaveResponse,
  type CompanyPreference,
  type CompanyTierResultsResponse,
  type PositionExclusion,
  type PositionPreparationResponse,
  type RecommendationResponse,
} from "../../../services/career-backend/src/positions/schema.ts";

export type CareerBackendClientOptions = CareerBackendHttpOptions;

export class CareerBackendClient {
  private readonly httpOptions: CareerBackendHttpOptions;

  constructor(options: CareerBackendClientOptions) {
    this.httpOptions = { ...options, timeoutMs: options.timeoutMs ?? 15_000 };
  }

  saveCollection(body: unknown, idempotencyKey: string): Promise<PositionPreparationResponse> {
    return careerBackendRequest(this.httpOptions,
      "POST",
      "/api/positions/v1/collection-runs",
      body,
      idempotencyKey,
      positionPreparationResponseSchema,
    );
  }

  createPositionAnalysisRun(
    collectionRunId: string,
    idempotencyKey: string,
  ): Promise<AnalysisQueueResponse> {
    return careerBackendRequest(this.httpOptions,
      "POST",
      `/api/positions/v1/collection-runs/${encodeURIComponent(collectionRunId)}/analysis-runs`,
      { schemaVersion: 1 },
      idempotencyKey,
      analysisQueueResponseSchema,
    );
  }

  saveCompanyTierResults(
    companyTierRunId: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<CompanyTierResultsResponse> {
    return careerBackendRequest(this.httpOptions,
      "POST",
      `/api/positions/v1/company-tier-runs/${encodeURIComponent(companyTierRunId)}/results`,
      body,
      idempotencyKey,
      companyTierResultsResponseSchema,
    );
  }

  saveAnalysisResults(
    analysisRunId: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<AnalysisResultsResponse> {
    return careerBackendRequest(this.httpOptions,
      "POST",
      `/api/positions/v1/analysis-runs/${encodeURIComponent(analysisRunId)}/results`,
      body,
      idempotencyKey,
      analysisResultsResponseSchema,
    );
  }

  createRecommendation(
    analysisRunId: string,
    idempotencyKey: string,
  ): Promise<RecommendationResponse> {
    return careerBackendRequest(this.httpOptions,
      "POST",
      "/api/positions/v1/recommendation-runs",
      { schemaVersion: 1, analysisRunId },
      idempotencyKey,
      recommendationResponseSchema,
    );
  }

  getRun(runId: string): Promise<AnalysisQueueResponse | RecommendationResponse> {
    return careerBackendRequest(this.httpOptions,
      "GET",
      `/api/positions/v1/runs/${encodeURIComponent(runId)}`,
      undefined,
      undefined,
      z.union([analysisQueueResponseSchema, recommendationResponseSchema]),
    );
  }

  configureAnalysisPolicy(body: unknown, idempotencyKey: string) {
    return careerBackendRequest(this.httpOptions,
      "PUT",
      "/api/positions/v1/analysis-policy",
      body,
      idempotencyKey,
      analysisPolicySchema,
    );
  }

  listCompanyPreferences(): Promise<CompanyPreference[]> {
    return careerBackendRequest(this.httpOptions,
      "GET",
      "/api/positions/v1/company-preferences",
      undefined,
      undefined,
      z.array(companyPreferenceSchema),
    );
  }

  getExclusions(): Promise<PositionExclusion[]> {
    return careerBackendRequest(this.httpOptions,
      "GET",
      "/api/positions/v1/exclusions",
      undefined,
      undefined,
      z.array(positionExclusionSchema),
    );
  }

  /** 제외 규칙 전체를 받은 목록으로 바꾸고 바뀐 뒤의 목록을 받는다. */
  replaceExclusions(body: unknown, idempotencyKey: string): Promise<PositionExclusion[]> {
    return careerBackendRequest(this.httpOptions,
      "PUT",
      "/api/positions/v1/exclusions",
      body,
      idempotencyKey,
      z.array(positionExclusionSchema),
    );
  }

  /** 모은 회사 근거를 회사 tier 실행 단위로 저장한다. `url_hash` 는 Backend 가 만든다. */
  putCompanyEvidence(
    companyTierRunId: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<CompanyEvidenceSaveResponse> {
    return careerBackendRequest(this.httpOptions,
      "PUT",
      `/api/positions/v1/company-tier-runs/${encodeURIComponent(companyTierRunId)}/evidence`,
      body,
      idempotencyKey,
      companyEvidenceSaveResponseSchema,
    );
  }

  /** 한 회사의 아직 유효한 근거만 받는다. */
  getCompanyEvidence(companyKey: string): Promise<StoredCompanyEvidence[]> {
    return careerBackendRequest(this.httpOptions,
      "GET",
      `/api/positions/v1/companies/${encodeURIComponent(companyKey)}/evidence`,
      undefined,
      undefined,
      z.array(storedCompanyEvidenceSchema),
    );
  }

  getActiveCompanyPostings(companyKey: string): Promise<CompanyActivePosting[]> {
    return careerBackendRequest(this.httpOptions,
      "GET",
      `/api/positions/v1/companies/${encodeURIComponent(companyKey)}/active-postings`,
      undefined,
      undefined,
      z.array(companyActivePostingSchema),
    );
  }

  updateCompanyPreference(companyKey: string, body: unknown, idempotencyKey: string) {
    return careerBackendRequest(this.httpOptions,
      "PUT",
      `/api/positions/v1/company-preferences/${encodeURIComponent(companyKey)}`,
      body,
      idempotencyKey,
      companyPreferenceSchema,
    );
  }
}

export function createCareerBackendClient(
  environment: Record<string, string | undefined> = process.env,
): CareerBackendClient {
  return new CareerBackendClient(resolveCareerBackendConnection(environment));
}
