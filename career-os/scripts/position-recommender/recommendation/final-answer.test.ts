import { expect, test } from "bun:test";
import { COLLECTION_WARNING_NOTE, collectionWarningLines } from "./final-answer.ts";
import { RecommendationRun, type RecommendationRunType } from "./schema.ts";

type WarningInput = RecommendationRunType["collectionHealth"]["warningSources"];

function run(warningSources: WarningInput): RecommendationRunType {
  return RecommendationRun.parse({
    schemaVersion: 11,
    reportDate: "2026-09-18",
    generatedAt: "2026-09-18T00:00:00.000Z",
    summary: [],
    recommendations: [],
    companyAssessments: [],
    ranking: [],
    pendingCandidates: [],
    analysisSummary: {
      activeCount: 0,
      analyzedNowCount: 0,
      reusedCount: 0,
      pendingCount: 0,
      personalExcludedCount: 0,
    },
    companyTierSummary: {
      manualCount: 0,
      modelCount: 0,
      defaultCount: 0,
      assessmentFailedCount: 0,
    },
    collectionHealth: {
      candidateCount: 0,
      configuredSourceCount: 16,
      warningSources,
    },
    nextActions: [],
    sourceSnapshot: { collectionRunId: "collection-1" },
  });
}

test("경고가 있으면 소스명, 상태, 실패 건수와 후보 누락 문장을 담는다", () => {
  const lines = collectionWarningLines(
    run([
      {
        source: "coupang-careers",
        status: "partial",
        failedCount: 14,
        reason: "일부 공고를 확인하지 못해 후보가 누락됐을 수 있습니다.",
      },
      {
        source: "wanted",
        status: "failed",
        failedCount: 3,
        reason: "일부 공고를 확인하지 못해 후보가 누락됐을 수 있습니다.",
      },
    ]),
  );
  expect(lines).toEqual([
    "coupang-careers · partial · 실패 14건",
    "wanted · failed · 실패 3건",
    COLLECTION_WARNING_NOTE,
  ]);
});

test("경고가 없으면 빈 배열이라 최종 답변에 줄을 만들지 않는다", () => {
  expect(collectionWarningLines(run([]))).toEqual([]);
});

test("Backend가 채운 reason의 원본 오류와 URL은 최종 답변 줄에 나오지 않는다", () => {
  const lines = collectionWarningLines(
    run([
      {
        source: "coupang-careers",
        status: "partial",
        failedCount: 14,
        reason:
          "HTTP 503 https://www.coupang.jobs/internal?token=secret-token /Users/runner/state/private.json",
      },
    ]),
  );
  const joined = lines.join("\n");
  expect(lines).toEqual(["coupang-careers · partial · 실패 14건", COLLECTION_WARNING_NOTE]);
  expect(joined).not.toContain("HTTP 503");
  expect(joined).not.toContain("https://");
  expect(joined).not.toContain("token");
  expect(joined).not.toContain("/Users/");
});
