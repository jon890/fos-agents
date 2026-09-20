import { expect, test } from "bun:test";
import type { PostingCandidate } from "../../../scripts/position-recommender/live-postings/contracts.ts";
import { recommendationResponseSchema } from "./schema.ts";
import { PositionService } from "./service.ts";
import { SqlPositionRepository } from "./sql-repository.ts";

const ids = {
  positions: [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    "00000000-0000-4000-8000-000000000003",
  ],
  versions: [
    "10000000-0000-4000-8000-000000000001",
    "10000000-0000-4000-8000-000000000002",
    "10000000-0000-4000-8000-000000000003",
  ],
  changedVersion: "10000000-0000-4000-8000-000000000010",
  analyses: ["20000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000002"],
  analysisRun: "30000000-0000-4000-8000-000000000001",
  earlierAnalysisRun: "30000000-0000-4000-8000-000000000002",
  recommendationRun: "40000000-0000-4000-8000-000000000001",
  companyTierRun: "50000000-0000-4000-8000-000000000001",
  companyTierAssessments: [
    "60000000-0000-4000-8000-000000000001",
    "60000000-0000-4000-8000-000000000002",
  ],
} as const;

function posting(index: number): PostingCandidate {
  return {
    id: `wanted:candidate-${index}`,
    source: "wanted",
    company: `회사 ${index}`,
    title: `Backend Engineer ${index}`,
    url: `https://example.com/jobs/${index}`,
    identityHash: `wanted:${index}`,
    linkType: "direct_posting",
    postingStatus: "active",
    activeEvidence: "active",
    openedAt: "",
    closesAt: "",
    daysUntilClose: "",
    closeUrgency: "normal",
    category: "개발",
    summary: "서버 개발",
    tags: [],
    skills: ["Java"],
    dueTime: "",
    mainTasks: "서버 개발",
    requirements: "Java",
    preferred: "",
  };
}

function databaseRows() {
  const postings = [posting(1), posting(2), posting(3)];
  const changedPosting = {
    ...postings[0],
    title: "본문이 변경된 Backend Engineer 1",
    summary: "추천 생성 뒤 바뀐 서버 개발 본문",
  };
  return {
    position_analysis_policy: [
      {
        candidate_context_version: "context-1",
        daily_analysis_limit: 20,
        priority_slots: 16,
        aging_slots: 4,
        stale_after_days: 30,
        default_company_tier: 3,
        daily_company_tier_limit: 5,
        company_tier_stale_after_days: 90,
      },
    ],
    company_preferences: [
      {
        company_key: "회사 1",
        company_name: "회사 1",
        tier: 1,
        disposition: "analyze",
        updated_at: "2026-09-17T00:00:00.000Z",
      },
      {
        company_key: "회사 2",
        company_name: "회사 2",
        tier: 2,
        disposition: "analyze",
        updated_at: "2026-09-17T00:00:00.000Z",
      },
    ],
    positions: postings.map((item, index) => ({
      position_id: ids.positions[index],
      source_key: "wanted",
      identity_hash: item.identityHash,
      first_seen_at: "2026-09-16T00:00:00.000Z",
      last_seen_at: "2026-09-17T00:00:00.000Z",
      pending_since: index === 2 ? "2026-09-17T00:00:00.000Z" : null,
      lifecycle: "active",
    })),
    position_versions: [
      ...postings.map((item, index) => ({
        position_version_id: ids.versions[index],
        position_id: ids.positions[index],
        content_hash: `sha256:content-${index + 1}`,
        snapshot_json: item,
        observed_at: "2026-09-17T00:00:00.000Z",
      })),
      {
        position_version_id: ids.changedVersion,
        position_id: ids.positions[0],
        content_hash: "sha256:changed-content-1",
        snapshot_json: changedPosting,
        observed_at: "2026-09-18T00:00:00.000Z",
      },
    ],
    position_analyses: [0, 1].map((index) => ({
      analysis_id: ids.analyses[index],
      position_id: ids.positions[index],
      position_version_id: ids.versions[index],
      candidate_context_version: "context-1",
      contract_version: 1,
      created_by_analysis_run_id: index === 0 ? ids.analysisRun : ids.earlierAnalysisRun,
      analyzed_at: `2026-09-17T0${index + 1}:00:00.000Z`,
      valid_until: "2026-10-17",
      company_tier_at_analysis: index + 1,
      decision: index === 0 ? "recommend" : "consider",
      fit_score: 80 - index * 5,
      role_fit: 35 - index * 5,
      scope_upside: 20,
      company_opportunity: 15,
      constraints_score: 10,
      reason: `추천 이유 ${index + 1}`,
      details_json: [],
      next_actions_json: [`다음 행동 ${index + 1}`],
    })),
    position_collection_runs: [
      {
        run_id: "collection-1",
        collected_at: "2026-09-17T00:00:00.000Z",
        personal_excluded_count: 2,
      },
    ],
    position_source_run_diagnostics: [
      {
        run_id: "collection-1",
        source_key: "wanted",
        status: "partial",
        collected_count: 3,
        imported_count: 3,
        skipped_count: 0,
        failed_count: 2,
        public_message: "일부 공고를 확인하지 못했습니다.",
      },
    ],
    position_collection_items: postings.map((_item, index) => ({
      run_id: "collection-1",
      position_id: ids.positions[index],
      position_version_id: ids.versions[index],
      source_key: "wanted",
      identity_hash: `wanted:${index + 1}`,
    })),
    position_analysis_runs: [
      {
        analysis_run_id: ids.analysisRun,
        collection_run_id: "collection-1",
        candidate_context_version: "context-1",
        contract_version: 1,
        status: "completed",
        created_at: "2026-09-17T00:10:00.000Z",
        completed_at: "2026-09-17T02:30:00.000Z",
        analyzed_now_count: 1,
      },
    ],
    position_analysis_run_items: [0, 1].map((index) => ({
      analysis_run_id: ids.analysisRun,
      position_id: ids.positions[index],
      position_version_id: ids.versions[index],
      selection_order: index + 1,
      analysis_status: "new",
      selection_reason: index === 0 ? "priority" : "aging",
      company_tier: index + 1,
      company_tier_source: index === 0 ? "manual" : "model",
      company_tier_assessment_id: index === 0 ? null : ids.companyTierAssessments[1],
      result_status: index === 0 ? "created" : "reused",
      analysis_id: ids.analyses[index],
      failure_code: null,
      attempt_count: 1,
      completed_at: `2026-09-17T0${index + 1}:30:00.000Z`,
    })),
    position_recommendation_runs: [
      {
        recommendation_run_id: ids.recommendationRun,
        analysis_run_id: ids.analysisRun,
        collection_run_id: "collection-1",
        generated_at: "2026-09-17T03:00:00.000Z",
        analyzed_now_count: 1,
        reused_count: 1,
        pending_count: 1,
        pending_candidates_json: [
          {
            candidateId: "wanted:candidate-3",
            company: "회사 3",
            title: "Backend Engineer 3",
            postingUrl: "https://example.com/jobs/3",
            companyTier: 3,
            analysisStatus: "new",
          },
        ],
        personal_excluded_count: 2,
      },
    ],
    position_recommendation_items: [0, 1].map((index) => ({
      recommendation_run_id: ids.recommendationRun,
      position_id: ids.positions[index],
      analysis_id: ids.analyses[index],
      rank_number: index + 1,
      decision: index === 0 ? "recommend" : "consider",
      company_tier: index + 1,
      company_tier_source: index === 0 ? "manual" : "model",
      company_tier_assessment_id: index === 0 ? null : ids.companyTierAssessments[1],
    })),
    company_tier_assessment_runs: [
      {
        company_tier_run_id: ids.companyTierRun,
        collection_run_id: "collection-1",
        candidate_context_version: "context-1",
        contract_version: 1,
        status: "partial",
        assessed_now_count: 1,
        created_at: "2026-09-17T00:05:00.000Z",
        completed_at: "2026-09-17T00:40:00.000Z",
      },
    ],
    company_tier_assessments: [
      {
        company_tier_assessment_id: ids.companyTierAssessments[1],
        company_key: "회사 2",
        company_name: "회사 2",
        candidate_context_version: "context-1",
        contract_version: 1,
        created_by_company_tier_run_id: ids.companyTierRun,
        recommended_tier: 2,
        confidence: "medium",
        reason: "성장 범위를 확인했다.",
        signals_json: { "growth-scope": "medium", "compensation-upside": "unknown" },
        evidence_json: [{ url: "https://example.com/company/2", validUntil: "2026-12-17" }],
        assumptions_json: ["공개 자료만 확인했다."],
        assessed_at: "2026-09-17T00:20:00.000Z",
        valid_until: "2026-12-16",
      },
    ],
    company_tier_assessment_run_items: [
      {
        company_tier_run_id: ids.companyTierRun,
        company_key: "회사 2",
        company_name: "회사 2",
        selection_order: 1,
        assessment_status: "new",
        selection_reason: "discovery",
        prior_tier: null,
        active_position_count: 3,
        result_status: "created",
        company_tier_assessment_id: ids.companyTierAssessments[1],
        failure_code: null,
        attempt_count: 1,
        completed_at: "2026-09-17T00:20:00.000Z",
      },
      {
        company_tier_run_id: ids.companyTierRun,
        company_key: "회사 3",
        company_name: "회사 3",
        selection_order: 2,
        assessment_status: "stale",
        selection_reason: "refresh",
        prior_tier: 3,
        active_position_count: 1,
        result_status: "failed",
        company_tier_assessment_id: null,
        failure_code: "research_unavailable",
        attempt_count: 2,
        completed_at: "2026-09-17T00:40:00.000Z",
      },
    ],
  };
}

function fakeSql(rows: ReturnType<typeof databaseRows>): Bun.SQL {
  return ((strings: TemplateStringsArray | string) => {
    const query = typeof strings === "string" ? strings : strings.join("?");
    const table = Object.keys(rows).find((name) => query.includes(`FROM ${name}`));
    return Promise.resolve(table ? rows[table as keyof typeof rows] : []);
  }) as unknown as Bun.SQL;
}

function expectedRecommendation() {
  const ranking = [
    {
      candidateId: "wanted:candidate-1",
      company: "회사 1",
      title: "Backend Engineer 1",
      postingUrl: "https://example.com/jobs/1",
      companyTier: 1,
      decision: "recommend" as const,
      fitScore: 80,
      reason: "추천 이유 1",
      details: [],
      nextActions: ["다음 행동 1"],
    },
    {
      candidateId: "wanted:candidate-2",
      company: "회사 2",
      title: "Backend Engineer 2",
      postingUrl: "https://example.com/jobs/2",
      companyTier: 2,
      decision: "consider" as const,
      fitScore: 75,
      reason: "추천 이유 2",
      details: [],
      nextActions: ["다음 행동 2"],
    },
  ];
  return recommendationResponseSchema.parse({
    schemaVersion: 1,
    recommendationRunId: ids.recommendationRun,
    analysisRunId: ids.analysisRun,
    reportDate: "2026-09-17",
    generatedAt: "2026-09-17T03:00:00.000Z",
    sourceSnapshot: { collectionRunId: "collection-1" },
    ranking,
    recommendations: ranking,
    pendingCandidates: [
      {
        candidateId: "wanted:candidate-3",
        company: "회사 3",
        title: "Backend Engineer 3",
        postingUrl: "https://example.com/jobs/3",
        companyTier: 3,
        analysisStatus: "new",
      },
    ],
    analysisSummary: {
      activeCount: 3,
      analyzedNowCount: 1,
      reusedCount: 1,
      pendingCount: 1,
      personalExcludedCount: 2,
    },
    collectionHealth: {
      candidateCount: 3,
      configuredSourceCount: 1,
      warningSources: [
        {
          source: "wanted",
          status: "partial",
          failedCount: 2,
          reason: "일부 공고를 확인하지 못해 후보가 누락됐을 수 있습니다.",
        },
      ],
    },
  });
}

async function reloadRecommendation() {
  const repository = new SqlPositionRepository(fakeSql(databaseRows()));
  const service = new PositionService(repository);
  return {
    response: recommendationResponseSchema.parse(await service.getRun(ids.recommendationRun)),
    analyzedNowCount: repository.snapshot().analysisRuns.get(ids.analysisRun)?.analyzedNowCount,
  };
}

test("추천 뒤 공고 본문이 바뀌어도 MySQL 재시작 전후의 저장 응답을 그대로 복원한다", async () => {
  const storedBeforeRestart = expectedRecommendation();
  const beforeRestart = await reloadRecommendation();
  const afterRestart = await reloadRecommendation();
  expect(beforeRestart.response).toEqual(storedBeforeRestart);
  expect(afterRestart.response).toEqual(storedBeforeRestart);
  expect(afterRestart.analyzedNowCount).toBe(1);
});

test("실행 항목의 처리 결과와 분석의 최초 생성 실행을 복원한다", async () => {
  const repository = new SqlPositionRepository(fakeSql(databaseRows()));
  await repository.ensureReady();
  const state = repository.snapshot();
  const run = state.analysisRuns.get(ids.analysisRun)!;
  const items = [...run.items.values()].sort(
    (left, right) => left.selectionOrder - right.selectionOrder,
  );
  expect(run.status).toBe("completed");
  expect(items.map((item) => item.positionId)).toEqual([ids.positions[0], ids.positions[1]]);
  expect(items[0]).toMatchObject({
    selectionOrder: 1,
    resultStatus: "created",
    analysisId: ids.analyses[0],
    attemptCount: 1,
    failureCode: null,
  });
  expect(items[1]).toMatchObject({ selectionOrder: 2, resultStatus: "reused" });
  const analyses = [...state.positions.values()].flatMap((position) => position.analyses);
  expect(analyses.find((entry) => entry.analysisId === ids.analyses[0])?.createdByAnalysisRunId).toBe(
    ids.analysisRun,
  );
  expect(analyses.find((entry) => entry.analysisId === ids.analyses[1])?.createdByAnalysisRunId).toBe(
    ids.earlierAnalysisRun,
  );
});

test("회사 tier 평가 실행의 선택 순서와 결과, 출처와 유효기간을 복원한다", async () => {
  const repository = new SqlPositionRepository(fakeSql(databaseRows()));
  await repository.ensureReady();
  const state = repository.snapshot();
  const run = state.companyTierRuns.get(ids.companyTierRun)!;
  expect(run).toMatchObject({
    collectionRunId: "collection-1",
    candidateContextVersion: "context-1",
    contractVersion: 1,
    status: "partial",
    assessedNowCount: 1,
  });
  const items = [...run.items.values()].sort(
    (left, right) => left.selectionOrder - right.selectionOrder,
  );
  expect(items.map((item) => item.companyKey)).toEqual(["회사 2", "회사 3"]);
  expect(items[0]).toMatchObject({
    assessmentStatus: "new",
    selectionReason: "discovery",
    priorTier: null,
    activePositionCount: 3,
    resultStatus: "created",
    companyTierAssessmentId: ids.companyTierAssessments[1],
    failureCode: null,
    attemptCount: 1,
  });
  expect(items[1]).toMatchObject({
    assessmentStatus: "stale",
    selectionReason: "refresh",
    priorTier: 3,
    resultStatus: "failed",
    companyTierAssessmentId: null,
    failureCode: "research_unavailable",
    attemptCount: 2,
  });
  const assessment = state.companyTierAssessments.get(ids.companyTierAssessments[1])!;
  expect(assessment).toMatchObject({
    companyKey: "회사 2",
    recommendedTier: 2,
    confidence: "medium",
    createdByCompanyTierRunId: ids.companyTierRun,
    validUntil: "2026-12-16",
  });
  expect(assessment.signals).toEqual({
    "growth-scope": "medium",
    "compensation-upside": "unknown",
  });
  expect(assessment.assumptions).toEqual(["공개 자료만 확인했다."]);
});

test("공고 분석과 추천 항목의 tier 출처와 평가 ID를 복원한다", async () => {
  const repository = new SqlPositionRepository(fakeSql(databaseRows()));
  await repository.ensureReady();
  const state = repository.snapshot();
  const items = [...state.analysisRuns.get(ids.analysisRun)!.items.values()].sort(
    (left, right) => left.selectionOrder - right.selectionOrder,
  );
  expect(items.map((item) => item.companyTierSource)).toEqual(["manual", "model"]);
  expect(items.map((item) => item.companyTierAssessmentId)).toEqual([
    null,
    ids.companyTierAssessments[1],
  ]);
  const sources = state.recommendationTierSources.get(ids.analysisRun)!;
  expect(sources.get("wanted:candidate-1")).toEqual({ source: "manual", assessmentId: null });
  expect(sources.get("wanted:candidate-2")).toEqual({
    source: "model",
    assessmentId: ids.companyTierAssessments[1],
  });
});

test("기록 순서는 실행 헤더, 분석, 실행 항목 차례를 지킨다", async () => {
  const executed: string[] = [];
  const rows = databaseRows();
  const recordingSql = ((strings: TemplateStringsArray | string) => {
    const query = typeof strings === "string" ? strings : strings.join("?");
    executed.push(query);
    const table = Object.keys(rows).find((name) => query.includes(`FROM ${name}`));
    return Promise.resolve(table ? rows[table as keyof typeof rows] : []);
  }) as unknown as Bun.SQL;
  (recordingSql as unknown as { begin: (callback: (sql: Bun.SQL) => unknown) => unknown }).begin = (
    callback,
  ) => callback(recordingSql);
  const repository = new SqlPositionRepository(recordingSql);
  await repository.transaction(() => undefined);
  const indexOf = (fragment: string) =>
    executed.findIndex((query) => query.includes(fragment));
  expect(indexOf("INSERT INTO position_analysis_runs")).toBeGreaterThanOrEqual(0);
  expect(indexOf("INSERT INTO position_analysis_runs")).toBeLessThan(
    indexOf("INSERT IGNORE INTO position_analyses"),
  );
  expect(indexOf("INSERT IGNORE INTO position_analyses")).toBeLessThan(
    indexOf("INSERT INTO position_analysis_run_items"),
  );
  expect(indexOf("INSERT INTO company_tier_assessment_runs")).toBeGreaterThanOrEqual(0);
  expect(indexOf("INSERT INTO company_tier_assessment_runs")).toBeLessThan(
    indexOf("INSERT IGNORE INTO company_tier_assessments"),
  );
  expect(indexOf("INSERT IGNORE INTO company_tier_assessments")).toBeLessThan(
    indexOf("INSERT INTO company_tier_assessment_run_items"),
  );
});
