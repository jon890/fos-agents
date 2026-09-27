import { z } from "zod";

const responseErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string().optional() }),
});

export class CareerBackendHttpError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "CareerBackendHttpError";
  }
}

export type CareerBackendHttpOptions = {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetcher?: (input: URL, init: RequestInit) => Promise<Response>;
};

function retryAfterOf(response: Response): number | undefined {
  if (response.status !== 429) return undefined;
  const value = response.headers.get("Retry-After")?.trim();
  if (!value || !/^\d+$/.test(value)) return undefined;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) ? seconds : undefined;
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // 다음 재시도가 가능한 응답 본문 취소 실패는 요청 실패로 확대하지 않는다.
  }
}

export async function careerBackendRequest<T>(
  options: CareerBackendHttpOptions,
  method: "GET" | "POST" | "PUT",
  path: string,
  body: unknown,
  idempotencyKey: string | undefined,
  schema: z.ZodType<T>,
): Promise<T> {
  const fetcher = options.fetcher ?? fetch;
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  const maxRetries = options.maxRetries ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const headers = new Headers({ Authorization: `Bearer ${options.token}`, Accept: "application/json" });
      if (serialized !== undefined) headers.set("Content-Type", "application/json");
      if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
      const response = await fetcher(new URL(path, options.baseUrl), {
        method,
        headers,
        body: serialized,
        redirect: "error",
        signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
      });
      if (!response.ok && response.status >= 500 && attempt < maxRetries) {
        await cancelBody(response);
        lastError = new CareerBackendHttpError(
          response.status,
          "HTTP_ERROR",
          "커리어 Backend 요청이 실패했습니다.",
        );
        continue;
      }
      let json: unknown;
      try {
        json = await response.json();
      } catch (error) {
        if (!(error instanceof SyntaxError) && attempt < maxRetries) {
          lastError = error;
          continue;
        }
        const responseError = new CareerBackendHttpError(
          response.status,
          error instanceof SyntaxError ? "INVALID_RESPONSE" : "NETWORK_ERROR",
          error instanceof SyntaxError
            ? "커리어 Backend 응답을 읽을 수 없습니다."
            : "커리어 Backend에 연결하지 못했습니다.",
        );
        if (response.status < 500 || attempt === maxRetries) throw responseError;
        lastError = responseError;
        continue;
      }
      if (response.ok) {
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          throw new CareerBackendHttpError(
            response.status,
            "INVALID_RESPONSE",
            "커리어 Backend 응답 계약이 올바르지 않습니다.",
          );
        }
        return parsed.data;
      }
      const parsed = responseErrorSchema.safeParse(json);
      const error = new CareerBackendHttpError(
        response.status,
        parsed.success ? parsed.data.error.code : "HTTP_ERROR",
        "커리어 Backend 요청이 실패했습니다.",
        parsed.success ? parsed.data.error.requestId : undefined,
        retryAfterOf(response),
      );
      if (response.status < 500 || attempt === maxRetries) throw error;
      lastError = error;
    } catch (error) {
      if (error instanceof CareerBackendHttpError && error.status !== null && error.status < 500)
        throw error;
      lastError = error;
      if (attempt === maxRetries) break;
    }
  }
  throw lastError instanceof CareerBackendHttpError
    ? lastError
    : new CareerBackendHttpError(null, "NETWORK_ERROR", "커리어 Backend에 연결하지 못했습니다.");
}
