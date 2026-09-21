import type { RecommendationApiConfig } from "./config.ts";
import { errorResponse, jsonResponse } from "./http/errors.ts";
import type { ReceiptStore } from "./http/idempotency.ts";
import { authorize, readJson, requestId, requireIdempotencyKey } from "./http/request.ts";
import type { PositionService } from "./position/service.ts";
import { routePositions } from "./routes/positions.ts";

export type AppDependencies = {
  config: RecommendationApiConfig;
  positionService: PositionService;
  receipts: ReceiptStore;
  readiness?: () => Promise<boolean>;
};

export function createApp(dependencies: AppDependencies) {
  return async (request: Request): Promise<Response> => {
    const id = requestId(request);
    try {
      const url = new URL(request.url);
      if (url.pathname === "/health/live" && request.method === "GET") {
        return jsonResponse({ ok: true }, 200, id);
      }
      if (url.pathname === "/health/ready" && request.method === "GET") {
        const ready = await (dependencies.readiness?.() ?? Promise.resolve(true));
        return jsonResponse({ ok: ready }, ready ? 200 : 503, id);
      }
      authorize(request, dependencies.config.apiToken);
      if (url.pathname === "/api/v1/auth/check" && request.method === "GET") {
        return new Response(null, {
          status: 204,
          headers: { "Cache-Control": "no-store", "X-Request-Id": id },
        });
      }
      let routedRequest = request;
      let idempotencyKey: string | undefined;
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        idempotencyKey = requireIdempotencyKey(request);
        const body = await readJson(request, dependencies.config.maxBodyBytes);
        routedRequest = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(body),
        });
      }
      const result = await routePositions(
        routedRequest,
        url.pathname,
        dependencies.positionService,
        dependencies.receipts,
        idempotencyKey,
      );
      return result
        ? jsonResponse(result.body, result.status, id)
        : jsonResponse(
            { error: { code: "NOT_FOUND", message: "경로를 찾을 수 없습니다.", requestId: id } },
            404,
            id,
          );
    } catch (error) {
      return errorResponse(error, id);
    }
  };
}
