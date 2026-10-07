import { z } from "zod";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const namedItemsSchema = z.array(z.object({ uuid: z.string().min(1), name: z.string() }));
export const recordIdentitySchema = z.object({ uuid: z.string().min(1) }).passthrough();
export const transactionSchema = recordIdentitySchema.extend({
  amount: z
    .union([z.number().finite(), z.string().regex(/^\d+(?:\.\d{1,2})?$/)])
    .refine((value) => Number(value) > 0),
  description: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/),
});
export const transactionPageSchema = z
  .object({
    items: z.array(transactionSchema),
    totalPages: z.number().int().min(0).max(10_000),
    totalElements: z.number().int().min(0),
    currentPage: z.number().int().min(0),
  })
  .passthrough();

export function responseData<T>(response: unknown, schema: z.ZodType<T>): T {
  const parsed = z.object({ data: schema }).safeParse(response);
  if (!parsed.success) throw new AccountbookError("ACCOUNTBOOK_INVALID_RESPONSE");
  return parsed.data.data;
}

export function configuredValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return !trimmed || trimmed.startsWith("${") ? undefined : trimmed;
}

const messages = {
  ACCOUNTBOOK_UNAUTHORIZED:
    "가계부 설정에서 연동 토큰을 다시 발급해 fos-assistant 에 등록해 주세요",
  ACCOUNTBOOK_FORBIDDEN: "이 가족 또는 요청에 접근할 권한이 없습니다.",
  ACCOUNTBOOK_NOT_FOUND: "대상 기록을 찾을 수 없습니다. 최근 내역을 다시 조회해 주세요.",
  ACCOUNTBOOK_BAD_REQUEST: "요청 값을 확인해 주세요.",
  ACCOUNTBOOK_UNAVAILABLE: "가계부 서버가 응답하지 않습니다. 잠시 뒤 조회해 주세요.",
  ACCOUNTBOOK_NETWORK: "가계부 서버에 연결하지 못했습니다. 잠시 뒤 다시 조회해 주세요.",
  ACCOUNTBOOK_OUTCOME_UNKNOWN:
    "가계부 변경 결과를 확인할 수 없습니다. 등록·수정·삭제를 다시 보내기 전에 내역을 조회해 주세요.",
  ACCOUNTBOOK_INVALID_RESPONSE:
    "가계부 응답 형식을 확인할 수 없습니다. 변경 요청을 반복하지 말고 내역을 조회해 주세요.",
  ACCOUNTBOOK_CONFIG: "가계부 API 주소와 연동 토큰 설정을 확인해 주세요.",
} as const;

export class AccountbookError extends Error {
  constructor(
    public readonly code: keyof typeof messages,
    public readonly status?: number,
  ) {
    super(messages[code]);
  }
}

export function safeError(error: unknown): { code: string; message: string } {
  if (error instanceof AccountbookError) return { code: error.code, message: error.message };
  return {
    code: "ACCOUNTBOOK_INTERNAL",
    message: "가계부 요청을 처리하지 못했습니다. 요청 내용을 확인해 주세요.",
  };
}

export class AccountbookClient {
  private readonly baseUrl: string;
  constructor(
    config: { apiBaseUrl: string; apiToken: string },
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    try {
      const url = new URL(config.apiBaseUrl);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !/^\/.*api\/v1\/?$/.test(url.pathname)
      ) {
        throw new Error();
      }
      this.baseUrl = url.href.replace(/\/+$/, "");
    } catch {
      throw new AccountbookError("ACCOUNTBOOK_CONFIG");
    }
    if (!/^fab_[A-Za-z0-9_-]{43}$/.test(config.apiToken))
      throw new AccountbookError("ACCOUNTBOOK_CONFIG");
    this.token = config.apiToken;
  }
  private readonly token: string;

  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    // Do not follow redirects: a connector credential belongs to this origin only.
    // A change request that failed after it may have been sent is not a plain failure;
    // fos-assistant records it as outcome_unknown so nobody retries a write that went through.
    const write = method !== "GET";
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new AccountbookError(write ? "ACCOUNTBOOK_OUTCOME_UNKNOWN" : "ACCOUNTBOOK_NETWORK");
    }
    if (!response.ok) {
      const code =
        response.status === 401
          ? "ACCOUNTBOOK_UNAUTHORIZED"
          : response.status === 403
            ? "ACCOUNTBOOK_FORBIDDEN"
            : response.status === 404
              ? "ACCOUNTBOOK_NOT_FOUND"
              : response.status < 500
                ? "ACCOUNTBOOK_BAD_REQUEST"
                : write
                  ? "ACCOUNTBOOK_OUTCOME_UNKNOWN"
                  : "ACCOUNTBOOK_UNAVAILABLE";
      throw new AccountbookError(code, response.status);
    }
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new AccountbookError(
        write ? "ACCOUNTBOOK_OUTCOME_UNKNOWN" : "ACCOUNTBOOK_INVALID_RESPONSE",
      );
    }
  }
}
