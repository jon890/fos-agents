#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { runCli, type CliSpec } from "../lib/cli.ts";
import {
  analysisQueueResponseSchema,
  analysisUpdateSchema,
} from "../../services/recommendation-api/position/schema.ts";
import { createRecommendationApiClient } from "./recommendation-api/client.ts";

const updatesSchema = z
  .object({
    schemaVersion: z.literal(1),
    collectionRunId: z.string().min(1),
    analysisRunId: z.string().min(1),
    results: z.array(analysisUpdateSchema),
  })
  .strict();

const spec: CliSpec = {
  name: "commit_position_analysis.ts",
  summary: "모델 분석 갱신을 Backend에 원자적으로 반영한다.",
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
    const queue = analysisQueueResponseSchema.parse(
      JSON.parse(readFileSync(resolve(queuePath), "utf8")) as unknown,
    );
    const updates = updatesSchema.parse(
      JSON.parse(readFileSync(resolve(inputPath), "utf8")) as unknown,
    );
    if (
      updates.collectionRunId !== queue.collectionRunId ||
      updates.analysisRunId !== queue.analysisRunId
    ) {
      throw new Error("분석 갱신의 실행 ID가 준비 큐와 다릅니다.");
    }
    const client = createRecommendationApiClient();
    const result = await client.saveAnalysisResults(
      queue.analysisRunId,
      { schemaVersion: 1, collectionRunId: queue.collectionRunId, results: updates.results },
      `analysis-results:${queue.analysisRunId}`,
    );
    return { passed: true, ...result };
  });
}
