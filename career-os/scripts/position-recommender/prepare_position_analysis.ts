#!/usr/bin/env bun
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runCli, type CliSpec } from "../lib/cli.ts";
import { postingCandidatePoolSchema } from "./live-postings/contracts.ts";
import { createRecommendationApiClient } from "./recommendation-api/client.ts";

const spec: CliSpec = {
  name: "prepare_position_analysis.ts",
  summary: "후보풀을 Backend에 저장하고 제한된 분석 큐를 만든다.",
  options: {
    "--candidates": { value: true, description: "수집 후보풀 JSON" },
    "--output": { value: true, description: "분석 큐 JSON 출력" },
    "--contract-version": {
      value: true,
      description: "분석 계약 버전",
      pattern: /^\d+$/,
      fallback: "1",
    },
  },
};

if (import.meta.main) {
  await runCli(spec, async ({ options }) => {
    const candidatesPath = options["--candidates"];
    const outputPath = options["--output"];
    if (typeof candidatesPath !== "string" || typeof outputPath !== "string") {
      throw new Error("--candidates와 --output이 필요합니다.");
    }
    const resolvedCandidates = resolve(candidatesPath);
    const pool = postingCandidatePoolSchema.parse(
      JSON.parse(readFileSync(resolvedCandidates, "utf8")) as unknown,
    );
    const client = createRecommendationApiClient();
    const queue = await client.saveCollection(
      {
        schemaVersion: 1,
        analysisContractVersion: Number(options["--contract-version"]),
        pool,
      },
      `collection:${pool.collectionRunId}`,
    );
    const resolvedOutput = resolve(outputPath);
    mkdirSync(dirname(resolvedOutput), { recursive: true });
    const serialized = `${JSON.stringify(queue, null, 2)}\n`;
    writeFileSync(resolvedOutput, serialized, "utf8");
    return {
      passed: true,
      collectionRunId: pool.collectionRunId,
      analysisRunId: queue.analysisRunId,
      candidatePoolBytes: statSync(resolvedCandidates).size,
      candidateCount: pool.candidates.length,
      queueBodyBytes: Buffer.byteLength(serialized),
      ...queue.summary,
      output: resolvedOutput,
    };
  });
}
