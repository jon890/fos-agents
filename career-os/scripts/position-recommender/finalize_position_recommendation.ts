#!/usr/bin/env bun
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runCli, type CliSpec } from "../lib/cli.ts";
import type { RecommendationResponse } from "../../services/recommendation-api/position/schema.ts";
import { RecommendationRun, type RecommendationRunType } from "./recommendation/schema.ts";
import {
  createRecommendationApiClient,
  type RecommendationApiClient,
} from "./recommendation-api/client.ts";
import { loadRenderAssets } from "./render/assets.ts";
import { renderRecommendationHtml } from "./render/recommendation-html.ts";
import { validateReportHtml } from "./render/validate-report-html.ts";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function removeIfPresent(path: string): void {
  rmSync(path, { force: true });
}

function replaceOutputPair(
  jsonPath: string,
  jsonContent: string,
  htmlPath: string,
  htmlContent: string,
): void {
  const suffix = crypto.randomUUID();
  const temporaryJson = `${jsonPath}.${suffix}.tmp`;
  const temporaryHtml = `${htmlPath}.${suffix}.tmp`;
  const backupJson = `${jsonPath}.${suffix}.bak`;
  const backupHtml = `${htmlPath}.${suffix}.bak`;
  const hadJson = existsSync(jsonPath);
  const hadHtml = existsSync(htmlPath);
  let installedJson = false;
  let installedHtml = false;

  writeFileSync(temporaryJson, jsonContent, "utf8");
  writeFileSync(temporaryHtml, htmlContent, "utf8");
  try {
    if (hadJson) renameSync(jsonPath, backupJson);
    if (hadHtml) renameSync(htmlPath, backupHtml);
    renameSync(temporaryJson, jsonPath);
    installedJson = true;
    renameSync(temporaryHtml, htmlPath);
    installedHtml = true;
  } catch (error) {
    if (installedJson) removeIfPresent(jsonPath);
    if (installedHtml) removeIfPresent(htmlPath);
    if (hadJson && existsSync(backupJson)) renameSync(backupJson, jsonPath);
    if (hadHtml && existsSync(backupHtml)) renameSync(backupHtml, htmlPath);
    removeIfPresent(temporaryJson);
    removeIfPresent(temporaryHtml);
    throw error;
  }
  removeIfPresent(backupJson);
  removeIfPresent(backupHtml);
}

export function recommendationRunFromBackend(
  response: RecommendationResponse,
): RecommendationRunType {
  return RecommendationRun.parse({
    schemaVersion: 10,
    reportDate: response.reportDate,
    generatedAt: response.generatedAt,
    summary: [
      `활성 공고 ${response.analysisSummary.activeCount}건 중 이번 실행 분석 ${response.analysisSummary.analyzedNowCount}건, 재사용 ${response.analysisSummary.reusedCount}건, 대기 ${response.analysisSummary.pendingCount}건입니다.`,
      `개인 제외 ${response.analysisSummary.personalExcludedCount}건을 수집 전에 제거했습니다.`,
    ],
    ranking: response.ranking,
    recommendations: response.recommendations.map((item) => ({
      ...item,
      label: item.decision === "recommend" ? "추천" : "검토",
    })),
    pendingCandidates: response.pendingCandidates,
    analysisSummary: response.analysisSummary,
    collectionHealth: response.collectionHealth,
    nextActions: unique(response.recommendations.flatMap((item) => item.nextActions)),
    sourceSnapshot: response.sourceSnapshot,
  });
}

export async function finalizeRecommendation(
  client: Pick<RecommendationApiClient, "createRecommendation">,
  analysisRunId: string,
  outputJson: string,
  outputHtml: string,
) {
  const response = await client.createRecommendation(
    analysisRunId,
    `recommendation:${analysisRunId}`,
  );
  const run = recommendationRunFromBackend(response);
  const html = renderRecommendationHtml(run, loadRenderAssets("report"), run.generatedAt);
  const errors = validateReportHtml(html, run);
  if (errors.length > 0) throw new Error(`추천 HTML 검증 실패: ${errors.join("; ")}`);

  const jsonPath = resolve(outputJson);
  const htmlPath = resolve(outputHtml);
  mkdirSync(dirname(jsonPath), { recursive: true });
  mkdirSync(dirname(htmlPath), { recursive: true });
  replaceOutputPair(jsonPath, `${JSON.stringify(run, null, 2)}\n`, htmlPath, html);
  return {
    recommendationRunId: response.recommendationRunId,
    rankingCount: run.ranking.length,
    ...run.analysisSummary,
    warningSourceCount: run.collectionHealth.warningSources.length,
    outputJson: jsonPath,
    outputHtml: htmlPath,
  };
}

const spec: CliSpec = {
  name: "finalize_position_recommendation.ts",
  summary: "Backend 추천 입력을 JSON과 검증된 HTML로 최종화한다.",
  options: {
    "--analysis-run-id": { value: true, description: "분석 실행 ID" },
    "--output-json": { value: true, description: "추천 JSON 출력" },
    "--output-html": { value: true, description: "추천 HTML 출력" },
  },
};

if (import.meta.main) {
  await runCli(spec, async ({ options }) => {
    const analysisRunId = options["--analysis-run-id"];
    const outputJson = options["--output-json"];
    const outputHtml = options["--output-html"];
    if (
      typeof analysisRunId !== "string" ||
      typeof outputJson !== "string" ||
      typeof outputHtml !== "string"
    ) {
      throw new Error("--analysis-run-id, --output-json과 --output-html이 필요합니다.");
    }
    const result = await finalizeRecommendation(
      createRecommendationApiClient(),
      analysisRunId,
      outputJson,
      outputHtml,
    );
    return { passed: true, ...result };
  });
}
