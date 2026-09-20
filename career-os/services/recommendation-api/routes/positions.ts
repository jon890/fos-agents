import { ZodError } from "zod";
import type { ReceiptStore } from "../http/idempotency.ts";
import { idempotent } from "../http/idempotency.ts";
import { ApiError } from "../http/errors.ts";
import {
  analysisResultsResponseSchema,
  companyTierResultsResponseSchema,
} from "../position/schema.ts";
import type { PositionService } from "../position/service.ts";

type RouteResult = { status: number; body: unknown };

function contractError(error: unknown): never {
  if (error instanceof ZodError) {
    throw new ApiError(
      400,
      "BAD_REQUEST",
      error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    );
  }
  throw error;
}

async function call(action: () => Promise<unknown>, status = 200): Promise<RouteResult> {
  try {
    return { status, body: await action() };
  } catch (error) {
    return contractError(error);
  }
}

export async function routePositions(
  request: Request,
  pathname: string,
  service: PositionService,
  receipts: ReceiptStore,
  idempotencyKey: string | undefined,
): Promise<RouteResult | undefined> {
  if (request.method === "POST" && pathname === "/api/positions/v1/collection-runs") {
    if (!idempotencyKey) throw new ApiError(400, "BAD_REQUEST", "Idempotency-Key가 필요합니다.");
    const body = await request.json();
    return idempotent(receipts, idempotencyKey, body, () =>
      call(() => service.saveCollection(body), 201),
    );
  }

  const analysisRuns = pathname.match(
    /^\/api\/positions\/v1\/collection-runs\/([^/]+)\/analysis-runs$/,
  );
  if (request.method === "POST" && analysisRuns) {
    if (!idempotencyKey) throw new ApiError(400, "BAD_REQUEST", "Idempotency-Key가 필요합니다.");
    const body = await request.json();
    return idempotent(receipts, idempotencyKey, body, () =>
      call(() => service.createPositionAnalysisRun(decodeURIComponent(analysisRuns[1])), 201),
    );
  }

  const companyTierResults = pathname.match(
    /^\/api\/positions\/v1\/company-tier-runs\/([^/]+)\/results$/,
  );
  if (request.method === "POST" && companyTierResults) {
    if (!idempotencyKey) throw new ApiError(400, "BAD_REQUEST", "Idempotency-Key가 필요합니다.");
    const body = await request.json();
    return idempotent(receipts, idempotencyKey, body, () =>
      call(async () =>
        companyTierResultsResponseSchema.parse(
          await service.saveCompanyTierResults(decodeURIComponent(companyTierResults[1]), body),
        ),
      ),
    );
  }

  const analysisResults = pathname.match(/^\/api\/positions\/v1\/analysis-runs\/([^/]+)\/results$/);
  if (request.method === "POST" && analysisResults) {
    if (!idempotencyKey) throw new ApiError(400, "BAD_REQUEST", "Idempotency-Key가 필요합니다.");
    const body = await request.json();
    return idempotent(receipts, idempotencyKey, body, () =>
      call(async () =>
        analysisResultsResponseSchema.parse(
          await service.saveAnalysisResults(decodeURIComponent(analysisResults[1]), body),
        ),
      ),
    );
  }

  if (request.method === "POST" && pathname === "/api/positions/v1/recommendation-runs") {
    if (!idempotencyKey) throw new ApiError(400, "BAD_REQUEST", "Idempotency-Key가 필요합니다.");
    const body = (await request.json()) as { analysisRunId?: unknown };
    return idempotent(receipts, idempotencyKey, body, () => {
      if (typeof body.analysisRunId !== "string") {
        throw new ApiError(400, "BAD_REQUEST", "analysisRunId가 필요합니다.");
      }
      const analysisRunId = body.analysisRunId;
      return call(() => service.createRecommendation(analysisRunId), 201);
    });
  }

  const run = pathname.match(/^\/api\/positions\/v1\/runs\/([^/]+)$/);
  if (request.method === "GET" && run) {
    return call(() => service.getRun(decodeURIComponent(run[1])));
  }

  if (pathname === "/api/positions/v1/analysis-policy" && request.method === "PUT") {
    if (!idempotencyKey) throw new ApiError(400, "BAD_REQUEST", "Idempotency-Key가 필요합니다.");
    const body = await request.json();
    return idempotent(receipts, idempotencyKey, body, () =>
      call(() => service.configurePolicy(body)),
    );
  }

  if (pathname === "/api/positions/v1/company-preferences" && request.method === "GET") {
    return call(() => service.listCompanyPreferences());
  }

  const companyPreference = pathname.match(/^\/api\/positions\/v1\/company-preferences\/([^/]+)$/);
  if (request.method === "PUT" && companyPreference) {
    if (!idempotencyKey) throw new ApiError(400, "BAD_REQUEST", "Idempotency-Key가 필요합니다.");
    const body = await request.json();
    return idempotent(receipts, idempotencyKey, body, () =>
      call(() => service.updateCompanyPreference(decodeURIComponent(companyPreference[1]), body)),
    );
  }
  return undefined;
}
