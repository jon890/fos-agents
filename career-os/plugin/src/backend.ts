import type { z } from "zod";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** Hermes leaves `${NAME}` in place when a variable is unset; treat that as absent. */
export function configuredValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return !trimmed || trimmed.startsWith("${") ? undefined : trimmed;
}

// Fixed, human-facing messages. Never include Backend or GitHub response bodies,
// tokens, or document bodies here.
const messages = {
  CAREER_CONFIG: "커리어 Backend 주소와 token, 프로필 저장소 설정을 확인해 주세요.",
  CAREER_UNAUTHORIZED: "커리어 Backend 가 token 을 거절했습니다. 연결 설정의 token 을 확인해 주세요.",
  CAREER_NOT_FOUND: "문서를 찾을 수 없습니다. 아직 만들지 않은 문서입니다.",
  CAREER_VERSION_CONFLICT: "문서가 그 사이 바뀌었습니다. 문서를 다시 읽은 뒤 저장해 주세요.",
  CAREER_BAD_REQUEST: "커리어 Backend 가 요청 값을 받지 않았습니다. 요청 값을 확인해 주세요.",
  CAREER_UNAVAILABLE: "커리어 Backend 가 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요.",
  CAREER_NETWORK:
    "커리어 Backend 연결 결과를 확인할 수 없습니다. 저장을 다시 보내기 전에 문서를 다시 읽어 확인해 주세요.",
  CAREER_INVALID_RESPONSE: "응답 형식을 확인할 수 없습니다. 요청을 반복하지 말고 문서를 다시 읽어 확인해 주세요.",
  CAREER_INVALID_INPUT: "도구 입력을 확인해 주세요.",
  CAREER_USAGE_MONTH_MISSING: "고른 달 가운데 사용량 기록이 없는 달이 있습니다.",
  CAREER_BADGE_MISMATCH: "README 의 Tokens 배지가 사용량 기록의 합계와 맞지 않습니다.",
  CAREER_GITHUB_NOT_CONFIGURED: "GitHub token 이 설정되지 않았습니다. 연결 설정에서 GitHub token 을 넣어 주세요.",
  CAREER_GITHUB_UNAUTHORIZED: "GitHub 가 token 을 거절했습니다. 연결 설정의 GitHub token 을 확인해 주세요.",
  CAREER_GITHUB_FORBIDDEN: "GitHub token 에 프로필 저장소 권한이 없거나 저장소 이름이 틀립니다.",
  CAREER_GITHUB_CONFLICT: "그 사이 프로필 저장소에 다른 커밋이 올라왔습니다. 다시 읽은 뒤 갱신해 주세요.",
  CAREER_GITHUB_UNAVAILABLE: "GitHub 가 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요.",
  CAREER_UNKNOWN_TOOL: "지원하지 않는 도구입니다.",
  CAREER_INTERNAL: "커리어 요청을 처리하지 못했습니다. 요청 내용을 확인해 주세요.",
} as const;

export type CareerErrorCode = keyof typeof messages;

export class CareerError extends Error {
  constructor(
    readonly code: CareerErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(messages[code]);
  }
}

export function safeError(error: unknown): { code: string; message: string } {
  if (error instanceof CareerError) return { code: error.code, message: error.message };
  return { code: "CAREER_INTERNAL", message: messages.CAREER_INTERNAL };
}

function statusCode(status: number): CareerErrorCode {
  if (status === 401 || status === 403) return "CAREER_UNAUTHORIZED";
  if (status === 404) return "CAREER_NOT_FOUND";
  if (status === 409) return "CAREER_VERSION_CONFLICT";
  if (status < 500) return "CAREER_BAD_REQUEST";
  return "CAREER_UNAVAILABLE";
}

export class CareerBackend {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(
    config: { baseUrl: string; token: string },
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    let url: URL;
    try {
      url = new URL(config.baseUrl);
    } catch {
      throw new CareerError("CAREER_CONFIG");
    }
    // Same origin rule as the laptop CLI: an origin only, no credentials, query, hash, or path.
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      throw new CareerError("CAREER_CONFIG");
    const token = config.token.trim();
    if (token.length < 32) throw new CareerError("CAREER_CONFIG");
    this.baseUrl = url.href;
    this.token = token;
  }

  async request<T>(
    method: "GET" | "PUT",
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (idempotencyKey !== undefined) headers["Idempotency-Key"] = idempotencyKey;
    // No retries: the verify tool has a 10 second budget, and a write must not be resent blindly.
    // No redirects: the token belongs to this origin only.
    let response: Response;
    try {
      response = await this.fetchImpl(new URL(path, this.baseUrl), {
        method,
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new CareerError("CAREER_NETWORK");
    }
    if (!response.ok) throw new CareerError(statusCode(response.status));
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new CareerError("CAREER_INVALID_RESPONSE");
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new CareerError("CAREER_INVALID_RESPONSE");
    return parsed.data;
  }
}
