import type { NextFunction, Request, RequestHandler, Response } from "express";

/** 본문을 읽는 method. 전환 전 구현이 멱등 키를 요구하던 집합과 같다. */
export const BODY_METHODS: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const RAW_BODY = Symbol.for("recommendation-api.rawBody");

export type RawBody = {
  bytes: Buffer;
  /** 본문이 상한을 넘었다. `bytes` 는 상한까지만 담는다. */
  exceededLimit: boolean;
};

type RequestWithRawBody = Request & { [RAW_BODY]?: RawBody };

/**
 * 본문을 파싱하지 않고 원문 그대로 모은다.
 *
 * 파싱과 크기 판정을 middleware 에서 하지 않는 이유는 순서다.
 * 전환 전 구현은 멱등 키를 먼저 요구하고 그다음에 본문을 읽었다.
 * 그 순서를 지키려면 판정이 interceptor 안에 있어야 한다.
 */
export function createRawBodyMiddleware(maxBodyBytes: number): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!BODY_METHODS.has(request.method)) {
      next();
      return;
    }
    const declared = Number(request.headers["content-length"] ?? "0");
    let exceededLimit = Number.isFinite(declared) && declared > maxBodyBytes;
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      if (error) {
        next(error);
        return;
      }
      (request as RequestWithRawBody)[RAW_BODY] = {
        bytes: Buffer.concat(chunks),
        exceededLimit,
      };
      next();
    };
    request.on("data", (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > maxBodyBytes) {
        exceededLimit = true;
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => finish());
    request.on("error", (error: Error) => finish(error));
  };
}

export function rawBodyOf(request: unknown): RawBody | undefined {
  return (request as RequestWithRawBody | undefined)?.[RAW_BODY];
}
