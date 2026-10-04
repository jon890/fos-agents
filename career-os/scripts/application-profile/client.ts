import {
  APPLICATION_PROFILE_COLLECTION,
  APPLICATION_PROFILE_DOCUMENT_KEY,
  applicationProfileResponseSchema,
  type ApplicationProfileDocument,
} from "./contracts.ts";

export type FosAssistantConnection = { baseUrl: string; token: string };

const originRuleMessage = "FOS_ASSISTANT_URL은 credentials, query, hash, path 없는 HTTP 또는 HTTPS origin이어야 한다.";

/** `parseCareerBackendOrigin` 과 같은 origin 규칙이다. 오류 문구가 FOS_ASSISTANT_URL 을 말하도록 따로 둔다. */
function parseFosAssistantOrigin(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(originRuleMessage);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error(originRuleMessage);
  }
  return url;
}

/** 토큰 형식은 fos-assistant 의 계약이라 길이를 검사하지 않는다. 틀리면 401 이 알린다. */
export function resolveFosAssistantConnection(
  environment: Record<string, string | undefined> = process.env,
): FosAssistantConnection {
  const rawUrl = environment.FOS_ASSISTANT_URL?.trim();
  if (!rawUrl) throw new Error("FOS_ASSISTANT_URL 환경값이 필요하다. career-os/.env 에 채운다.");
  const baseUrl = parseFosAssistantOrigin(rawUrl).origin;
  const token = environment.FOS_ASSISTANT_SERVICE_TOKEN?.trim();
  if (!token) throw new Error("FOS_ASSISTANT_SERVICE_TOKEN 환경값이 필요하다. career-os/.env 에 채운다.");
  return { baseUrl, token };
}

/** 메시지는 고정 문구만 담는다. 응답 본문, 서버 message, 문서 본문과 토큰은 담지 않는다. */
export class ApplicationProfileHttpError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApplicationProfileHttpError";
  }
}

const requestFailedMessage = "fos-assistant 요청이 실패했다.";
const networkError = () => new ApplicationProfileHttpError(null, "NETWORK_ERROR", "fos-assistant 에 연결하지 못했다.");
const invalidResponse = (status: number) =>
  new ApplicationProfileHttpError(status, "INVALID_RESPONSE", "fos-assistant 응답 계약이 올바르지 않다.");

export type ApplicationProfileFetch = (input: URL, init: RequestInit) => Promise<Response>;

export type ReadApplicationProfileOptions = {
  connection?: FosAssistantConnection;
  fetchImpl?: ApplicationProfileFetch;
  timeoutMs?: number;
  maxRetries?: number;
};

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // 본문 취소 실패는 판정에 쓰지 않으므로 요청 실패로 키우지 않는다.
  }
}

/** 서버 code 는 stderr 로 나가므로 식별자 모양일 때만 쓴다. */
const serverCodePattern = /^[A-Z0-9_]{1,64}$/;

/** 실패 응답의 본문에서 `code` 만 읽는다. 읽지 못하거나 식별자 모양이 아니면 undefined 다. */
async function errorCodeOf(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    const code = body && typeof body === "object" ? (body as { code?: unknown }).code : undefined;
    if (typeof code === "string" && serverCodePattern.test(code)) return code;
  } catch {
    // 401 과 403 처럼 본문이 없거나 JSON 이 아니면 상태 번호만으로 판정한다.
  }
  return undefined;
}

function clientError(status: number, code: string | undefined): ApplicationProfileHttpError {
  if (status === 401) {
    return new ApplicationProfileHttpError(
      status,
      "UNAUTHORIZED",
      "서비스 토큰이 거절됐다. fos-assistant 웹 화면에서 identity 를 받는 토큰을 새로 발급해 career-os/.env 의 FOS_ASSISTANT_SERVICE_TOKEN 을 바꾼다.",
    );
  }
  if (status === 403) {
    return new ApplicationProfileHttpError(
      status,
      "FORBIDDEN",
      "fos-assistant 가 요청을 거절했다. 요청에 Origin 머리말이 붙지 않았는지 CLI 를 확인한다.",
    );
  }
  if (status === 404) {
    return new ApplicationProfileHttpError(
      status,
      code ?? "MEMORY_NOT_FOUND",
      "지원서 공통 프로필을 찾지 못했다. fos-assistant 웹 화면에서 identity 의 민감 문서 career-application-profile 이 있는지, 토큰이 identity 의 민감 읽기를 받는지 확인한다.",
    );
  }
  if (status === 409 && code === "MEMORY_ENCRYPTION_UNAVAILABLE") {
    return new ApplicationProfileHttpError(status, code, "fos-assistant 에 민감 본문을 풀 key 가 없다. fos-assistant 운영자에게 알린다.");
  }
  return new ApplicationProfileHttpError(status, code ?? "HTTP_ERROR", requestFailedMessage);
}

/**
 * fos-assistant Memory 의 서비스 읽기 API 로 지원서 공통 프로필을 읽는다.
 * 5xx, 연결 실패와 timeout 만 다시 시도하고 4xx 와 응답 계약 위반은 바로 던진다.
 */
export async function readApplicationProfile(
  options: ReadApplicationProfileOptions = {},
): Promise<{ document: ApplicationProfileDocument; tokenExpiresAt: string | null }> {
  const connection = options.connection ?? resolveFosAssistantConnection(process.env);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxRetries = options.maxRetries ?? 2;
  const url = new URL(
    `/api/v1/service/memory-documents/${APPLICATION_PROFILE_COLLECTION}/${APPLICATION_PROFILE_DOCUMENT_KEY}`,
    connection.baseUrl,
  );

  let lastError: ApplicationProfileHttpError = networkError();
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response: Response;
    try {
      // Origin 머리말이 있으면 fos-assistant 가 403 으로 거절하므로 두 머리말만 보낸다.
      response = await fetchImpl(url, {
        method: "GET",
        headers: new Headers({ Authorization: `Bearer ${connection.token}`, Accept: "application/json" }),
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      lastError = networkError();
      continue;
    }

    if (response.status >= 500) {
      await cancelBody(response);
      lastError = new ApplicationProfileHttpError(response.status, "HTTP_ERROR", requestFailedMessage);
      continue;
    }
    if (!response.ok) throw clientError(response.status, await errorCodeOf(response));

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      if (error instanceof SyntaxError) throw invalidResponse(response.status);
      // 본문 스트림이 끊기면 연결 실패와 같이 다시 시도한다.
      lastError = networkError();
      continue;
    }
    const parsed = applicationProfileResponseSchema.safeParse(json);
    if (!parsed.success) throw invalidResponse(response.status);
    return { document: parsed.data, tokenExpiresAt: response.headers.get("X-Service-Token-Expires-At") };
  }
  throw lastError;
}
