import { z } from "zod";

const responseErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export class CareerBackendHttpError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CareerBackendHttpError";
  }
}

export type CareerBackendHttpOptions = {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  fetcher?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
};

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
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const headers = new Headers({ Authorization: `Bearer ${options.token}` });
      if (serialized !== undefined) headers.set("Content-Type", "application/json");
      if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
      const response = await fetcher(new URL(path, options.baseUrl), {
        method,
        headers,
        body: serialized,
        signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
      });
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        const error = new CareerBackendHttpError(
          response.status,
          "INVALID_RESPONSE",
          "커리어 Backend 응답을 읽을 수 없습니다.",
        );
        if (response.status < 500 || attempt === 2) throw error;
        lastError = error;
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
        parsed.success ? parsed.data.error.message : "커리어 Backend 요청이 실패했습니다.",
      );
      if (response.status < 500 || attempt === 2) throw error;
      lastError = error;
    } catch (error) {
      if (error instanceof CareerBackendHttpError && error.status !== null && error.status < 500)
        throw error;
      lastError = error;
      if (attempt === 2) break;
    }
  }
  throw lastError instanceof CareerBackendHttpError
    ? lastError
    : new CareerBackendHttpError(null, "NETWORK_ERROR", "커리어 Backend에 연결하지 못했습니다.");
}
