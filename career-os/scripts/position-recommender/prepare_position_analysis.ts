#!/usr/bin/env bun
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runCli, type CliSpec } from "../lib/cli.ts";
import { postingCandidatePoolSchema } from "./live-postings/contracts.ts";
import type { RecommendationApiClient } from "./recommendation-api/client.ts";
import { createRecommendationApiClient } from "./recommendation-api/client.ts";

type PreparationClient = Pick<
  RecommendationApiClient,
  "saveCollection" | "createPositionAnalysisRun"
>;
type ClientFactory = () => PreparationClient;

export async function preparePositionAnalysis(
  candidatesPath: string,
  companyTierQueueOutputPath: string,
  analysisQueueOutputPath: string,
  contractVersion = 1,
  companyTierContractVersion = 1,
  createClient: ClientFactory = createRecommendationApiClient,
) {
  const resolvedCandidates = resolve(candidatesPath);
  const pool = postingCandidatePoolSchema.parse(
    JSON.parse(readFileSync(resolvedCandidates, "utf8")) as unknown,
  );
  const client = createClient();
  const preparation = await client.saveCollection(
    {
      schemaVersion: 2,
      analysisContractVersion: contractVersion,
      companyTierContractVersion,
      pool,
    },
    `collection:${pool.collectionRunId}`,
  );
  const companyTierQueue = preparation.companyTierQueue;
  const hasCompanyTierQueue = companyTierQueue.companies.length > 0;
  const analysisQueue = hasCompanyTierQueue
    ? undefined
    : await client.createPositionAnalysisRun(
        pool.collectionRunId,
        `analysis-run:${pool.collectionRunId}`,
      );
  const resolvedOutput = resolve(
    hasCompanyTierQueue ? companyTierQueueOutputPath : analysisQueueOutputPath,
  );
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  const serialized = `${JSON.stringify(hasCompanyTierQueue ? companyTierQueue : analysisQueue, null, 2)}\n`;
  writeFileSync(resolvedOutput, serialized, "utf8");
  return {
    passed: true,
    collectionRunId: pool.collectionRunId,
    companyTierRunId: companyTierQueue.companyTierRunId,
    companyTierQueuedCount: companyTierQueue.companies.length,
    analysisRunId: analysisQueue?.analysisRunId ?? null,
    candidatePoolBytes: statSync(resolvedCandidates).size,
    candidateCount: pool.candidates.length,
    queueBodyBytes: Buffer.byteLength(serialized),
    ...(analysisQueue?.summary ?? preparation.summary),
    output: resolvedOutput,
  };
}

const spec: CliSpec = {
  name: "prepare_position_analysis.ts",
  summary: "후보풀을 Backend에 저장하고 제한된 분석 큐를 만든다.",
  options: {
    "--candidates": { value: true, description: "수집 후보풀 JSON" },
    "--company-tier-queue-output": {
      value: true,
      description: "회사 tier 큐가 있을 때 남길 JSON 출력",
    },
    "--analysis-queue-output": {
      value: true,
      description: "회사 tier 큐가 비었을 때 남길 분석 큐 JSON 출력",
    },
    "--contract-version": {
      value: true,
      description: "분석 계약 버전",
      pattern: /^\d+$/,
      fallback: "1",
    },
    "--company-tier-contract-version": {
      value: true,
      description: "회사 tier 평가 계약 버전",
      pattern: /^\d+$/,
      fallback: "1",
    },
  },
};

if (import.meta.main) {
  await runCli(spec, async ({ options }) => {
    const candidatesPath = options["--candidates"];
    const companyTierQueueOutputPath = options["--company-tier-queue-output"];
    const analysisQueueOutputPath = options["--analysis-queue-output"];
    if (
      typeof candidatesPath !== "string" ||
      typeof companyTierQueueOutputPath !== "string" ||
      typeof analysisQueueOutputPath !== "string"
    ) {
      throw new Error(
        "--candidates, --company-tier-queue-output과 --analysis-queue-output이 필요합니다.",
      );
    }
    return preparePositionAnalysis(
      candidatesPath,
      companyTierQueueOutputPath,
      analysisQueueOutputPath,
      Number(options["--contract-version"]),
      Number(options["--company-tier-contract-version"]),
    );
  });
}
