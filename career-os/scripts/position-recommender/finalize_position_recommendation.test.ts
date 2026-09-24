import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RecommendationResponse } from "../../services/recommendation-api/src/positions/schema.ts";
import { finalizeRecommendation } from "./finalize_position_recommendation.ts";
import { COLLECTION_WARNING_NOTE } from "./recommendation/final-answer.ts";

function response(): RecommendationResponse {
  const ranked = {
    candidateId: "wanted:1",
    company: "테스트 회사",
    title: "Backend Engineer",
    postingUrl: "https://example.com/jobs/1",
    companyTier: 1,
    companyTierSource: "model" as const,
    companyTierAssessmentId: "assessment-1",
    companyTierAssessedAt: "2026-09-10T00:00:00.000Z",
    companyTierValidUntil: "2026-12-10",
    companyTierConfidence: "high" as const,
    companyTierReason: "최근 투자 유치와 조직 확대 신호가 뚜렷하다.",
    companyTierEvidenceUrls: ["https://example.com/news/funding"],
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
    companyAssessments: [
      {
        companyKey: "테스트-회사",
        companyName: "테스트 회사",
        disposition: "analyze",
        reason: "기술 자료를 확인했다.",
        signals: [
          { axis: "growth-scope", level: "high", evidenceIds: ["blog-1"] },
          { axis: "team-growth", level: "unknown", evidenceIds: [] },
          { axis: "compensation-upside", level: "unknown", evidenceIds: [] },
        ],
        evidence: [
          {
            id: "blog-1",
            url: "https://example.com/blog/1",
            title: "기술 블로그",
            checkedAt: "2026-09-17",
          },
        ],
      },
      {
        companyKey: "대기-회사",
        companyName: "대기 회사",
        disposition: "analyze",
        reason: null,
        signals: ["growth-scope", "team-growth", "compensation-upside"].map((axis) => ({
          axis: axis as "growth-scope" | "team-growth" | "compensation-upside",
          level: "unknown" as const,
          evidenceIds: [],
        })),
        evidence: [],
      },
    ],
    pendingCandidates: [
      {
        candidateId: "wanted:2",
        company: "대기 회사",
        title: "Platform Engineer",
        postingUrl: "https://example.com/jobs/2",
        companyTier: 3,
        companyTierSource: "default" as const,
        companyTierEvidenceUrls: [],
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
    companyTierSummary: {
      manualCount: 0,
      modelCount: 1,
      defaultCount: 1,
      assessmentFailedCount: 0,
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
    expect(html).toContain("기술 블로그");
    expect(html).toContain("근거 없음");
    expect(html).not.toContain("Tier ");
    expect(html).not.toContain("private-error");
    expect(existsSync(outputJson)).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("최종 답변에 넣을 수집 경고 줄을 실행 결과로 함께 돌려준다", async () => {
  const directory = mkdtempSync("/tmp/finalize-position.");
  try {
    const result = await finalizeRecommendation(
      { createRecommendation: async () => response() },
      "analysis-1",
      join(directory, "recommendation.json"),
      join(directory, "index.html"),
    );
    expect(result.collectionWarnings).toEqual([
      "coupang-careers · partial · 실패 62건",
      COLLECTION_WARNING_NOTE,
    ]);
    expect(result.warningSourceCount).toBe(1);
    expect(result.unknownCompanyCounts).toEqual({
      "growth-scope": 1,
      "team-growth": 2,
      "compensation-upside": 2,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("수집 경고가 없으면 최종 답변 줄도 만들지 않는다", async () => {
  const directory = mkdtempSync("/tmp/finalize-position.");
  try {
    const healthy = response();
    healthy.collectionHealth.warningSources = [];
    const result = await finalizeRecommendation(
      { createRecommendation: async () => healthy },
      "analysis-1",
      join(directory, "recommendation.json"),
      join(directory, "index.html"),
    );
    expect(result.collectionWarnings).toEqual([]);
    expect(readFileSync(join(directory, "index.html"), "utf8")).not.toContain("수집 경고");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("소스 HTTP 429와 회사 tier 평가 실패를 서로 다른 경고로 표시한다", async () => {
  const directory = mkdtempSync("/tmp/finalize-position.");
  try {
    const withBothWarnings = response();
    withBothWarnings.collectionHealth.warningSources = [
      {
        source: "wanted",
        status: "failed",
        failedCount: 5,
        reason: "일부 공고를 확인하지 못해 후보가 누락됐을 수 있습니다.",
      },
    ];
    withBothWarnings.companyTierSummary = {
      manualCount: 0,
      modelCount: 1,
      defaultCount: 1,
      assessmentFailedCount: 2,
    };
    const outputJson = join(directory, "recommendation.json");
    const outputHtml = join(directory, "index.html");
    const result = await finalizeRecommendation(
      { createRecommendation: async () => withBothWarnings },
      "analysis-1",
      outputJson,
      outputHtml,
    );
    const html = readFileSync(outputHtml, "utf8");
    expect(html).toContain("wanted");
    expect(html).toContain("실패 5건");
    expect(html).toContain("평가 실패 2건");
    expect(result.collectionWarnings).toEqual([
      "wanted · failed · 실패 5건",
      COLLECTION_WARNING_NOTE,
    ]);
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
