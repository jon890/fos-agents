import type { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { resolveCareerBackendConnection } from "../../lib/career-backend-config.ts";
import { careerBackendRequest } from "../../lib/career-backend-http.ts";
import {
  studyLibraryCandidatePageSchema,
  studyLibraryCursorResultSchema,
  studyLibraryIngestionResultSchema,
  studyLibraryPublicationResultSchema,
  studyLibraryRecommendationRunResultSchema,
  studyLibraryRecommendationControlSchema,
  studyLibraryRecommendationStatusSchema,
  studyLibrarySourcesResponseSchema,
  studyLibrarySourceUpsertResponseSchema,
  type StudyLibraryCandidatePage,
  type StudyLibraryCursorResult,
  type StudyLibraryIngestionResult,
  type StudyLibraryPublicationResult,
  type StudyLibraryRecommendationRunResult,
  type StudyLibrarySourcePutPayload,
  type StudyLibrarySourcesResponse,
  type StudyLibrarySourceUpsertResponse,
} from "./contracts.js";

export const STUDY_LIBRARY_API_BASE_PATH = "/api/study/v1";
export const DEFAULT_STUDY_LIBRARY_TIMEOUT_MS = 10_000;
export const DEFAULT_STUDY_LIBRARY_MAX_RETRIES = 2;

export type StudyLibraryFetch = (input: URL, init: RequestInit) => Promise<Response>;

export class StudyLibraryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudyLibraryConfigError";
  }
}

export interface StudyLibraryClientOptions {
  origin?: string;
  token?: string;
  fetchImpl?: StudyLibraryFetch;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface StudyLibraryRequestOptions {
  searchParams?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  idempotencyKey?: string;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function hashKey(prefix: string, value: unknown): string {
  return `${prefix}:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

function appendSearchParams(url: URL, params?: StudyLibraryRequestOptions["searchParams"]): void {
  if (!params) return;
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    url.searchParams.set(key, String(value));
  }
}

export class StudyLibraryClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: StudyLibraryFetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: StudyLibraryClientOptions = {}) {
    try {
      if (options.origin !== undefined || options.token !== undefined) {
        if (!options.origin?.trim() || !options.token?.trim()) throw new Error("명시적 origin과 token이 모두 필요하다.");
        const connection = resolveCareerBackendConnection({
          CAREER_BACKEND_URL: options.origin,
          CAREER_BACKEND_TOKEN: options.token,
        });
        this.baseUrl = connection.baseUrl;
        this.token = connection.token;
      } else {
        const connection = resolveCareerBackendConnection(process.env);
        this.baseUrl = connection.baseUrl;
        this.token = connection.token;
      }
    } catch (error) {
      throw new StudyLibraryConfigError(error instanceof Error ? error.message : String(error));
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_STUDY_LIBRARY_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_STUDY_LIBRARY_MAX_RETRIES;
  }

  async request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    schema: z.ZodType<T>,
    options: StudyLibraryRequestOptions = {}
  ): Promise<T> {
    if (!path.startsWith("/")) {
      throw new Error("API path는 /로 시작해야 한다.");
    }
    const url = new URL(`${STUDY_LIBRARY_API_BASE_PATH}${path}`, this.baseUrl);
    appendSearchParams(url, options.searchParams);
    return careerBackendRequest(
      {
        baseUrl: this.baseUrl,
        token: this.token,
        fetcher: this.fetchImpl,
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
      },
      method,
      `${url.pathname}${url.search}`,
      options.body,
      options.idempotencyKey,
      schema,
    );
  }

  async getSources(): Promise<StudyLibrarySourcesResponse> {
    return this.request("GET", "/sources", studyLibrarySourcesResponseSchema);
  }

  async putSource(sourceKey: string, body: StudyLibrarySourcePutPayload): Promise<StudyLibrarySourceUpsertResponse> {
    return this.request(
      "PUT",
      `/sources/${encodeURIComponent(sourceKey)}`,
      studyLibrarySourceUpsertResponseSchema,
      { body, idempotencyKey: hashKey("source", { sourceKey, payload: body }) }
    );
  }

  async getSourceCursor(sourceKey: string, mode: "recent" | "archive"): Promise<StudyLibraryCursorResult> {
    return this.request(
      "GET",
      `/sources/${encodeURIComponent(sourceKey)}/cursor`,
      studyLibraryCursorResultSchema,
      { searchParams: { mode } }
    );
  }

  async createIngestion(body: unknown): Promise<StudyLibraryIngestionResult> {
    return this.request("POST", "/ingestions", studyLibraryIngestionResultSchema, { body, idempotencyKey: (body as { idempotencyKey?: string }).idempotencyKey });
  }

  async getCandidates(searchParams: StudyLibraryRequestOptions["searchParams"] = {}): Promise<StudyLibraryCandidatePage> {
    return this.request("GET", "/candidates", studyLibraryCandidatePageSchema, { searchParams });
  }

  async createRecommendationRun(body: unknown): Promise<StudyLibraryRecommendationRunResult> {
    const value = body as { reportId: string; generatedAt: string };
    return this.request("POST", "/recommendation-runs", studyLibraryRecommendationRunResultSchema, { body, idempotencyKey: hashKey("recommendation", { reportId: value.reportId, generatedAt: value.generatedAt }) });
  }

  async createPublication(body: unknown): Promise<StudyLibraryPublicationResult> {
    return this.request("POST", "/publications", studyLibraryPublicationResultSchema, { body, idempotencyKey: (body as { idempotencyKey?: string }).idempotencyKey });
  }

  async getRecommendationRunStatus(reportId: string): Promise<{ reportId: string; exists: boolean }> {
    return this.request("GET", `/recommendation-runs/${encodeURIComponent(reportId)}/status`, studyLibraryRecommendationStatusSchema);
  }

  async updateRecommendationControl(candidateContextVersion: string, idempotencyKey = `control:${randomUUID()}`): Promise<{ candidateContextVersion: string }> {
    return this.request("PUT", "/recommendation-control", studyLibraryRecommendationControlSchema, {
      body: { candidateContextVersion }, idempotencyKey,
    });
  }
}

export function createStudyLibraryClient(options: StudyLibraryClientOptions = {}): StudyLibraryClient {
  return new StudyLibraryClient(options);
}
