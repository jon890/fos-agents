import { readFileSync, statSync } from "node:fs";
import { z } from "zod";
import {
  analysisPolicySchema,
  analysisQueueResponseSchema,
  analysisResultsResponseSchema,
  companyPreferenceSchema,
  positionPreparationResponseSchema,
  recommendationResponseSchema,
  type AnalysisQueueResponse,
  type AnalysisResultsResponse,
  type CompanyPreference,
  type PositionPreparationResponse,
  type RecommendationResponse,
} from "../../../services/recommendation-api/position/schema.ts";

const responseErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type RecommendationApiClientOptions = {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  fetcher?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
};

export class RecommendationApiClientError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RecommendationApiClientError";
  }
}

export class RecommendationApiClient {
  private readonly fetcher: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
  private readonly timeoutMs: number;

  constructor(private readonly options: RecommendationApiClientOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body: unknown,
    idempotencyKey: string | undefined,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const serialized = body === undefined ? undefined : JSON.stringify(body);
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const headers = new Headers({ Authorization: `Bearer ${this.options.token}` });
        if (serialized !== undefined) headers.set("Content-Type", "application/json");
        if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
        const response = await this.fetcher(new URL(path, this.options.baseUrl), {
          method,
          headers,
          body: serialized,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        let json: unknown;
        try {
          json = (await response.json()) as unknown;
        } catch {
          const error = new RecommendationApiClientError(
            response.status,
            "INVALID_RESPONSE",
            "추천 API 응답을 읽을 수 없습니다.",
          );
          if (response.status < 500 || attempt === 2) throw error;
          lastError = error;
          continue;
        }
        if (response.ok) {
          const parsed = schema.safeParse(json);
          if (!parsed.success) {
            throw new RecommendationApiClientError(
              response.status,
              "INVALID_RESPONSE",
              "추천 API 응답 계약이 올바르지 않습니다.",
            );
          }
          return parsed.data;
        }
        const parsed = responseErrorSchema.safeParse(json);
        const error = new RecommendationApiClientError(
          response.status,
          parsed.success ? parsed.data.error.code : "HTTP_ERROR",
          parsed.success ? parsed.data.error.message : "추천 API 요청이 실패했습니다.",
        );
        if (response.status < 500 || attempt === 2) throw error;
        lastError = error;
      } catch (error) {
        if (
          error instanceof RecommendationApiClientError &&
          error.status !== null &&
          error.status < 500
        ) {
          throw error;
        }
        lastError = error;
        if (attempt === 2) break;
      }
    }
    throw lastError instanceof RecommendationApiClientError
      ? lastError
      : new RecommendationApiClientError(null, "NETWORK_ERROR", "추천 API에 연결하지 못했습니다.");
  }

  saveCollection(body: unknown, idempotencyKey: string): Promise<PositionPreparationResponse> {
    return this.request(
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
    return this.request(
      "POST",
      `/api/positions/v1/collection-runs/${encodeURIComponent(collectionRunId)}/analysis-runs`,
      { schemaVersion: 1 },
      idempotencyKey,
      analysisQueueResponseSchema,
    );
  }

  saveAnalysisResults(
    analysisRunId: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<AnalysisResultsResponse> {
    return this.request(
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
    return this.request(
      "POST",
      "/api/positions/v1/recommendation-runs",
      { schemaVersion: 1, analysisRunId },
      idempotencyKey,
      recommendationResponseSchema,
    );
  }

  configureAnalysisPolicy(body: unknown, idempotencyKey: string) {
    return this.request(
      "PUT",
      "/api/positions/v1/analysis-policy",
      body,
      idempotencyKey,
      analysisPolicySchema,
    );
  }

  listCompanyPreferences(): Promise<CompanyPreference[]> {
    return this.request(
      "GET",
      "/api/positions/v1/company-preferences",
      undefined,
      undefined,
      z.array(companyPreferenceSchema),
    );
  }

  updateCompanyPreference(companyKey: string, body: unknown, idempotencyKey: string) {
    return this.request(
      "PUT",
      `/api/positions/v1/company-preferences/${encodeURIComponent(companyKey)}`,
      body,
      idempotencyKey,
      companyPreferenceSchema,
    );
  }
}

function tokenFromFile(path: string): string {
  if ((statSync(path).mode & 0o777) !== 0o600) {
    throw new Error("추천 API token 파일 권한은 600이어야 합니다.");
  }
  return readFileSync(path, "utf8").trim();
}

export function createRecommendationApiClient(
  environment: Record<string, string | undefined> = process.env,
): RecommendationApiClient {
  const baseUrl = environment.CAREER_RECOMMENDATION_API_URL;
  const directToken = environment.CAREER_RECOMMENDATION_API_TOKEN;
  const tokenFile = environment.CAREER_RECOMMENDATION_API_TOKEN_FILE;
  if (!baseUrl || Boolean(directToken) === Boolean(tokenFile)) {
    throw new Error("추천 API URL과 token 설정을 확인하세요.");
  }
  const token = directToken ?? tokenFromFile(tokenFile!);
  if (token.length < 32) throw new Error("추천 API token 설정을 확인하세요.");
  return new RecommendationApiClient({ baseUrl, token });
}
