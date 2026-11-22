import { z } from "zod";
import { readContextDocument } from "../context.ts";
import type { CareerDatabase } from "../database.ts";
import { CareerStoreError } from "../errors.ts";
import { runWithReceipt } from "../receipts.ts";
import { parseRequest } from "../validate.ts";
import { PositionsRepository } from "./repository.ts";
import {
  analysisPolicySchema,
  analysisQueueResponseSchema,
  analysisResultsRequestSchema,
  analysisResultsResponseSchema,
  collectionRequestSchema,
  companyActivePostingSchema,
  companyEvidenceRequestSchema,
  companyEvidenceSaveResponseSchema,
  companyPreferenceSchema,
  companyPreferenceUpdateSchema,
  companyTierResultsRequestSchema,
  companyTierResultsResponseSchema,
  exclusionsRequestSchema,
  positionExclusionSchema,
  positionPreparationResponseSchema,
  recommendationResponseSchema,
  storedCompanyEvidenceSchema,
  type AnalysisPolicy,
  type AnalysisQueueResponse,
  type AnalysisResultsResponse,
  type CompanyActivePosting,
  type CompanyEvidenceSaveResponse,
  type CompanyPreference,
  type CompanyTierResultsResponse,
  type PositionExclusion,
  type PositionPreparationResponse,
  type RecommendationResponse,
  type StoredCompanyEvidence,
} from "./schema.ts";
import { PositionsService } from "./service.ts";

/**
 * 공고 추천의 저장 모듈이다. 커리어 Backend 의 HTTP 경로 하나가 메서드 하나이고
 * 입력과 출력이 그 요청·응답 본문과 같다(ADR-146).
 *
 * 쓰기 메서드는 본문을 계약 schema 로 검사하고, 같은 멱등 키의 재전송에는 처음 응답을 돌려준다.
 */
export class PositionStore {
  private readonly service: PositionsService;

  constructor(private readonly db: CareerDatabase) {
    this.service = new PositionsService(
      new PositionsRepository(db),
      () => readContextDocument(db.root, "position-preferences").version,
    );
  }

  /** `POST /collection-runs` */
  saveCollection(body: unknown, idempotencyKey: string): Promise<PositionPreparationResponse> {
    return runWithReceipt(this.db, idempotencyKey, body, 201, async () =>
      positionPreparationResponseSchema.parse(
        await this.service.saveCollection(parseRequest(collectionRequestSchema, body)),
      ),
    );
  }

  /** `POST /collection-runs/{id}/analysis-runs` */
  createPositionAnalysisRun(
    collectionRunId: string,
    idempotencyKey: string,
  ): Promise<AnalysisQueueResponse> {
    return runWithReceipt(this.db, idempotencyKey, { schemaVersion: 1 }, 201, async () =>
      analysisQueueResponseSchema.parse(
        await this.service.createPositionAnalysisRun(collectionRunId),
      ),
    );
  }

  /** `POST /company-tier-runs/{id}/results` */
  saveCompanyTierResults(
    companyTierRunId: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<CompanyTierResultsResponse> {
    return runWithReceipt(this.db, idempotencyKey, body, 200, async () =>
      companyTierResultsResponseSchema.parse(
        await this.service.saveCompanyTierResults(
          companyTierRunId,
          parseRequest(companyTierResultsRequestSchema, body),
        ),
      ),
    );
  }

  /** `POST /analysis-runs/{id}/results` */
  saveAnalysisResults(
    analysisRunId: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<AnalysisResultsResponse> {
    return runWithReceipt(this.db, idempotencyKey, body, 200, async () =>
      analysisResultsResponseSchema.parse(
        await this.service.saveAnalysisResults(
          analysisRunId,
          parseRequest(analysisResultsRequestSchema, body),
        ),
      ),
    );
  }

  /** `POST /recommendation-runs` */
  createRecommendation(
    analysisRunId: string,
    idempotencyKey: string,
  ): Promise<RecommendationResponse> {
    const body = { schemaVersion: 1, analysisRunId };
    return runWithReceipt(this.db, idempotencyKey, body, 201, async () => {
      if (typeof analysisRunId !== "string") {
        throw new CareerStoreError(400, "BAD_REQUEST", "analysisRunId가 필요합니다.");
      }
      return recommendationResponseSchema.parse(
        await this.service.createRecommendation(analysisRunId),
      );
    });
  }

  /** `GET /runs/{id}` */
  async getRun(runId: string): Promise<AnalysisQueueResponse | RecommendationResponse> {
    return z
      .union([analysisQueueResponseSchema, recommendationResponseSchema])
      .parse(await this.service.getRun(runId));
  }

  /** `PUT /analysis-policy` */
  configureAnalysisPolicy(body: unknown, idempotencyKey: string): Promise<AnalysisPolicy> {
    return runWithReceipt(this.db, idempotencyKey, body, 200, async () =>
      analysisPolicySchema.parse(
        await this.service.configurePolicy(parseRequest(analysisPolicySchema, body)),
      ),
    );
  }

  /** `GET /analysis-policy` */
  async getAnalysisPolicy(): Promise<AnalysisPolicy> {
    return analysisPolicySchema.parse(await this.service.getPolicy());
  }

  /** `GET /company-preferences` */
  async listCompanyPreferences(): Promise<CompanyPreference[]> {
    return z.array(companyPreferenceSchema).parse(await this.service.listCompanyPreferences());
  }

  /** `PUT /company-preferences/{companyKey}` */
  updateCompanyPreference(
    companyKey: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<CompanyPreference> {
    return runWithReceipt(this.db, idempotencyKey, body, 200, async () =>
      companyPreferenceSchema.parse(
        await this.service.updateCompanyPreference(
          companyKey,
          parseRequest(companyPreferenceUpdateSchema, body),
        ),
      ),
    );
  }

  /** `GET /exclusions` */
  async getExclusions(): Promise<PositionExclusion[]> {
    return z.array(positionExclusionSchema).parse(await this.service.listExclusions());
  }

  /** `PUT /exclusions`. 규칙 전체를 받은 목록으로 바꾸고 바뀐 뒤의 목록을 돌려준다. */
  replaceExclusions(body: unknown, idempotencyKey: string): Promise<PositionExclusion[]> {
    return runWithReceipt(this.db, idempotencyKey, body, 200, async () =>
      z
        .array(positionExclusionSchema)
        .parse(
          await this.service.replaceExclusions(parseRequest(exclusionsRequestSchema, body)),
        ),
    );
  }

  /** `PUT /company-tier-runs/{id}/evidence` */
  putCompanyEvidence(
    companyTierRunId: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<CompanyEvidenceSaveResponse> {
    return runWithReceipt(this.db, idempotencyKey, body, 200, async () =>
      companyEvidenceSaveResponseSchema.parse(
        await this.service.saveCompanyEvidence(
          companyTierRunId,
          parseRequest(companyEvidenceRequestSchema, body),
        ),
      ),
    );
  }

  /** `GET /companies/{companyKey}/evidence`. 아직 유효한 근거만 준다. */
  async getCompanyEvidence(companyKey: string): Promise<StoredCompanyEvidence[]> {
    return z
      .array(storedCompanyEvidenceSchema)
      .parse(await this.service.listValidCompanyEvidence(companyKey));
  }

  /** `GET /companies/{companyKey}/active-postings` */
  async getActiveCompanyPostings(companyKey: string): Promise<CompanyActivePosting[]> {
    return z
      .array(companyActivePostingSchema)
      .parse(await this.service.listActiveCompanyPostings(companyKey));
  }
}
