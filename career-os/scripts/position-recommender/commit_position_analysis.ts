#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { runCli, type CliSpec } from "../lib/cli.ts";
import { canonicalRequestHash } from "../../services/recommendation-api/http/idempotency.ts";
import {
  analysisFailureSchema,
  analysisQueueResponseSchema,
  analysisUpdateSchema,
} from "../../services/recommendation-api/position/schema.ts";
import type { RecommendationApiClient } from "./recommendation-api/client.ts";
import { createRecommendationApiClient } from "./recommendation-api/client.ts";

export const analysisUpdatesInputSchema = z
  .object({
    schemaVersion: z.literal(2),
    collectionRunId: z.string().min(1),
    analysisRunId: z.string().min(1),
    results: z.array(analysisUpdateSchema).default([]),
    failures: z.array(analysisFailureSchema).default([]),
  })
  .strict();

type AnalysisResultsClient = Pick<RecommendationApiClient, "saveAnalysisResults">;
type ClientFactory = () => AnalysisResultsClient;

function joinIds(ids: string[]): string {
  return ids.length === 0 ? "없음" : ids.join(", ");
}

export async function commitPositionAnalysis(
  queuePath: string,
  inputPath: string,
  createClient: ClientFactory = createRecommendationApiClient,
) {
  const queue = analysisQueueResponseSchema.parse(
    JSON.parse(readFileSync(resolve(queuePath), "utf8")) as unknown,
  );
  const updates = analysisUpdatesInputSchema.parse(
    JSON.parse(readFileSync(resolve(inputPath), "utf8")) as unknown,
  );
  if (
    updates.collectionRunId !== queue.collectionRunId ||
    updates.analysisRunId !== queue.analysisRunId
  ) {
    throw new Error("분석 갱신의 실행 ID가 준비 큐와 다릅니다.");
  }
  const open = queue.candidates
    .filter(
      (candidate) => candidate.resultStatus === "pending" || candidate.resultStatus === "failed",
    )
    .map((candidate) => candidate.positionId);
  const submitted = [
    ...updates.results.map((result) => result.positionId),
    ...updates.failures.map((failure) => failure.positionId),
  ];
  const duplicated = [...new Set(submitted.filter((id, index) => submitted.indexOf(id) !== index))];
  if (duplicated.length > 0) {
    throw new Error(`분석 결과와 실패 보고에 같은 공고가 함께 있습니다: ${joinIds(duplicated)}`);
  }
  const missing = open.filter((id) => !submitted.includes(id));
  const unexpected = submitted.filter((id) => !open.includes(id));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `큐와 제출 목록이 다릅니다. 빠진 공고: ${joinIds(missing)}, 큐에 없는 공고: ${joinIds(unexpected)}`,
    );
  }
  const body = {
    schemaVersion: 2 as const,
    collectionRunId: queue.collectionRunId,
    results: updates.results,
    failures: updates.failures,
  };
  const idempotencyKey = `analysis-results:${queue.analysisRunId}:${canonicalRequestHash(body).slice(7, 23)}`;
  const client = createClient();
  const result = await client.saveAnalysisResults(queue.analysisRunId, body, idempotencyKey);
  return { passed: true, idempotencyKey, ...result };
}

const spec: CliSpec = {
  name: "commit_position_analysis.ts",
  summary: "모델 분석 갱신과 분석하지 못한 공고를 Backend에 원자적으로 반영한다.",
  options: {
    "--queue": { value: true, description: "준비 단계 분석 큐 JSON" },
    "--input": { value: true, description: "모델 분석 갱신 JSON" },
  },
};

if (import.meta.main) {
  await runCli(spec, async ({ options }) => {
    const queuePath = options["--queue"];
    const inputPath = options["--input"];
    if (typeof queuePath !== "string" || typeof inputPath !== "string") {
      throw new Error("--queue와 --input이 필요합니다.");
    }
    return commitPositionAnalysis(queuePath, inputPath);
  });
}
