import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { from, of, throwError, type Observable } from "rxjs";
import { catchError, switchMap } from "rxjs/operators";

import type { RecommendationApiConfig } from "../../config/config.js";
import { RECOMMENDATION_CONFIG } from "../../config/config.module.js";
import { ApiError } from "../api-error.js";
import { BODY_METHODS, rawBodyOf } from "../raw-body.middleware.js";
import { canonicalRequestHash } from "./request-hash.js";
import { ReceiptRepository, type StoredResponse } from "./receipt.repository.js";

/** `Idempotency-Key` 헤더가 가질 수 있는 최대 길이. */
const MAX_KEY_LENGTH = 200;

type Replay = { kind: "replay"; response: StoredResponse };
type Proceed = { kind: "proceed"; key: string; requestHash: string };

/**
 * 쓰기 요청의 멱등 흐름을 소유한다.
 *
 * 키 확인, 본문 크기와 JSON 검사, 요청 해시, 선점, 처리, 응답 저장이 한자리에 있다.
 * controller 마다 흩어 놓으면 endpoint 를 더할 때 빠뜨린다.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly receipts: ReceiptRepository,
    @Inject(RECOMMENDATION_CONFIG) private readonly config: RecommendationApiConfig,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    if (!BODY_METHODS.has(request.method)) return next.handle();

    const key = this.requireKey(request);
    const body = this.readBody(request);
    request.body = body;
    const requestHash = canonicalRequestHash(body);

    return from(this.claim(key, requestHash)).pipe(
      switchMap((decision) => {
        if (decision.kind === "replay") {
          http.getResponse<Response>().status(decision.response.status);
          return of(decision.response.body);
        }
        return this.runAndStore(context, next, decision);
      }),
    );
  }

  private requireKey(request: Request): string {
    const header = request.headers["idempotency-key"];
    const value = (Array.isArray(header) ? header[0] : header)?.trim();
    if (!value || value.length > MAX_KEY_LENGTH) {
      throw new ApiError(400, "BAD_REQUEST", "Idempotency-Key가 필요합니다.");
    }
    return value;
  }

  private readBody(request: Request): unknown {
    const raw = rawBodyOf(request);
    if (!raw) {
      throw new ApiError(400, "BAD_REQUEST", "JSON 요청 본문이 올바르지 않습니다.");
    }
    if (raw.exceededLimit || raw.bytes.byteLength > this.config.maxBodyBytes) {
      throw new ApiError(400, "BODY_TOO_LARGE", "요청 본문이 허용 크기를 넘었습니다.");
    }
    try {
      return JSON.parse(raw.bytes.toString("utf8")) as unknown;
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "JSON 요청 본문이 올바르지 않습니다.");
    }
  }

  private async claim(key: string, requestHash: string): Promise<Replay | Proceed> {
    const existing = await this.receipts.getReceipt(key);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "같은 멱등 키에 다른 요청 본문이 왔습니다.");
      }
      if (existing.state === "completed" && existing.response) {
        return { kind: "replay", response: existing.response };
      }
      throw new ApiError(409, "VERSION_CONFLICT", "같은 요청이 처리 중입니다.");
    }
    if (!(await this.receipts.startReceipt(key, requestHash))) {
      throw new ApiError(409, "VERSION_CONFLICT", "같은 요청이 처리 중입니다.");
    }
    return { kind: "proceed", key, requestHash };
  }

  private runAndStore(
    context: ExecutionContext,
    next: CallHandler,
    claimed: Proceed,
  ): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      switchMap((value) =>
        from(
          this.receipts.completeReceipt(claimed.key, claimed.requestHash, {
            status: response.statusCode,
            body: value ?? null,
          }),
        ).pipe(switchMap(() => of(value))),
      ),
      // 선점을 지운 것을 확인한 뒤에 오류를 올린다.
      // 기다리지 않으면 응답을 받은 client 가 재시도할 때 `processing` 행이 남아 있을 수 있다.
      catchError((error: unknown) =>
        from(this.receipts.abandonReceipt(claimed.key, claimed.requestHash)).pipe(
          switchMap(() => throwError(() => error)),
        ),
      ),
    );
  }
}
