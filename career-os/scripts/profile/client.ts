import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { hashKey } from "../candidate-context/client.ts";
import type { AccessCredentials } from "../lib/access-credentials.ts";
import { resolveCareerBackendConnection } from "../lib/career-backend-config.ts";
import { careerBackendRequest } from "../lib/career-backend-http.ts";
import {
  profileDocumentGetResponseSchema,
  profileDocumentKeySchema,
  profileDocumentListResponseSchema,
  profileDocumentPutPayloadSchema,
  profileDocumentPutResponseSchema,
  usageMonthSchema,
  usageSnapshotListResponseSchema,
  usageSnapshotPutPayloadSchema,
  usageSnapshotPutResponseSchema,
  type ProfileDocument,
  type ProfileDocumentListResponse,
  type ProfileDocumentPutPayload,
  type ProfileDocumentPutResponse,
  type UsageSnapshot,
  type UsageSnapshotPutPayload,
  type UsageSnapshotPutResponse,
} from "./contracts.ts";

export const PROFILE_API_BASE_PATH = "/api/profile/v1";
export const DEFAULT_PROFILE_TIMEOUT_MS = 10_000;
export const DEFAULT_PROFILE_MAX_RETRIES = 2;

export type ProfileFetch = (input: URL, init: RequestInit) => Promise<Response>;

export interface ProfileClientOptions {
  origin?: string;
  token?: string;
  fetchImpl?: ProfileFetch;
  timeoutMs?: number;
  maxRetries?: number;
}

export class ProfileClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly access?: AccessCredentials;
  private readonly fetchImpl: ProfileFetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: ProfileClientOptions = {}) {
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
    this.timeoutMs = options.timeoutMs ?? DEFAULT_PROFILE_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_PROFILE_MAX_RETRIES;
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
      `${PROFILE_API_BASE_PATH}${path}`,
      body,
      idempotencyKey,
      schema,
    );
  }

  async listDocuments(): Promise<ProfileDocumentListResponse> {
    return this.request("GET", "/documents", profileDocumentListResponseSchema);
  }

  async getDocument(key: string): Promise<ProfileDocument> {
    const documentKey = profileDocumentKeySchema.parse(key);
    return (await this.request("GET", `/documents/${documentKey}`, profileDocumentGetResponseSchema)).document;
  }

  async putDocument(key: string, payload: ProfileDocumentPutPayload): Promise<ProfileDocumentPutResponse> {
    const documentKey = profileDocumentKeySchema.parse(key);
    const body = profileDocumentPutPayloadSchema.parse(payload);
    return this.request(
      "PUT",
      `/documents/${documentKey}`,
      profileDocumentPutResponseSchema,
      body,
      hashKey("profile-document", { documentKey, body: body.body, note: body.note, expectedVersion: body.expectedVersion }),
    );
  }

  async listUsageSnapshots(): Promise<UsageSnapshot[]> {
    return (await this.request("GET", "/usage-snapshots", usageSnapshotListResponseSchema)).snapshots;
  }

  /** 기록이 이미 있으면 `created: false` 와 저장돼 있던 기록이 온다. 예외가 아니라 정상 응답이다. */
  async putUsageSnapshot(month: string, payload: UsageSnapshotPutPayload): Promise<UsageSnapshotPutResponse> {
    const parsedMonth = usageMonthSchema.parse(month);
    const body = usageSnapshotPutPayloadSchema.parse(payload);
    return this.request(
      "PUT",
      `/usage-snapshots/${parsedMonth}`,
      usageSnapshotPutResponseSchema,
      body,
      // 교체는 실행마다 새 키를 쓴다. 영수증이 만료되지 않아, 같은 값의 교체를 나중에 다시 실행하면 옛 응답만 돌아온다.
      hashKey("profile-usage", { month: parsedMonth, payload: body, run: body.replace === true ? randomUUID() : undefined }),
    );
  }
}

export function createProfileClient(options: ProfileClientOptions = {}): ProfileClient {
  return new ProfileClient(options);
}
