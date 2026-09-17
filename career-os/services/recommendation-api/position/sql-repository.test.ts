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
  recommendationRun: "40000000-0000-4000-8000-000000000001",
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
        created_at: "2026-09-17T00:10:00.000Z",
        completed_at: "2026-09-17T02:30:00.000Z",
        analyzed_now_count: 1,
      },
    ],
    position_analysis_run_items: [0, 1].map((index) => ({
      analysis_run_id: ids.analysisRun,
      position_id: ids.positions[index],
      analysis_status: "new",
      selection_reason: index === 0 ? "priority" : "aging",
      company_tier: index + 1,
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
    })),
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
