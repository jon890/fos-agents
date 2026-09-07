import type { z } from "zod";
import {
  studyLibraryApiErrorSchema,
  studyLibraryCandidatePageSchema,
  studyLibraryCursorResultSchema,
  studyLibraryIngestionResultSchema,
  studyLibraryImportDryRunResultSchema,
  studyLibraryPublicationResultSchema,
  studyLibraryRecommendationRunResultSchema,
  studyLibrarySourcesResponseSchema,
  studyLibrarySourceUpsertResponseSchema,
  type StudyLibraryCandidatePage,
  type StudyLibraryCursorResult,
  type StudyLibraryIngestionResult,
  type StudyLibraryImportDryRunResult,
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

export class StudyLibraryApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly retryAfter?: number;

  constructor(input: { status: number; code?: string; requestId?: string; retryAfter?: number }) {
    const parts = [`HTTP ${input.status}`];
    if (input.code) parts.push(input.code);
    if (input.requestId) parts.push(`requestId=${input.requestId}`);
    if (input.retryAfter !== undefined) parts.push(`retryAfter=${input.retryAfter}`);
    super(`학습자료 API 요청 실패: ${parts.join(" ")}`);
    this.name = "StudyLibraryApiError";
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.retryAfter = input.retryAfter;
  }
}

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
}

function readRequiredValue(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new StudyLibraryConfigError(`${name} 환경값이 필요하다.`);
  }
  return value;
}

function validateStudyLibraryOrigin(rawOrigin: string): URL {
  let url: URL;
  try {
    url = new URL(rawOrigin);
  } catch {
    throw new StudyLibraryConfigError("STUDY_LIBRARY_URL은 유효한 HTTPS origin이어야 한다.");
  }

  if (url.protocol !== "https:") {
    throw new StudyLibraryConfigError("STUDY_LIBRARY_URL은 HTTPS origin이어야 한다.");
  }
  if (url.username || url.password) {
    throw new StudyLibraryConfigError("STUDY_LIBRARY_URL에는 credentials를 넣을 수 없다.");
  }
  if (url.search) {
    throw new StudyLibraryConfigError("STUDY_LIBRARY_URL에는 query를 넣을 수 없다.");
  }
  if (url.hash) {
    throw new StudyLibraryConfigError("STUDY_LIBRARY_URL에는 hash를 넣을 수 없다.");
  }
  if (url.pathname !== "/") {
    throw new StudyLibraryConfigError("STUDY_LIBRARY_URL에는 path를 넣을 수 없다.");
  }
  return url;
}

function formatIssues(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  }).join("; ");
}

function appendSearchParams(url: URL, params?: StudyLibraryRequestOptions["searchParams"]): void {
  if (!params) return;
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    url.searchParams.set(key, String(value));
  }
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 && status <= 599;
}

function parseRetryAfter(response: Response): number | undefined {
  if (response.status !== 429) return undefined;
  const raw = response.headers.get("Retry-After")?.trim();
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const seconds = Number(raw);
  return Number.isSafeInteger(seconds) ? seconds : undefined;
}

class StudyLibraryBodyReadError extends Error {
  constructor() {
    super("학습자료 API 응답 본문 읽기 실패");
    this.name = "StudyLibraryBodyReadError";
  }
}

class StudyLibraryMalformedJsonError extends Error {
  constructor() {
    super("학습자료 API JSON 응답 파싱 실패");
    this.name = "StudyLibraryMalformedJsonError";
  }
}

class StudyLibraryResponseValidationError extends Error {
  constructor(issues: { path: PropertyKey[]; message: string }[]) {
    super(`학습자료 API 응답 검증 실패: ${formatIssues(issues)}`);
    this.name = "StudyLibraryResponseValidationError";
  }
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new StudyLibraryMalformedJsonError();
    }
    throw new StudyLibraryBodyReadError();
  }
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    throw new StudyLibraryBodyReadError();
  }
}

async function parseApiError(response: Response): Promise<{ code?: string; requestId?: string; retryAfter?: number }> {
  let raw: unknown;
  try {
    raw = await readJsonBody(response);
  } catch (error) {
    if (error instanceof StudyLibraryMalformedJsonError) return { retryAfter: parseRetryAfter(response) };
    throw error;
  }
  const parsed = studyLibraryApiErrorSchema.safeParse(raw);
  if (!parsed.success) return { retryAfter: parseRetryAfter(response) };
  return {
    code: parsed.data.error.code,
    requestId: parsed.data.error.requestId,
    retryAfter: parseRetryAfter(response),
  };
}

export class StudyLibraryClient {
  private readonly origin: URL;
  private readonly token: string;
  private readonly fetchImpl: StudyLibraryFetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: StudyLibraryClientOptions = {}) {
    this.origin = validateStudyLibraryOrigin(readRequiredValue(
      options.origin ?? process.env.STUDY_LIBRARY_URL,
      "STUDY_LIBRARY_URL"
    ));
    this.token = readRequiredValue(options.token ?? process.env.STUDY_SERVICE_TOKEN, "STUDY_SERVICE_TOKEN");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_STUDY_LIBRARY_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_STUDY_LIBRARY_MAX_RETRIES;
  }

  async request<T>(
    method: string,
    path: string,
    schema: z.ZodType<T>,
    options: StudyLibraryRequestOptions = {}
  ): Promise<T> {
    if (!path.startsWith("/")) {
      throw new Error("API path는 /로 시작해야 한다.");
    }
    const url = new URL(`${STUDY_LIBRARY_API_BASE_PATH}${path}`, this.origin);
    appendSearchParams(url, options.searchParams);
    const serializedBody = options.body === undefined ? undefined : JSON.stringify(options.body);
    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${this.token}`,
    });
    if (serializedBody !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers,
          body: serializedBody,
          redirect: "error",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (isRetryableStatus(response.status) && attempt < this.maxRetries) {
            await cancelResponseBody(response);
            continue;
          }
          const apiError = await parseApiError(response);
          throw new StudyLibraryApiError({
            status: response.status,
            code: apiError.code,
            requestId: apiError.requestId,
            retryAfter: apiError.retryAfter,
          });
        }

        const parsedBody = await readJsonBody(response);
        const parsed = schema.safeParse(parsedBody);
        if (!parsed.success) {
          throw new StudyLibraryResponseValidationError(parsed.error.issues);
        }
        return parsed.data;
      } catch (error) {
        if (
          error instanceof StudyLibraryApiError ||
          error instanceof StudyLibraryMalformedJsonError ||
          error instanceof StudyLibraryResponseValidationError
        ) {
          throw error;
        }
        if (attempt >= this.maxRetries) {
          throw new Error("학습자료 API 네트워크 요청 실패");
        }
        continue;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error("학습자료 API 네트워크 요청 실패");
  }

  async getSources(): Promise<StudyLibrarySourcesResponse> {
    return this.request("GET", "/sources", studyLibrarySourcesResponseSchema);
  }

  async putSource(sourceKey: string, body: StudyLibrarySourcePutPayload): Promise<StudyLibrarySourceUpsertResponse> {
    return this.request(
      "PUT",
      `/sources/${encodeURIComponent(sourceKey)}`,
      studyLibrarySourceUpsertResponseSchema,
      { body }
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
    return this.request("POST", "/ingestions", studyLibraryIngestionResultSchema, { body });
  }

  async getCandidates(searchParams: StudyLibraryRequestOptions["searchParams"] = {}): Promise<StudyLibraryCandidatePage> {
    return this.request("GET", "/candidates", studyLibraryCandidatePageSchema, { searchParams });
  }

  async createRecommendationRun(body: unknown): Promise<StudyLibraryRecommendationRunResult> {
    return this.request("POST", "/recommendation-runs", studyLibraryRecommendationRunResultSchema, { body });
  }

  async createPublication(body: unknown): Promise<StudyLibraryPublicationResult> {
    return this.request("POST", "/publications", studyLibraryPublicationResultSchema, { body });
  }

  async createImportDryRun(body: unknown): Promise<StudyLibraryImportDryRunResult> {
    return this.request("POST", "/imports/dry-run", studyLibraryImportDryRunResultSchema, { body });
  }
}

export function createStudyLibraryClient(options: StudyLibraryClientOptions = {}): StudyLibraryClient {
  return new StudyLibraryClient(options);
}
