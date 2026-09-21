#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runCli, type CliSpec } from "../lib/cli.ts";
import { canonicalRequestHash } from "../../services/recommendation-api/http/idempotency.ts";
import {
  companyTierQueueFileSchema,
  companyTierUpdatesInputSchema,
} from "./company-tier-analysis/schema.ts";
import type { RecommendationApiClient } from "./recommendation-api/client.ts";
import { createRecommendationApiClient } from "./recommendation-api/client.ts";

type CompanyTierClient = Pick<
  RecommendationApiClient,
  "saveCompanyTierResults" | "createPositionAnalysisRun"
>;
type ClientFactory = () => CompanyTierClient;

function joinKeys(keys: string[]): string {
  return keys.length === 0 ? "없음" : keys.join(", ");
}

export async function completeCompanyTierAssessment(
  queuePath: string,
  inputPath: string,
  analysisQueueOutputPath: string,
  createClient: ClientFactory = createRecommendationApiClient,
) {
  const queue = companyTierQueueFileSchema.parse(
    JSON.parse(readFileSync(resolve(queuePath), "utf8")) as unknown,
  );
  const updates = companyTierUpdatesInputSchema.parse(
    JSON.parse(readFileSync(resolve(inputPath), "utf8")) as unknown,
  );
  if (
    updates.collectionRunId !== queue.collectionRunId ||
    updates.companyTierRunId !== queue.companyTierRunId
  ) {
    throw new Error("회사 tier 갱신의 실행 ID가 준비 큐와 다릅니다.");
  }
  const open = queue.companies.map((company) => company.companyKey);
  const submitted = [
    ...updates.results.map((result) => result.companyKey),
    ...updates.failures.map((failure) => failure.companyKey),
  ];
  const duplicated = [
    ...new Set(submitted.filter((key, index) => submitted.indexOf(key) !== index)),
  ];
  if (duplicated.length > 0) {
    throw new Error(`평가 결과와 실패 보고에 같은 회사가 함께 있습니다: ${joinKeys(duplicated)}`);
  }
  const missing = open.filter((key) => !submitted.includes(key));
  const unexpected = submitted.filter((key) => !open.includes(key));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `큐와 제출 목록이 다릅니다. 빠진 회사: ${joinKeys(missing)}, 큐에 없는 회사: ${joinKeys(unexpected)}`,
    );
  }
  const body = {
    schemaVersion: 1 as const,
    collectionRunId: queue.collectionRunId,
    results: updates.results,
    failures: updates.failures,
  };
  const idempotencyKey = `company-tier-results:${queue.companyTierRunId}:${canonicalRequestHash(body).slice(7, 23)}`;
  const client = createClient();
  const result = await client.saveCompanyTierResults(queue.companyTierRunId, body, idempotencyKey);

  let analysisRunId: string | null = null;
  let analysisQueueOutput: string | null = null;
  if (result.status === "completed" || result.status === "partial") {
    const analysisQueue = await client.createPositionAnalysisRun(
      queue.collectionRunId,
      `analysis-run:${queue.collectionRunId}`,
    );
    analysisRunId = analysisQueue.analysisRunId;
    const resolvedOutput = resolve(analysisQueueOutputPath);
    mkdirSync(dirname(resolvedOutput), { recursive: true });
    writeFileSync(resolvedOutput, `${JSON.stringify(analysisQueue, null, 2)}\n`, "utf8");
    analysisQueueOutput = resolvedOutput;
  }

  return {
    passed: true,
    companyTierRunId: result.companyTierRunId,
    status: result.status,
    createdCount: result.createdCount,
    reusedCount: result.reusedCount,
    failedCount: result.failedCount,
    remainingCount: result.remainingCount,
    applied: result.applied,
    analysisRunId,
    analysisQueueOutput,
  };
}

const spec: CliSpec = {
  name: "complete_company_tier_assessment.ts",
  summary: "회사 tier 평가 결과를 Backend에 반영하고 이어서 공고 분석 큐를 만든다.",
  options: {
    "--queue": { value: true, description: "준비 단계 회사 tier 큐 JSON" },
    "--input": { value: true, description: "모델 회사 tier 평가 갱신 JSON" },
    "--analysis-queue-output": {
      value: true,
      description: "run이 completed 또는 partial일 때 남길 분석 큐 JSON 출력",
    },
  },
};

if (import.meta.main) {
  await runCli(spec, async ({ options }) => {
    const queuePath = options["--queue"];
    const inputPath = options["--input"];
    const analysisQueueOutputPath = options["--analysis-queue-output"];
    if (
      typeof queuePath !== "string" ||
      typeof inputPath !== "string" ||
      typeof analysisQueueOutputPath !== "string"
    ) {
      throw new Error("--queue, --input과 --analysis-queue-output이 필요합니다.");
    }
    return completeCompanyTierAssessment(queuePath, inputPath, analysisQueueOutputPath);
  });
}
