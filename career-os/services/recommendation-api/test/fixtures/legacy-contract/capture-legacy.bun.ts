#!/usr/bin/env bun
/**
 * 전환 전 Bun 구현이 실제로 내는 HTTP 응답과 DB 행을 그대로 포착해 `cases.json` 에 기록한다.
 *
 * 기대값을 손으로 적지 않는다. 이 스크립트는 MySQL 을 초기화하고, 실제 서버를 띄우고,
 * 요청을 보내고, 받은 응답과 그 뒤의 DB 행을 그대로 남긴다.
 *
 * 실행마다 달라지는 값을 가려내려고 전체 case 를 **두 번** 돌린다.
 * 두 회차의 응답을 비교해 달라진 경로를 `volatileResponsePaths` 로 적고,
 * DB 행이 두 회차에서 다르면 그 자리를 `unstableTables` 로 드러낸다.
 *
 * 실행:
 *   bun test/fixtures/legacy-contract/capture-legacy.bun.ts
 */
// Bun 의 MySQL driver 는 DATETIME 을 프로세스의 지역 시간으로 해석한다.
// 컨테이너가 UTC 로 기록하므로, 지역 시간이 UTC 가 아니면 다시 읽은 시각이 그 시차만큼 어긋난다.
// 그러면 회사 tier 임차권 판정이 실제와 다르게 나오므로 포착은 UTC 로 고정해서 돌린다.
process.env.TZ = "UTC";

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createApp } from "../../../app.ts";
import { loadConfig, type RecommendationApiConfig } from "../../../config.ts";
import { applyMigrations, loadMigrations, migrationStatus } from "../../../db/migrations.ts";
import { SqlReceiptStore } from "../../../db/receipt-store.ts";
import { SqlPositionRepository } from "../../../position/sql-repository.ts";
import { PositionService } from "../../../position/service.ts";

const HOST = process.env.LEGACY_CAPTURE_DB_HOST ?? "127.0.0.1";
const PORT = process.env.LEGACY_CAPTURE_DB_PORT ?? "13400";
const USER = process.env.LEGACY_CAPTURE_DB_USER ?? "root";
const PASSWORD = process.env.LEGACY_CAPTURE_DB_PASSWORD ?? "plan125";
const DATABASE = process.env.LEGACY_CAPTURE_DB_NAME ?? "fos_career_test";

const DATABASE_URL = `mysql://${USER}:${encodeURIComponent(PASSWORD)}@${HOST}:${PORT}/${DATABASE}`;
const ADMIN_URL = `mysql://${USER}:${encodeURIComponent(PASSWORD)}@${HOST}:${PORT}/mysql`;

const API_TOKEN = "legacy-contract-capture-token-0001";
const SERVICE_ROOT = resolve(import.meta.dir, "../../..");
const MIGRATION_DIR = resolve(SERVICE_ROOT, "migrations");
const OUTPUT_PATH = resolve(import.meta.dir, "cases.json");

const CONFIG: RecommendationApiConfig = loadConfig({
  CAREER_RECOMMENDATION_DATABASE_URL: DATABASE_URL,
  CAREER_RECOMMENDATION_API_TOKEN: API_TOKEN,
  API_HOST: "127.0.0.1",
  API_PORT: "4318",
});

/** 포착에서 비교 대상으로 삼는 열이다. 실행마다 달라지는 열은 여기에 넣지 않는다. */
const TABLE_COLUMNS: Record<string, { columns: string[]; orderBy: string }> = {
  position_analysis_policy: {
    columns: [
      "candidate_context_version",
      "daily_analysis_limit",
      "priority_slots",
      "aging_slots",
      "stale_after_days",
      "default_company_tier",
      "daily_company_tier_limit",
      "company_tier_stale_after_days",
    ],
    orderBy: "singleton_id",
  },
  company_preferences: {
    columns: ["company_key", "company_name", "tier", "disposition"],
    orderBy: "company_key",
  },
  position_sources: {
    columns: ["source_key", "enabled", "last_successful_collection_at"],
    orderBy: "source_key",
  },
  positions: {
    columns: [
      "source_key",
      "identity_hash",
      "normalized_url",
      "company_key",
      "company_name",
      "title",
      "lifecycle",
      "first_seen_at",
      "last_seen_at",
      "pending_since",
    ],
    orderBy: "identity_hash",
  },
  position_versions: {
    columns: ["content_hash", "observed_at"],
    orderBy: "content_hash",
  },
  position_collection_runs: {
    columns: [
      "run_id",
      "idempotency_key",
      "collected_at",
      "status",
      "active_count",
      "personal_excluded_count",
    ],
    orderBy: "run_id",
  },
  position_source_run_diagnostics: {
    columns: [
      "run_id",
      "source_key",
      "status",
      "collected_count",
      "imported_count",
      "skipped_count",
      "failed_count",
      "public_message",
    ],
    orderBy: "run_id, source_key",
  },
  position_collection_items: {
    columns: ["run_id", "posting_status", "close_urgency"],
    orderBy: "run_id, posting_status, close_urgency",
  },
  company_tier_assessment_runs: {
    columns: [
      "collection_run_id",
      "candidate_context_version",
      "contract_version",
      "status",
      "assessed_now_count",
    ],
    orderBy: "collection_run_id",
  },
  company_tier_assessment_run_items: {
    columns: [
      "company_key",
      "company_name",
      "selection_order",
      "assessment_status",
      "selection_reason",
      "prior_tier",
      "active_position_count",
      "result_status",
      "failure_code",
      "attempt_count",
    ],
    orderBy: "company_tier_run_id, selection_order",
  },
  company_tier_assessments: {
    columns: [
      "company_key",
      "company_name",
      "candidate_context_version",
      "contract_version",
      "recommended_tier",
      "confidence",
      "reason",
      "signals_json",
      "evidence_json",
      "assumptions_json",
    ],
    orderBy: "company_key",
  },
  position_analysis_runs: {
    columns: [
      "collection_run_id",
      "candidate_context_version",
      "contract_version",
      "status",
      "analyzed_now_count",
    ],
    orderBy: "collection_run_id",
  },
  position_analysis_run_items: {
    columns: [
      "selection_order",
      "analysis_status",
      "selection_reason",
      "company_tier",
      "company_tier_source",
      "result_status",
      "failure_code",
      "attempt_count",
    ],
    orderBy: "analysis_run_id, selection_order",
  },
  position_analyses: {
    columns: [
      "candidate_context_version",
      "contract_version",
      "company_tier_at_analysis",
      "decision",
      "fit_score",
      "role_fit",
      "scope_upside",
      "company_opportunity",
      "constraints_score",
      "reason",
      "details_json",
      "next_actions_json",
    ],
    orderBy: "fit_score DESC",
  },
  position_recommendation_runs: {
    columns: [
      "collection_run_id",
      "analyzed_now_count",
      "reused_count",
      "pending_count",
      "personal_excluded_count",
    ],
    orderBy: "collection_run_id",
  },
  position_recommendation_items: {
    columns: ["rank_number", "decision", "company_tier", "company_tier_source"],
    orderBy: "recommendation_run_id, rank_number",
  },
  request_receipts: {
    // request_hash 는 요청 본문에서 만들어진다. 본문에 실행마다 새로 생기는 positionId 가 들어가면
    // 해시도 함께 달라지므로 비교 대상에서 뺐다. 정규화 해시의 동작은 멱등 재요청과 충돌 case 가 확인한다.
    columns: ["idempotency_key", "state", "response_status"],
    orderBy: "idempotency_key",
  },
};

const ALL_TABLES = [
  "company_tier_assessment_run_items",
  "company_tier_assessments",
  "company_tier_assessment_runs",
  "position_recommendation_items",
  "position_recommendation_runs",
  "position_analysis_run_items",
  "position_analyses",
  "position_analysis_runs",
  "position_collection_items",
  "position_source_run_diagnostics",
  "position_collection_runs",
  "position_versions",
  "positions",
  "position_sources",
  "company_preferences",
  "position_analysis_policy",
  "request_receipts",
];

/** 실행마다 새로 만들어지는 값이라 두 회차 비교로 잡히지 않아도 비교에서 빼는 이름이다. */
const KNOWN_VOLATILE_FIELDS = new Set([
  "generatedAt",
  "reportDate",
  "positionId",
  "companyTierAssessmentId",
  "companyTierAssessedAt",
  "companyTierValidUntil",
]);

// ---------------------------------------------------------------- 요청 fixture

const COLLECTED_AT = "2026-09-17T00:00:00.000Z";
const CONTEXT_VERSION = "candidate-context-2026-09";

type Json = Record<string, unknown>;

function policy(overrides: Json = {}): Json {
  return {
    schemaVersion: 2,
    candidateContextVersion: CONTEXT_VERSION,
    dailyAnalysisLimit: 5,
    prioritySlots: 3,
    agingSlots: 2,
    staleAfterDays: 30,
    defaultCompanyTier: 2,
    dailyCompanyTierLimit: 5,
    companyTierStaleAfterDays: 90,
    ...overrides,
  };
}

function candidate(index: number): Json {
  return {
    id: `wanted:candidate-${index}`,
    source: "wanted",
    company: `회사 ${index}`,
    title: `Backend Engineer ${index}`,
    url: `https://example.com/jobs/${index}`,
    identityHash: `wanted-identity-${index}`,
    linkType: "direct_posting",
    postingStatus: "active",
    activeEvidence: "모집 중 표기",
    openedAt: "",
    closesAt: "",
    daysUntilClose: "",
    closeUrgency: "normal",
    category: "개발",
    summary: `서버 개발 ${index}`,
    tags: [],
    skills: ["Java"],
    dueTime: "",
    mainTasks: `서버 개발 ${index}`,
    requirements: "Java",
    preferred: "",
  };
}

function diagnostic(status: "ok" | "partial", failedCount = 0): Json {
  return {
    source: "wanted",
    status,
    collectedCount: 2,
    importedCount: 2,
    skippedCount: 0,
    failedCount,
    discoveryModes: ["broad"],
    message: status === "ok" ? "ok" : "일부 공고를 확인하지 못했다.",
  };
}

function collectionBody(
  runId: string,
  indexes: number[] = [1, 2],
  diagnosticStatus: "ok" | "partial" = "ok",
): Json {
  return {
    schemaVersion: 2,
    analysisContractVersion: 1,
    companyTierContractVersion: 1,
    pool: {
      schemaVersion: 1,
      collectionRunId: runId,
      collectedAt: COLLECTED_AT,
      requestedSource: "all",
      configuredSources: ["wanted"],
      policy: {
        selection: "llm",
        activeDirectOnly: true,
        fixedPreferenceKeywordsUsed: false,
        sourcePriorityUsed: false,
      },
      candidates: indexes.map(candidate),
      sourceDiagnostics: [diagnostic(diagnosticStatus, diagnosticStatus === "ok" ? 0 : 1)],
      filterSummary: { personalExcludedCount: 0 },
      errors: [],
    },
  };
}

function tierResult(companyKey: string, recommendedTier: number): Json {
  return {
    companyKey,
    recommendedTier,
    confidence: "medium",
    reason: "공개 자료로 성장 범위를 확인했다.",
    signals: [
      { axis: "growth-scope", level: "high" },
      { axis: "compensation-upside", level: "medium" },
      { axis: "team-growth", level: "unknown" },
    ],
    evidence: [{ url: "https://example.com/company", checkedAt: "2026-09-17" }],
    assumptions: ["공개 자료만 확인했다."],
  };
}

function analysisResult(positionId: string, fitScore = 80): Json {
  return {
    positionId,
    decision: "recommend",
    fitScore,
    scoreBreakdown: {
      roleFit: fitScore - 45,
      scopeUpside: 20,
      companyOpportunity: 15,
      constraints: 10,
    },
    reason: "현재 경험을 넓힐 수 있다.",
    details: [],
    nextActions: [],
  };
}

// ---------------------------------------------------------------- 실행 기반

type Context = Record<string, any>;

type RequestStep = {
  kind?: "request";
  label: string;
  method: string;
  path: string | ((context: Context) => string);
  auth?: boolean;
  token?: string;
  idempotencyKey?: string;
  body?: Json | ((context: Context) => Json);
  paddedJsonBytes?: number;
  as?: string;
  derivedFields?: string[];
};

type SqlStep = {
  kind: "sql";
  label: string;
  statement: string;
};

type Step = RequestStep | SqlStep;

type CaseSpec = {
  id: string;
  group: "정상 경로" | "오류와 경계";
  name: string;
  precondition: string;
  given: Step[];
  request: RequestStep;
  tables: string[];
  dbNote?: string;
};

type RecordedRequest = {
  method: string;
  path: string;
  headers: { authorization: boolean; idempotencyKey: string | null };
  body: unknown;
  derivedFields?: string[];
};

type RecordedResponse = {
  status: number;
  cacheControl: string | null;
  hasRequestId: boolean;
  body: unknown;
};

function paddedJson(totalBytes: number): string {
  const wrapper = '{"pad":""}';
  return `{"pad":"${"a".repeat(Math.max(0, totalBytes - wrapper.length))}"}`;
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  if (typeof value === "bigint") return Number(value);
  return value;
}

async function snapshotTables(sql: Bun.SQL, tables: string[]) {
  const snapshot: Record<string, unknown[]> = {};
  for (const table of tables) {
    const spec = TABLE_COLUMNS[table];
    if (!spec) throw new Error(`비교 열을 정하지 않은 table 이다: ${table}`);
    const rows = await sql
      .unsafe(`SELECT ${spec.columns.join(", ")} FROM ${table} ORDER BY ${spec.orderBy}`)
      .values();
    snapshot[table] = (rows as unknown[][]).map((row) =>
      Object.fromEntries(spec.columns.map((column, index) => [column, normalizeValue(row[index])])),
    );
  }
  return snapshot;
}

async function truncateAll(sql: Bun.SQL): Promise<void> {
  await sql.unsafe("SET FOREIGN_KEY_CHECKS = 0").simple();
  for (const table of ALL_TABLES) {
    await sql.unsafe(`TRUNCATE TABLE ${table}`).simple();
  }
  await sql.unsafe("SET FOREIGN_KEY_CHECKS = 1").simple();
}

async function resetDatabase(): Promise<void> {
  const admin = new Bun.SQL(ADMIN_URL);
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS \`${DATABASE}\``).simple();
    await admin
      .unsafe(`CREATE DATABASE \`${DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
      .simple();
  } finally {
    await admin.close();
  }
  const sql = new Bun.SQL(DATABASE_URL);
  try {
    await applyMigrations(sql, loadMigrations(MIGRATION_DIR));
  } finally {
    await sql.close();
  }
}

/**
 * 요청 한 건마다 서버를 새로 띄운다.
 * repository 가 첫 요청에서 DB 를 읽어 메모리에 들고 있으므로,
 * 외부 SQL 로 바꾼 상태를 반영하려면 매번 새로 읽어야 한다.
 */
async function sendRequest(
  sql: Bun.SQL,
  step: RequestStep,
  context: Context,
): Promise<{ request: RecordedRequest; response: RecordedResponse }> {
  const repository = new SqlPositionRepository(sql);
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: createApp({
      config: CONFIG,
      positionService: new PositionService(repository),
      receipts: new SqlReceiptStore(sql),
      readiness: async () => {
        try {
          await sql`SELECT 1`;
          await repository.ensureReady();
          const status = await migrationStatus(sql, loadMigrations(MIGRATION_DIR));
          return status.every((entry) => entry.state === "applied" && entry.valid);
        } catch {
          return false;
        }
      },
    }),
  });
  try {
    const path = typeof step.path === "function" ? step.path(context) : step.path;
    const headers: Record<string, string> = {};
    const withAuth = step.auth ?? true;
    if (withAuth) headers.Authorization = `Bearer ${step.token ?? API_TOKEN}`;
    if (step.idempotencyKey) headers["Idempotency-Key"] = step.idempotencyKey;

    let payload: string | undefined;
    let recordedBody: unknown = undefined;
    if (step.paddedJsonBytes !== undefined) {
      payload = paddedJson(step.paddedJsonBytes);
      recordedBody = {
        generated: { kind: "padded-json", totalBytes: step.paddedJsonBytes, padField: "pad" },
      };
    } else if (step.body !== undefined) {
      const resolved = typeof step.body === "function" ? step.body(context) : step.body;
      payload = JSON.stringify(resolved);
      recordedBody = resolved;
    }
    if (payload !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
      method: step.method,
      headers,
      body: payload,
    });
    const text = await response.text();
    const body = text.length === 0 ? null : (JSON.parse(text) as unknown);
    if (step.as) context[step.as] = body;

    return {
      request: {
        method: step.method,
        path,
        headers: { authorization: withAuth, idempotencyKey: step.idempotencyKey ?? null },
        body: recordedBody,
        ...(step.derivedFields ? { derivedFields: step.derivedFields } : {}),
      },
      response: {
        status: response.status,
        cacheControl: response.headers.get("Cache-Control"),
        hasRequestId: response.headers.has("X-Request-Id"),
        body,
      },
    };
  } finally {
    server.stop(true);
  }
}

// ---------------------------------------------------------------- 공통 선행 단계

const givenPolicy: RequestStep = {
  label: "분석 정책을 설정한다",
  method: "PUT",
  path: "/api/positions/v1/analysis-policy",
  idempotencyKey: "given-policy",
  body: policy(),
};

function givenCollection(
  runId: string,
  key: string,
  indexes: number[] = [1, 2],
  diagnosticStatus: "ok" | "partial" = "ok",
  as = "prep",
): RequestStep {
  return {
    label: `수집 실행 ${runId} 을 저장한다`,
    method: "POST",
    path: "/api/positions/v1/collection-runs",
    idempotencyKey: key,
    body: collectionBody(runId, indexes, diagnosticStatus),
    as,
  };
}

function givenTierResults(
  runId: string,
  key: string,
  companies: Array<[string, number]>,
  failures: Array<[string, string]> = [],
  prepKey = "prep",
): RequestStep {
  return {
    label: "회사 tier 결과를 반영한다",
    method: "POST",
    path: (context) =>
      `/api/positions/v1/company-tier-runs/${context[prepKey].companyTierQueue.companyTierRunId}/results`,
    idempotencyKey: key,
    body: {
      schemaVersion: 1,
      collectionRunId: runId,
      results: companies.map(([companyKey, tier]) => tierResult(companyKey, tier)),
      failures: failures.map(([companyKey, failureCode]) => ({ companyKey, failureCode })),
    },
    derivedFields: ["path: 앞선 수집 응답의 companyTierQueue.companyTierRunId"],
  };
}

function givenAnalysisRun(runId: string, key: string, as = "queue"): RequestStep {
  return {
    label: "공고 분석 실행을 만든다",
    method: "POST",
    path: `/api/positions/v1/collection-runs/${runId}/analysis-runs`,
    idempotencyKey: key,
    body: {},
    as,
  };
}

function analysisResultsBody(
  runId: string,
  queueKey = "queue",
  limit?: number,
): (context: Context) => Json {
  return (context) => {
    const candidates = context[queueKey].candidates as Array<{ positionId: string }>;
    const chosen = limit === undefined ? candidates : candidates.slice(0, limit);
    return {
      schemaVersion: 2,
      collectionRunId: runId,
      // 순위가 동점으로 갈리지 않도록 대기열 순서마다 점수를 달리 준다.
      results: chosen.map((entry, index) => analysisResult(entry.positionId, 80 - index * 10)),
      failures: [],
    };
  };
}

function givenAnalysisResults(runId: string, key: string, queueKey = "queue"): RequestStep {
  return {
    label: "공고 분석 결과를 반영한다",
    method: "POST",
    path: (context) => `/api/positions/v1/analysis-runs/${context[queueKey].analysisRunId}/results`,
    idempotencyKey: key,
    body: analysisResultsBody(runId, queueKey),
    derivedFields: [
      "path: 앞선 분석 실행 응답의 analysisRunId",
      "body.results[].positionId: 앞선 분석 실행 응답의 candidates[].positionId",
    ],
  };
}

// ---------------------------------------------------------------- case 정의

const COMPANY_1 = "회사 1";
const COMPANY_2 = "회사 2";

const happyPathToTierResults = (runId: string): Step[] => [
  givenPolicy,
  givenCollection(runId, "given-collection"),
  givenTierResults(runId, "given-tier-results", [
    [COMPANY_1, 1],
    [COMPANY_2, 2],
  ]),
];

const happyPathToAnalysisRun = (runId: string): Step[] => [
  ...happyPathToTierResults(runId),
  givenAnalysisRun(runId, "given-analysis-run"),
];

const happyPathToAnalysisResults = (runId: string): Step[] => [
  ...happyPathToAnalysisRun(runId),
  givenAnalysisResults(runId, "given-analysis-results"),
];

const RUN_A = "collection-run-a";
const RUN_B = "collection-run-b";

const cases: CaseSpec[] = [
  // ------------------------------------------------------------- 정상 경로 12
  {
    id: "ok-01-health-live",
    group: "정상 경로",
    name: "생존 확인은 인증 없이 200 을 준다",
    precondition: "빈 DB",
    given: [],
    request: { label: "생존 확인", method: "GET", path: "/health/live", auth: false },
    tables: [],
  },
  {
    id: "ok-02-health-ready",
    group: "정상 경로",
    name: "준비 확인은 migration 이 모두 적용됐으면 200 을 준다",
    precondition: "migration 두 개가 적용된 빈 DB",
    given: [],
    request: { label: "준비 확인", method: "GET", path: "/health/ready", auth: false },
    tables: [],
  },
  {
    id: "ok-03-auth-check",
    group: "정상 경로",
    name: "인증 확인은 본문 없이 204 를 준다",
    precondition: "빈 DB",
    given: [],
    request: { label: "인증 확인", method: "GET", path: "/api/v1/auth/check" },
    tables: [],
  },
  {
    id: "ok-04-put-analysis-policy",
    group: "정상 경로",
    name: "분석 정책을 설정하면 저장한 정책을 그대로 돌려준다",
    precondition: "빈 DB",
    given: [],
    request: {
      label: "분석 정책 설정",
      method: "PUT",
      path: "/api/positions/v1/analysis-policy",
      idempotencyKey: "ok-04-policy",
      body: policy(),
    },
    tables: ["position_analysis_policy", "request_receipts"],
  },
  {
    id: "ok-05-put-company-preference",
    group: "정상 경로",
    name: "회사 선호를 설정하면 갱신 시각이 붙은 선호를 돌려준다",
    precondition: "빈 DB",
    given: [],
    request: {
      label: "회사 선호 설정",
      method: "PUT",
      path: `/api/positions/v1/company-preferences/${encodeURIComponent(COMPANY_1)}`,
      idempotencyKey: "ok-05-preference",
      body: { companyKey: COMPANY_1, companyName: COMPANY_1, tier: 1, disposition: "analyze" },
    },
    tables: ["company_preferences", "request_receipts"],
  },
  {
    id: "ok-06-get-company-preferences",
    group: "정상 경로",
    name: "회사 선호 목록은 회사 식별자 순으로 준다",
    precondition: "회사 선호 두 건이 설정된 상태",
    given: [
      {
        label: "회사 2 선호를 먼저 설정한다",
        method: "PUT",
        path: `/api/positions/v1/company-preferences/${encodeURIComponent(COMPANY_2)}`,
        idempotencyKey: "given-preference-2",
        body: { companyKey: COMPANY_2, companyName: COMPANY_2, tier: 3, disposition: "exclude" },
      },
      {
        label: "회사 1 선호를 설정한다",
        method: "PUT",
        path: `/api/positions/v1/company-preferences/${encodeURIComponent(COMPANY_1)}`,
        idempotencyKey: "given-preference-1",
        body: { companyKey: COMPANY_1, companyName: COMPANY_1, tier: 1, disposition: "analyze" },
      },
    ],
    request: {
      label: "회사 선호 목록 조회",
      method: "GET",
      path: "/api/positions/v1/company-preferences",
    },
    tables: ["company_preferences"],
  },
  {
    id: "ok-07-post-collection-run",
    group: "정상 경로",
    name: "수집 실행을 저장하면 201 과 회사 tier 대기열을 준다",
    precondition: "분석 정책만 설정된 상태",
    given: [givenPolicy],
    request: {
      label: "수집 실행 저장",
      method: "POST",
      path: "/api/positions/v1/collection-runs",
      idempotencyKey: "ok-07-collection",
      body: collectionBody(RUN_A),
    },
    tables: [
      "positions",
      "position_versions",
      "position_collection_runs",
      "position_collection_items",
      "position_source_run_diagnostics",
      "position_sources",
      "company_tier_assessment_runs",
      "company_tier_assessment_run_items",
      "request_receipts",
    ],
  },
  {
    id: "ok-08-post-company-tier-results",
    group: "정상 경로",
    name: "회사 tier 결과를 반영하면 200 과 completed 집계를 준다",
    precondition: "분석 정책과 수집 실행이 있고 회사 tier 실행이 pending 인 상태",
    given: [givenPolicy, givenCollection(RUN_A, "given-collection")],
    request: {
      label: "회사 tier 결과 반영",
      method: "POST",
      path: (context) =>
        `/api/positions/v1/company-tier-runs/${context.prep.companyTierQueue.companyTierRunId}/results`,
      idempotencyKey: "ok-08-tier-results",
      body: {
        schemaVersion: 1,
        collectionRunId: RUN_A,
        results: [tierResult(COMPANY_1, 1), tierResult(COMPANY_2, 2)],
        failures: [],
      },
      derivedFields: ["path: 앞선 수집 응답의 companyTierQueue.companyTierRunId"],
    },
    tables: [
      "company_tier_assessment_runs",
      "company_tier_assessment_run_items",
      "company_tier_assessments",
      "request_receipts",
    ],
  },
  {
    id: "ok-09-post-analysis-run",
    group: "정상 경로",
    name: "공고 분석 실행을 만들면 201 과 분석 대기열을 준다",
    precondition: "회사 tier 실행이 completed 인 상태",
    given: happyPathToTierResults(RUN_A),
    request: {
      label: "공고 분석 실행 생성",
      method: "POST",
      path: `/api/positions/v1/collection-runs/${RUN_A}/analysis-runs`,
      idempotencyKey: "ok-09-analysis-run",
      body: {},
    },
    tables: ["position_analysis_runs", "position_analysis_run_items", "request_receipts"],
  },
  {
    id: "ok-10-post-analysis-results",
    group: "정상 경로",
    name: "공고 분석 결과를 모두 반영하면 200 과 completed 집계를 준다",
    precondition: "분석 실행이 pending 이고 대기 항목이 두 개인 상태",
    given: happyPathToAnalysisRun(RUN_A),
    request: {
      label: "공고 분석 결과 반영",
      method: "POST",
      path: (context) => `/api/positions/v1/analysis-runs/${context.queue.analysisRunId}/results`,
      idempotencyKey: "ok-10-analysis-results",
      body: analysisResultsBody(RUN_A),
      derivedFields: [
        "path: 앞선 분석 실행 응답의 analysisRunId",
        "body.results[].positionId: 앞선 분석 실행 응답의 candidates[].positionId",
      ],
    },
    tables: [
      "position_analysis_runs",
      "position_analysis_run_items",
      "position_analyses",
      "positions",
      "request_receipts",
    ],
  },
  {
    id: "ok-11-post-recommendation-run",
    group: "정상 경로",
    name: "추천 실행을 만들면 201 과 순위와 집계를 준다",
    precondition: "분석 실행이 completed 인 상태",
    given: happyPathToAnalysisResults(RUN_A),
    request: {
      label: "추천 실행 생성",
      method: "POST",
      path: "/api/positions/v1/recommendation-runs",
      idempotencyKey: "ok-11-recommendation",
      body: (context) => ({ schemaVersion: 1, analysisRunId: context.queue.analysisRunId }),
      derivedFields: ["body.analysisRunId: 앞선 분석 실행 응답의 analysisRunId"],
    },
    tables: ["position_recommendation_runs", "position_recommendation_items", "request_receipts"],
  },
  {
    id: "ok-12-get-run",
    group: "정상 경로",
    name: "분석 실행 ID 로 실행을 조회하면 분석 대기열 응답을 준다",
    precondition: "분석 실행이 completed 인 상태",
    given: happyPathToAnalysisResults(RUN_A),
    request: {
      label: "실행 조회",
      method: "GET",
      path: (context) => `/api/positions/v1/runs/${context.queue.analysisRunId}`,
      derivedFields: ["path: 앞선 분석 실행 응답의 analysisRunId"],
    },
    tables: [],
  },

  // ------------------------------------------------------------- 오류와 경계
  {
    id: "err-01-idempotent-replay",
    group: "오류와 경계",
    name: "같은 멱등 키에 같은 본문을 다시 보내면 저장한 응답을 그대로 준다",
    precondition: "같은 키로 수집 실행을 한 번 저장한 상태",
    given: [givenPolicy, givenCollection(RUN_A, "err-01-key")],
    request: {
      label: "같은 키와 같은 본문으로 재요청",
      method: "POST",
      path: "/api/positions/v1/collection-runs",
      idempotencyKey: "err-01-key",
      body: collectionBody(RUN_A),
    },
    tables: ["request_receipts", "position_collection_runs", "company_tier_assessment_runs"],
  },
  {
    id: "err-02-idempotency-conflict",
    group: "오류와 경계",
    name: "같은 멱등 키에 다른 본문을 보내면 409 IDEMPOTENCY_CONFLICT 다",
    precondition: "같은 키로 수집 실행을 한 번 저장한 상태",
    given: [givenPolicy, givenCollection(RUN_A, "err-02-key")],
    request: {
      label: "같은 키와 다른 본문으로 재요청",
      method: "POST",
      path: "/api/positions/v1/collection-runs",
      idempotencyKey: "err-02-key",
      body: collectionBody(RUN_B),
    },
    tables: ["request_receipts", "position_collection_runs"],
  },
  {
    id: "err-03-missing-idempotency-key",
    group: "오류와 경계",
    name: "쓰기 요청에 Idempotency-Key 가 없으면 400 BAD_REQUEST 다",
    precondition: "분석 정책만 설정된 상태",
    given: [givenPolicy],
    request: {
      label: "멱등 키 없는 수집 실행 저장",
      method: "POST",
      path: "/api/positions/v1/collection-runs",
      body: collectionBody(RUN_A),
    },
    tables: ["request_receipts", "position_collection_runs"],
  },
  {
    id: "err-04-wrong-token",
    group: "오류와 경계",
    name: "틀린 token 은 401 UNAUTHORIZED 다",
    precondition: "빈 DB",
    given: [],
    request: {
      label: "틀린 token 으로 회사 선호 조회",
      method: "GET",
      path: "/api/positions/v1/company-preferences",
      token: "wrong-token-0000000000000000000000",
    },
    tables: [],
  },
  {
    id: "err-05-missing-token",
    group: "오류와 경계",
    name: "token 이 없으면 401 UNAUTHORIZED 다",
    precondition: "빈 DB",
    given: [],
    request: {
      label: "Authorization 없이 회사 선호 조회",
      method: "GET",
      path: "/api/positions/v1/company-preferences",
      auth: false,
    },
    tables: [],
  },
  {
    id: "err-06-body-too-large",
    group: "오류와 경계",
    name: "상한을 넘는 본문은 400 BODY_TOO_LARGE 다",
    precondition: "본문 상한이 기본값 2 MiB 인 상태",
    given: [],
    request: {
      label: "2 MiB 를 넘는 본문으로 수집 실행 저장",
      method: "POST",
      path: "/api/positions/v1/collection-runs",
      idempotencyKey: "err-06-key",
      paddedJsonBytes: 2 * 1024 * 1024 + 100,
    },
    tables: ["request_receipts"],
  },
  {
    id: "err-07-unknown-path",
    group: "오류와 경계",
    name: "없는 경로는 404 NOT_FOUND 다",
    precondition: "빈 DB",
    given: [],
    request: {
      label: "없는 경로 조회",
      method: "GET",
      path: "/api/positions/v1/unknown-resource",
    },
    tables: [],
  },
  {
    id: "err-08-unknown-run-id",
    group: "오류와 경계",
    name: "없는 실행 ID 조회는 404 NOT_FOUND 다",
    precondition: "빈 DB",
    given: [],
    request: {
      label: "없는 실행 ID 조회",
      method: "GET",
      path: "/api/positions/v1/runs/does-not-exist",
    },
    tables: [],
  },
  {
    id: "err-09-schema-violation",
    group: "오류와 경계",
    name: "본문 schema 위반은 400 BAD_REQUEST 다",
    precondition: "빈 DB",
    given: [],
    request: {
      label: "슬롯 합계가 상한과 다른 분석 정책 설정",
      method: "PUT",
      path: "/api/positions/v1/analysis-policy",
      idempotencyKey: "err-09-key",
      body: policy({ prioritySlots: 3, agingSlots: 3, dailyAnalysisLimit: 5 }),
    },
    tables: ["position_analysis_policy", "request_receipts"],
  },
  {
    id: "err-10-policy-not-configured",
    group: "오류와 경계",
    name: "정책을 설정하지 않은 수집 요청은 409 POLICY_NOT_CONFIGURED 다",
    precondition: "정책이 없는 빈 DB",
    given: [],
    request: {
      label: "정책 없이 수집 실행 저장",
      method: "POST",
      path: "/api/positions/v1/collection-runs",
      idempotencyKey: "err-10-key",
      body: collectionBody(RUN_A),
    },
    tables: ["position_collection_runs", "request_receipts"],
  },
  {
    id: "err-11-company-tier-run-pending",
    group: "오류와 경계",
    name: "회사 tier 실행이 pending 이면 분석 실행 생성은 409 COMPANY_TIER_RUN_PENDING 이다",
    precondition: "회사 tier 결과를 아직 반영하지 않은 상태",
    given: [givenPolicy, givenCollection(RUN_A, "given-collection")],
    request: {
      label: "회사 tier 가 끝나기 전에 분석 실행 생성",
      method: "POST",
      path: `/api/positions/v1/collection-runs/${RUN_A}/analysis-runs`,
      idempotencyKey: "err-11-key",
      body: {},
    },
    tables: ["position_analysis_runs", "company_tier_assessment_runs"],
  },
  {
    id: "err-12-company-tier-run-missing",
    group: "오류와 경계",
    name: "회사 tier 실행이 없으면 분석 실행 생성은 409 COMPANY_TIER_RUN_MISSING 이다",
    precondition:
      "수집 실행은 있으나 회사 tier 실행 행을 SQL 로 지워 회사 tier 평가 도입 전 상태를 만든 뒤",
    given: [
      givenPolicy,
      givenCollection(RUN_A, "given-collection"),
      {
        kind: "sql",
        label: "회사 tier 실행 행을 지운다",
        statement: "DELETE FROM company_tier_assessment_runs",
      },
    ],
    request: {
      label: "회사 tier 실행이 없는 수집으로 분석 실행 생성",
      method: "POST",
      path: `/api/positions/v1/collection-runs/${RUN_A}/analysis-runs`,
      idempotencyKey: "err-12-key",
      body: {},
    },
    tables: ["position_analysis_runs", "company_tier_assessment_runs"],
  },
  {
    id: "err-13-tier-results-unknown-company",
    group: "오류와 경계",
    name: "끝난 회사 tier 실행에 그 실행이 고르지 않은 회사를 보내면 409 VERSION_CONFLICT 다",
    precondition: "회사 tier 실행이 completed 인 상태",
    given: happyPathToTierResults(RUN_A),
    request: {
      label: "고르지 않은 회사를 담은 회사 tier 결과 반영",
      method: "POST",
      path: (context) =>
        `/api/positions/v1/company-tier-runs/${context.prep.companyTierQueue.companyTierRunId}/results`,
      idempotencyKey: "err-13-key",
      body: {
        schemaVersion: 1,
        collectionRunId: RUN_A,
        results: [tierResult("회사 없음", 2)],
        failures: [],
      },
      derivedFields: ["path: 앞선 수집 응답의 companyTierQueue.companyTierRunId"],
    },
    tables: ["company_tier_assessment_runs", "company_tier_assessments"],
  },
  {
    id: "err-14-analysis-results-partial-submission",
    group: "오류와 경계",
    name: "아직 끝나지 않은 항목 일부만 보내면 409 VERSION_CONFLICT 다",
    precondition: "분석 실행에 대기 항목이 두 개인 상태",
    given: happyPathToAnalysisRun(RUN_A),
    request: {
      label: "두 항목 중 하나만 담은 분석 결과 반영",
      method: "POST",
      path: (context) => `/api/positions/v1/analysis-runs/${context.queue.analysisRunId}/results`,
      idempotencyKey: "err-14-key",
      body: analysisResultsBody(RUN_A, "queue", 1),
      derivedFields: [
        "path: 앞선 분석 실행 응답의 analysisRunId",
        "body.results[].positionId: 앞선 분석 실행 응답의 candidates[0].positionId",
      ],
    },
    tables: ["position_analysis_runs", "position_analysis_run_items"],
  },
  {
    id: "err-15a-company-tier-lease-expired",
    group: "오류와 경계",
    name: "처리 중 표시가 2시간을 넘으면 회사 tier 결과 반영은 409 COMPANY_TIER_LEASE_EXPIRED 다",
    precondition: "회사 tier 실행의 created_at 을 SQL 로 3시간 전으로 바꾼 뒤",
    given: [
      givenPolicy,
      givenCollection(RUN_A, "given-collection"),
      {
        kind: "sql",
        label: "회사 tier 실행을 3시간 전으로 돌린다",
        statement:
          "UPDATE company_tier_assessment_runs SET created_at = DATE_SUB(NOW(3), INTERVAL 3 HOUR)",
      },
    ],
    request: {
      label: "임차권이 끝난 회사 tier 실행에 결과 반영",
      method: "POST",
      path: (context) =>
        `/api/positions/v1/company-tier-runs/${context.prep.companyTierQueue.companyTierRunId}/results`,
      idempotencyKey: "err-15a-key",
      body: {
        schemaVersion: 1,
        collectionRunId: RUN_A,
        results: [tierResult(COMPANY_1, 1), tierResult(COMPANY_2, 2)],
        failures: [],
      },
      derivedFields: ["path: 앞선 수집 응답의 companyTierQueue.companyTierRunId"],
    },
    tables: ["company_tier_assessment_runs", "company_tier_assessment_run_items"],
  },
  {
    id: "err-15b-company-tier-lease-reclaimed",
    group: "오류와 경계",
    name: "임차권이 끝난 회사는 회수돼 lease_expired 로 남고 다음 수집에서 다시 선택된다",
    precondition: "임차권이 끝난 회사 tier 실행이 있고 결과 반영이 이미 거절된 뒤",
    given: [
      givenPolicy,
      givenCollection(RUN_A, "given-collection"),
      {
        kind: "sql",
        label: "회사 tier 실행을 3시간 전으로 돌린다",
        statement:
          "UPDATE company_tier_assessment_runs SET created_at = DATE_SUB(NOW(3), INTERVAL 3 HOUR)",
      },
    ],
    request: {
      label: "다음 수집 실행을 저장한다",
      method: "POST",
      path: "/api/positions/v1/collection-runs",
      idempotencyKey: "err-15b-key",
      body: collectionBody(RUN_B),
    },
    tables: ["company_tier_assessment_runs", "company_tier_assessment_run_items"],
    dbNote:
      "앞 수집의 항목은 result_status failed 와 failure_code lease_expired 로 바뀌고, 새 수집이 같은 회사를 다시 고른다.",
  },
  {
    id: "err-16-analysis-run-partial",
    group: "오류와 경계",
    name: "실패 한 건을 함께 보내면 분석 실행 상태가 partial 이 된다",
    precondition: "분석 실행에 대기 항목이 두 개인 상태",
    given: happyPathToAnalysisRun(RUN_A),
    request: {
      label: "성공 한 건과 실패 한 건을 함께 반영",
      method: "POST",
      path: (context) => `/api/positions/v1/analysis-runs/${context.queue.analysisRunId}/results`,
      idempotencyKey: "err-16-key",
      body: (context) => {
        const candidates = context.queue.candidates as Array<{ positionId: string }>;
        return {
          schemaVersion: 2,
          collectionRunId: RUN_A,
          results: [analysisResult(candidates[0].positionId)],
          failures: [{ positionId: candidates[1].positionId, failureCode: "posting_body_missing" }],
        };
      },
      derivedFields: [
        "path: 앞선 분석 실행 응답의 analysisRunId",
        "body.results[].positionId 과 body.failures[].positionId: 앞선 분석 실행 응답의 candidates[].positionId",
      ],
    },
    tables: ["position_analysis_runs", "position_analysis_run_items", "position_analyses"],
  },
  {
    id: "err-17-analysis-run-completed-after-retry",
    group: "오류와 경계",
    name: "남은 항목만 다시 보내면 분석 실행이 completed 가 된다",
    precondition: "실패 한 건이 남아 분석 실행이 partial 인 상태",
    given: [
      ...happyPathToAnalysisRun(RUN_A),
      {
        label: "성공 한 건과 실패 한 건을 먼저 반영한다",
        method: "POST",
        path: (context) => `/api/positions/v1/analysis-runs/${context.queue.analysisRunId}/results`,
        idempotencyKey: "given-partial-results",
        body: (context) => {
          const candidates = context.queue.candidates as Array<{ positionId: string }>;
          return {
            schemaVersion: 2,
            collectionRunId: RUN_A,
            results: [analysisResult(candidates[0].positionId)],
            failures: [
              { positionId: candidates[1].positionId, failureCode: "posting_body_missing" },
            ],
          };
        },
        derivedFields: ["앞선 분석 실행 응답의 analysisRunId 와 candidates[].positionId"],
      },
    ],
    request: {
      label: "남은 한 건만 다시 반영",
      method: "POST",
      path: (context) => `/api/positions/v1/analysis-runs/${context.queue.analysisRunId}/results`,
      idempotencyKey: "err-17-key",
      body: (context) => {
        const candidates = context.queue.candidates as Array<{ positionId: string }>;
        return {
          schemaVersion: 2,
          collectionRunId: RUN_A,
          results: [analysisResult(candidates[1].positionId, 70)],
          failures: [],
        };
      },
      derivedFields: [
        "path: 앞선 분석 실행 응답의 analysisRunId",
        "body.results[].positionId: 앞선 분석 실행 응답의 candidates[1].positionId",
      ],
    },
    tables: ["position_analysis_runs", "position_analysis_run_items", "position_analyses"],
  },
  {
    id: "err-18-company-tier-queue-empty",
    group: "오류와 경계",
    name: "회사 tier 대기열이 비면 회사 tier 실행이 만들어지는 즉시 completed 다",
    precondition: "앞선 수집에서 두 회사의 tier 평가가 이미 유효한 상태",
    given: happyPathToTierResults(RUN_A),
    request: {
      label: "같은 회사들로 다음 수집 실행 저장",
      method: "POST",
      path: "/api/positions/v1/collection-runs",
      idempotencyKey: "err-18-key",
      body: collectionBody(RUN_B),
    },
    tables: ["company_tier_assessment_runs", "company_tier_assessment_run_items"],
  },
  {
    id: "err-19-recommendation-without-new-analysis",
    group: "오류와 경계",
    name: "분석 대상이 없으면 추천은 재사용 수와 분석 대기 수와 수집 진단을 담는다",
    precondition:
      "앞선 수집에서 두 공고를 모두 분석했고, 같은 공고로 다음 수집을 저장해 분석 대기가 비어 있는 상태",
    given: [
      givenPolicy,
      givenCollection(RUN_A, "given-collection", [1, 2], "partial"),
      givenTierResults(RUN_A, "given-tier-results", [
        [COMPANY_1, 1],
        [COMPANY_2, 2],
      ]),
      givenAnalysisRun(RUN_A, "given-analysis-run"),
      givenAnalysisResults(RUN_A, "given-analysis-results"),
      givenCollection(RUN_B, "given-collection-b", [1, 2], "partial", "prepB"),
      givenAnalysisRun(RUN_B, "given-analysis-run-b", "queueB"),
    ],
    request: {
      label: "분석 대상이 없는 실행으로 추천 생성",
      method: "POST",
      path: "/api/positions/v1/recommendation-runs",
      idempotencyKey: "err-19-key",
      body: (context) => ({ schemaVersion: 1, analysisRunId: context.queueB.analysisRunId }),
      derivedFields: ["body.analysisRunId: 두 번째 분석 실행 응답의 analysisRunId"],
    },
    tables: ["position_recommendation_runs", "position_recommendation_items"],
  },
  {
    id: "err-20-tier-resolution-prefers-manual",
    group: "오류와 경계",
    name: "사람 override 와 모델 평가를 모두 가진 회사는 manual 로 해결된다",
    precondition:
      "회사 1 에 모델 평가가 이미 있고 그 뒤 사람 override 를 설정한 상태. 회사 2 는 모델 평가만 가진다",
    given: [
      givenPolicy,
      givenCollection(RUN_A, "given-collection"),
      givenTierResults(RUN_A, "given-tier-results", [
        [COMPANY_1, 1],
        [COMPANY_2, 2],
      ]),
      {
        label: "회사 1 에 사람 override 를 설정한다",
        method: "PUT",
        path: `/api/positions/v1/company-preferences/${encodeURIComponent(COMPANY_1)}`,
        idempotencyKey: "given-manual-override",
        body: { companyKey: COMPANY_1, companyName: COMPANY_1, tier: 3, disposition: "analyze" },
      },
      givenCollection(RUN_B, "given-collection-b", [1, 2], "ok", "prepB"),
      givenAnalysisRun(RUN_B, "given-analysis-run-b", "queueB"),
      givenAnalysisResults(RUN_B, "given-analysis-results-b", "queueB"),
    ],
    request: {
      label: "추천 생성으로 tier 출처를 확인",
      method: "POST",
      path: "/api/positions/v1/recommendation-runs",
      idempotencyKey: "err-20-key",
      body: (context) => ({ schemaVersion: 1, analysisRunId: context.queueB.analysisRunId }),
      derivedFields: ["body.analysisRunId: 두 번째 분석 실행 응답의 analysisRunId"],
    },
    tables: ["position_recommendation_items", "position_analysis_run_items"],
  },
  {
    id: "err-21-excluded-company-dropped",
    group: "오류와 경계",
    name: "exclude 인 회사는 tier 값을 해결하기 전에 제거된다",
    precondition: "회사 2 의 선호가 exclude 인 상태",
    given: [
      givenPolicy,
      {
        label: "회사 2 를 exclude 로 설정한다",
        method: "PUT",
        path: `/api/positions/v1/company-preferences/${encodeURIComponent(COMPANY_2)}`,
        idempotencyKey: "given-exclude",
        body: { companyKey: COMPANY_2, companyName: COMPANY_2, tier: 3, disposition: "exclude" },
      },
    ],
    request: {
      label: "exclude 회사를 담은 수집 실행 저장",
      method: "POST",
      path: "/api/positions/v1/collection-runs",
      idempotencyKey: "err-21-key",
      body: collectionBody(RUN_A),
    },
    tables: [
      "positions",
      "position_collection_runs",
      "company_tier_assessment_runs",
      "company_tier_assessment_run_items",
    ],
  },
];

// ---------------------------------------------------------------- 실행

type CaseRecord = {
  id: string;
  group: string;
  name: string;
  precondition: string;
  given: Array<
    | { kind: "request"; label: string; request: RecordedRequest; responseStatus: number }
    | { kind: "sql"; label: string; statement: string }
  >;
  request: RecordedRequest;
  response: RecordedResponse;
  database: { note?: string; tables: Record<string, unknown[]> };
};

async function runCase(sql: Bun.SQL, spec: CaseSpec): Promise<CaseRecord> {
  await truncateAll(sql);
  const context: Context = {};
  const given: CaseRecord["given"] = [];
  for (const step of spec.given) {
    if ("kind" in step && step.kind === "sql") {
      await sql.unsafe(step.statement).simple();
      given.push({ kind: "sql", label: step.label, statement: step.statement });
      continue;
    }
    const executed = await sendRequest(sql, step as RequestStep, context);
    given.push({
      kind: "request",
      label: (step as RequestStep).label,
      request: executed.request,
      responseStatus: executed.response.status,
    });
  }
  const main = await sendRequest(sql, spec.request, context);
  const tables = await snapshotTables(sql, spec.tables);
  return {
    id: spec.id,
    group: spec.group,
    name: spec.name,
    precondition: spec.precondition,
    given,
    request: main.request,
    response: main.response,
    database: { ...(spec.dbNote ? { note: spec.dbNote } : {}), tables },
  };
}

async function runSuite(): Promise<CaseRecord[]> {
  const sql = new Bun.SQL(DATABASE_URL);
  try {
    const records: CaseRecord[] = [];
    for (const spec of cases) {
      records.push(await runCase(sql, spec));
    }
    return records;
  } finally {
    await sql.close();
  }
}

function diffPaths(left: unknown, right: unknown, path = ""): string[] {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return [path || "$"];
    return left.flatMap((entry, index) => diffPaths(entry, right[index], `${path}[${index}]`));
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].flatMap((key) =>
      diffPaths((left as Json)[key], (right as Json)[key], path ? `${path}.${key}` : key),
    );
  }
  return left === right ? [] : [path || "$"];
}

function knownVolatilePaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => knownVolatilePaths(entry, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Json).flatMap(([key, entry]) => {
      const next = path ? `${path}.${key}` : key;
      return KNOWN_VOLATILE_FIELDS.has(key) ? [next] : knownVolatilePaths(entry, next);
    });
  }
  return [];
}

const started = Date.now();
await resetDatabase();
const first = await runSuite();
await resetDatabase();
const second = await runSuite();

const output = first.map((record, index) => {
  const other = second[index];
  const detected = diffPaths(record.response.body, other.response.body);
  const declared = knownVolatilePaths(record.response.body);
  const volatileResponsePaths = [...new Set([...detected, ...declared])].sort();
  const unstableTables = Object.keys(record.database.tables).filter(
    (table) =>
      JSON.stringify(record.database.tables[table]) !==
      JSON.stringify(other.database.tables[table]),
  );
  return {
    ...record,
    response: { ...record.response, volatileResponsePaths },
    ...(unstableTables.length > 0 ? { unstableTables } : {}),
  };
});

const unstable = output.filter((record) => "unstableTables" in record);
if (unstable.length > 0) {
  console.error(
    JSON.stringify(
      { error: "두 회차의 DB 행이 달랐다", cases: unstable.map((record) => record.id) },
      null,
      2,
    ),
  );
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      capturedFrom: "career-os/services/recommendation-api (Bun 구현)",
      capturedWith: "test/fixtures/legacy-contract/capture-legacy.bun.ts",
      apiToken: API_TOKEN,
      databaseUrlShape: `mysql://<user>:<password>@<host>:<port>/${DATABASE}`,
      maxBodyBytes: CONFIG.maxBodyBytes,
      comparedColumns: TABLE_COLUMNS,
      cases: output,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  JSON.stringify({
    cases: output.length,
    ok: output.filter((record) => record.group === "정상 경로").length,
    error: output.filter((record) => record.group === "오류와 경계").length,
    errorCodes: [
      ...new Set(
        output
          .map((record) => (record.response.body as any)?.error?.code)
          .filter((code): code is string => typeof code === "string"),
      ),
    ].sort(),
    unstableTables: unstable.map((record) => record.id),
    elapsedMs: Date.now() - started,
  }),
);
