import { createHash } from "node:crypto";
import type { z } from "zod";
import type { AccessCredentials } from "../lib/access-credentials.ts";
import { resolveCareerBackendConnection } from "../lib/career-backend-config.ts";
import { careerBackendRequest } from "../lib/career-backend-http.ts";
import {
  candidateContextDocumentKeySchema,
  candidateContextGetResponseSchema,
  candidateContextListResponseSchema,
  candidateContextPutPayloadSchema,
  candidateContextPutResponseSchema,
  type CandidateContextDocument,
  type CandidateContextListResponse,
  type CandidateContextPutPayload,
  type CandidateContextPutResponse,
} from "./contracts.ts";

export const CANDIDATE_CONTEXT_API_BASE_PATH = "/api/candidate-context/v1";
export const DEFAULT_CANDIDATE_CONTEXT_TIMEOUT_MS = 10_000;
export const DEFAULT_CANDIDATE_CONTEXT_MAX_RETRIES = 2;

export type CandidateContextFetch = (input: URL, init: RequestInit) => Promise<Response>;

export interface CandidateContextClientOptions {
  origin?: string;
  token?: string;
  fetchImpl?: CandidateContextFetch;
  timeoutMs?: number;
  maxRetries?: number;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function hashKey(prefix: string, value: unknown): string {
  return `${prefix}:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

export class CandidateContextClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly access?: AccessCredentials;
  private readonly fetchImpl: CandidateContextFetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: CandidateContextClientOptions = {}) {
    if (options.origin !== undefined || options.token !== undefined) {
      if (!options.origin?.trim() || !options.token?.trim()) throw new Error("명시적 origin과 token이 모두 필요하다.");
      const connection = resolveCareerBackendConnection({
        CAREER_BACKEND_URL: options.origin,
        CAREER_BACKEND_TOKEN: options.token,
      });
      this.baseUrl = connection.baseUrl;
      this.token = connection.token;
      this.access = connection.access;
    } else {
      const connection = resolveCareerBackendConnection(process.env);
      this.baseUrl = connection.baseUrl;
      this.token = connection.token;
      this.access = connection.access;
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_CANDIDATE_CONTEXT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_CANDIDATE_CONTEXT_MAX_RETRIES;
  }

  private request<T>(
    method: "GET" | "PUT",
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    return careerBackendRequest(
      {
        baseUrl: this.baseUrl,
        token: this.token,
        access: this.access,
        fetcher: this.fetchImpl,
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
      },
      method,
      `${CANDIDATE_CONTEXT_API_BASE_PATH}${path}`,
      body,
      idempotencyKey,
      schema,
    );
  }

  async listDocuments(): Promise<CandidateContextListResponse> {
    return this.request("GET", "/documents", candidateContextListResponseSchema);
  }

  async getDocument(key: string): Promise<CandidateContextDocument> {
    const documentKey = candidateContextDocumentKeySchema.parse(key);
    return (await this.request("GET", `/documents/${documentKey}`, candidateContextGetResponseSchema)).document;
  }

  async putDocument(key: string, payload: CandidateContextPutPayload): Promise<CandidateContextPutResponse> {
    const documentKey = candidateContextDocumentKeySchema.parse(key);
    const body = candidateContextPutPayloadSchema.parse(payload);
    return this.request(
      "PUT",
      `/documents/${documentKey}`,
      candidateContextPutResponseSchema,
      body,
      hashKey("candidate-context", { documentKey, body: body.body, note: body.note, expectedVersion: body.expectedVersion }),
    );
  }
}

export function createCandidateContextClient(options: CandidateContextClientOptions = {}): CandidateContextClient {
  return new CandidateContextClient(options);
}
