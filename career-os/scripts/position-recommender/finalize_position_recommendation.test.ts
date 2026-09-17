import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RecommendationResponse } from "../../services/recommendation-api/position/schema.ts";
import { finalizeRecommendation } from "./finalize_position_recommendation.ts";

function response(): RecommendationResponse {
  const ranked = {
    candidateId: "wanted:1",
    company: "테스트 회사",
    title: "Backend Engineer",
    postingUrl: "https://example.com/jobs/1",
    companyTier: 1,
    decision: "recommend" as const,
    fitScore: 80,
    reason: "현재 경험을 확장할 수 있다.",
    details: [],
    nextActions: ["운영 사례 정리"],
  };
  return {
    schemaVersion: 1,
    recommendationRunId: "recommendation-1",
    analysisRunId: "analysis-1",
    reportDate: "2026-09-17",
    generatedAt: "2026-09-17T00:00:00.000Z",
    sourceSnapshot: { collectionRunId: "collection-1" },
    ranking: [ranked],
    recommendations: [ranked],
    pendingCandidates: [
      {
        candidateId: "wanted:2",
        company: "대기 회사",
        title: "Platform Engineer",
        postingUrl: "https://example.com/jobs/2",
        companyTier: 3,
        analysisStatus: "new",
      },
    ],
    analysisSummary: {
      activeCount: 2,
      analyzedNowCount: 1,
      reusedCount: 0,
      pendingCount: 1,
      personalExcludedCount: 2,
    },
    collectionHealth: {
      candidateCount: 2,
      configuredSourceCount: 1,
      warningSources: [
        {
          source: "coupang-careers",
          status: "partial",
          failedCount: 62,
          reason: "일부 공고를 확인하지 못해 후보가 누락됐을 수 있습니다.",
        },
      ],
    },
  };
}

test("추천 JSON과 HTML을 만들고 대기와 부분 실패를 공개 범위 안에서 표시한다", async () => {
  const directory = mkdtempSync("/tmp/finalize-position.");
  try {
    const outputJson = join(directory, "recommendation.json");
    const outputHtml = join(directory, "index.html");
    await finalizeRecommendation(
      { createRecommendation: async () => response() },
      "analysis-1",
      outputJson,
      outputHtml,
    );
    const html = readFileSync(outputHtml, "utf8");
    expect(html).toContain("분석 대기 · 1건");
    expect(html).toContain("coupang-careers");
    expect(html).toContain("실패 62건");
    expect(html).not.toContain("private-error");
    expect(existsSync(outputJson)).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("검증 실패는 기존 출력 파일을 덮어쓰지 않는다", async () => {
  const directory = mkdtempSync("/tmp/finalize-position.");
  try {
    const outputJson = join(directory, "recommendation.json");
    const outputHtml = join(directory, "index.html");
    writeFileSync(outputJson, "old-json");
    writeFileSync(outputHtml, "old-html");
    const invalid = response();
    invalid.analysisSummary.activeCount = 99;
    await expect(
      finalizeRecommendation(
        { createRecommendation: async () => invalid },
        "analysis-1",
        outputJson,
        outputHtml,
      ),
    ).rejects.toThrow();
    expect(readFileSync(outputJson, "utf8")).toBe("old-json");
    expect(readFileSync(outputHtml, "utf8")).toBe("old-html");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
