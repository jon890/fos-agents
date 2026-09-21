import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { applyHttpLayers } from "../src/bootstrap.js";
import type { RecommendationApiConfig } from "../src/config/config.js";
import { RECOMMENDATION_CONFIG } from "../src/config/config.module.js";
import { stableUuid } from "../src/positions/hash.js";
import { companyTierProvenanceFields } from "../src/positions/tier-provenance.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import {
  legacyApiToken,
  legacyCase,
  legacyComparedColumns,
  type LegacyErrorBody,
  type LegacyRequest,
} from "./support/legacy-contract.js";

/** `schema_migrations` 와 `_prisma_migrations` 를 뺀 운영 table 전부. 자식 table 이 앞이다. */
const DATA_TABLES = [
  "position_recommendation_items",
  "position_recommendation_runs",
  "position_analysis_run_items",
  "position_analyses",
  "position_analysis_runs",
  "company_tier_assessment_run_items",
  "company_tier_assessments",
  "company_tier_assessment_runs",
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

function requireTestDatabaseUrl(): string {
  const url = process.env.CAREER_RECOMMENDATION_TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "CAREER_RECOMMENDATION_TEST_DATABASE_URL 이 없다. 테스트용 MySQL 연결 문자열을 준다.",
    );
  }
  return url;
}

type Reply = {
  status: number;
  cacheControl: string | null;
  requestId: string | null;
  json: unknown;
};

let app: INestApplication;
let baseUrl: string;
let prisma: PrismaService;
let databaseUrl: string;

async function send(
  method: string,
  path: string,
  options: { body?: unknown; idempotencyKey?: string } = {},
): Promise<Reply> {
  const headers: Record<string, string> = { Authorization: `Bearer ${legacyApiToken}` };
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    cacheControl: response.headers.get("Cache-Control"),
    requestId: response.headers.get("X-Request-Id"),
    json: text.length > 0 ? (JSON.parse(text) as unknown) : null,
  };
}

/** 포착 파일의 `given` 을 그대로 재생한다. 선행 상태를 손으로 다시 적지 않기 위해서다. */
async function replayGiven(id: string): Promise<void> {
  for (const entry of legacyCase(id).given) {
    if (entry.kind === "sql") {
      await prisma.$executeRawUnsafe(entry.statement);
      continue;
    }
    const reply = await send(entry.request.method, entry.request.path, {
      body: entry.request.body,
      idempotencyKey: entry.request.headers.idempotencyKey ?? undefined,
    });
    expect(reply.status, `${id} 의 선행 요청 ${entry.label}`).toBe(entry.responseStatus);
  }
}

function legacyRequest(id: string): LegacyRequest {
  return legacyCase(id).request;
}

async function sendLegacyRequest(id: string): Promise<Reply> {
  const request = legacyRequest(id);
  return send(request.method, request.path, {
    body: request.body,
    idempotencyKey: request.headers.idempotencyKey ?? undefined,
  });
}

function pathTokens(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((token) => token.length > 0);
}

/** 실행마다 달라지는 자리를 같은 표식으로 덮는다. 나머지는 그대로 비교한다. */
function maskVolatile(value: unknown, paths: string[]): unknown {
  const masked = structuredClone(value) as Record<string, unknown>;
  for (const path of paths) {
    const tokens = pathTokens(path);
    let cursor: unknown = masked;
    for (const token of tokens.slice(0, -1)) {
      cursor = (cursor as Record<string, unknown>)?.[token];
    }
    const last = tokens.at(-1)!;
    if (cursor && typeof cursor === "object" && last in (cursor as Record<string, unknown>)) {
      (cursor as Record<string, unknown>)[last] = "<실행마다 달라지는 값>";
    }
  }
  return masked;
}

function expectMatchesLegacy(id: string, reply: Reply): void {
  const expected = legacyCase(id).response;
  expect(reply.status, `${id} 의 status`).toBe(expected.status);
  expect(reply.cacheControl, `${id} 의 Cache-Control`).toBe(expected.cacheControl);
  expect(typeof reply.requestId === "string", `${id} 의 X-Request-Id 유무`).toBe(
    expected.hasRequestId,
  );
  const volatilePaths = expected.volatileResponsePaths;
  expect(maskVolatile(reply.json, volatilePaths), `${id} 의 응답 본문`).toEqual(
    maskVolatile(expected.body, volatilePaths),
  );
}

function expectMatchesLegacyError(id: string, reply: Reply): void {
  const expected = legacyCase(id).response;
  const body = structuredClone(expected.body) as LegacyErrorBody;
  body.error.requestId = reply.requestId!;
  expect(reply.status, `${id} 의 status`).toBe(expected.status);
  expect(reply.cacheControl, `${id} 의 Cache-Control`).toBe(expected.cacheControl);
  expect(reply.json, `${id} 의 오류 본문`).toEqual(body);
}

function normalizeCell(actual: unknown, expected: unknown): unknown {
  if (actual instanceof Date) return actual.toISOString();
  if (typeof actual === "bigint") return Number(actual);
  if (typeof actual === "boolean") return actual ? 1 : 0;
  if (typeof actual === "string" && expected !== null && typeof expected === "object") {
    return JSON.parse(actual);
  }
  return actual;
}

/** 쓰기 뒤의 DB 행을 포착 파일이 적은 table 과 열만 골라 대조한다. */
async function expectMatchesLegacyDatabase(id: string): Promise<void> {
  const tables = legacyCase(id).database?.tables;
  if (!tables) throw new Error(`${id} 에 DB 기대값이 없다`);
  for (const [table, expectedRows] of Object.entries(tables)) {
    const spec = legacyComparedColumns[table];
    if (!spec) throw new Error(`${table} 의 비교 열 목록이 없다`);
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${spec.columns.join(", ")} FROM ${table} ORDER BY ${spec.orderBy}`,
    );
    const actual = rows.map((row, index) =>
      Object.fromEntries(
        spec.columns.map((column) => [
          column,
          normalizeCell(row[column], expectedRows[index]?.[column] ?? null),
        ]),
      ),
    );
    expect(actual, `${id} 뒤의 ${table} 행`).toEqual(expectedRows);
  }
}

/**
 * case 사이의 데이터를 지운다. schema 는 그대로 둔다.
 *
 * `TRUNCATE` 대신 `DELETE` 를 쓴다. 외래 키 확인을 끄려면 같은 연결에서 이어 실행해야 하는데
 * pool 이 문장마다 다른 연결을 줄 수 있다. `DATA_TABLES` 를 자식 table 부터 적어 순서로 푼다.
 */
async function clearAll(): Promise<void> {
  for (const table of DATA_TABLES) {
    await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
  }
}

beforeAll(async () => {
  databaseUrl = requireTestDatabaseUrl();
  for (const key of ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USERNAME", "DB_PASSWORD"]) {
    delete process.env[key];
  }
  delete process.env.CAREER_RECOMMENDATION_API_TOKEN_FILE;
  delete process.env.CAREER_RECOMMENDATION_MAX_BODY_BYTES;
  process.env.CAREER_RECOMMENDATION_DATABASE_URL = databaseUrl;
  process.env.CAREER_RECOMMENDATION_API_TOKEN = legacyApiToken;
  app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
  applyHttpLayers(app, app.get<RecommendationApiConfig>(RECOMMENDATION_CONFIG));
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app?.close();
});

beforeEach(async () => {
  await clearAll();
});

describe("분석 정책과 회사 선호", () => {
  it("정책을 설정하면 저장한 정책을 그대로 돌려준다", async () => {
    expectMatchesLegacy("ok-04-put-analysis-policy", await sendLegacyRequest("ok-04-put-analysis-policy"));
    await expectMatchesLegacyDatabase("ok-04-put-analysis-policy");
  });

  it("회사 선호를 설정하면 갱신 시각이 붙은 선호를 돌려준다", async () => {
    expectMatchesLegacy(
      "ok-05-put-company-preference",
      await sendLegacyRequest("ok-05-put-company-preference"),
    );
    await expectMatchesLegacyDatabase("ok-05-put-company-preference");
  });

  it("회사 선호 목록은 회사 식별자 순으로 준다", async () => {
    await replayGiven("ok-06-get-company-preferences");
    expectMatchesLegacy(
      "ok-06-get-company-preferences",
      await sendLegacyRequest("ok-06-get-company-preferences"),
    );
    await expectMatchesLegacyDatabase("ok-06-get-company-preferences");
  });

  it("경로의 회사 식별자와 본문이 다르면 409 VERSION_CONFLICT 다", async () => {
    const reply = await send("PUT", "/api/positions/v1/company-preferences/other", {
      idempotencyKey: "mismatched-preference",
      body: { companyKey: "회사 1", companyName: "회사 1", tier: 1, disposition: "analyze" },
    });
    expect(reply.status).toBe(409);
    expect(reply.json).toEqual({
      error: {
        code: "VERSION_CONFLICT",
        message: "회사 식별자가 요청 경로와 다릅니다.",
        requestId: reply.requestId,
      },
    });
  });
});

describe("수집 실행 저장", () => {
  it("수집 실행을 저장하면 201 과 회사 tier 대기열을 준다", async () => {
    await replayGiven("ok-07-post-collection-run");
    expectMatchesLegacy("ok-07-post-collection-run", await sendLegacyRequest("ok-07-post-collection-run"));
    await expectMatchesLegacyDatabase("ok-07-post-collection-run");
  });

  it("정책을 설정하지 않은 수집 요청은 409 POLICY_NOT_CONFIGURED 다", async () => {
    expectMatchesLegacyError(
      "err-10-policy-not-configured",
      await sendLegacyRequest("err-10-policy-not-configured"),
    );
    await expectMatchesLegacyDatabase("err-10-policy-not-configured");
  });

  it("같은 수집 실행을 다른 멱등 키로 다시 저장하면 첫 응답과 같다", async () => {
    await replayGiven("ok-07-post-collection-run");
    const request = legacyRequest("ok-07-post-collection-run");
    const first = await send(request.method, request.path, {
      body: request.body,
      idempotencyKey: "collection-first",
    });
    const second = await send(request.method, request.path, {
      body: request.body,
      idempotencyKey: "collection-second",
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const volatilePaths = legacyCase("ok-07-post-collection-run").response.volatileResponsePaths;
    expect(maskVolatile(second.json, volatilePaths), "두 번째 응답").toEqual(
      maskVolatile(first.json, volatilePaths),
    );
    const runs = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) AS total FROM company_tier_assessment_runs
    `;
    expect(Number(runs[0]!.total), "회사 tier 실행 수").toBe(1);
  });

  it("exclude 인 회사는 tier 값을 해결하기 전에 제거된다", async () => {
    await replayGiven("err-21-excluded-company-dropped");
    expectMatchesLegacy(
      "err-21-excluded-company-dropped",
      await sendLegacyRequest("err-21-excluded-company-dropped"),
    );
    await expectMatchesLegacyDatabase("err-21-excluded-company-dropped");
  });

  it("회사 tier 대기열이 비면 실행이 만들어지는 즉시 completed 다", async () => {
    await replayGiven("err-18-company-tier-queue-empty");
    expectMatchesLegacy(
      "err-18-company-tier-queue-empty",
      await sendLegacyRequest("err-18-company-tier-queue-empty"),
    );
    await expectMatchesLegacyDatabase("err-18-company-tier-queue-empty");
  });
});

describe("회사 tier 결과 반영", () => {
  it("결과를 반영하면 200 과 completed 집계를 준다", async () => {
    await replayGiven("ok-08-post-company-tier-results");
    expectMatchesLegacy(
      "ok-08-post-company-tier-results",
      await sendLegacyRequest("ok-08-post-company-tier-results"),
    );
    await expectMatchesLegacyDatabase("ok-08-post-company-tier-results");
  });

  it("끝난 실행에 그 실행이 고르지 않은 회사를 보내면 409 VERSION_CONFLICT 다", async () => {
    await replayGiven("err-13-tier-results-unknown-company");
    expectMatchesLegacyError(
      "err-13-tier-results-unknown-company",
      await sendLegacyRequest("err-13-tier-results-unknown-company"),
    );
    await expectMatchesLegacyDatabase("err-13-tier-results-unknown-company");
  });

  it("처리 중 표시가 2시간을 넘으면 409 COMPANY_TIER_LEASE_EXPIRED 다", async () => {
    await replayGiven("err-15a-company-tier-lease-expired");
    expectMatchesLegacyError(
      "err-15a-company-tier-lease-expired",
      await sendLegacyRequest("err-15a-company-tier-lease-expired"),
    );
    await expectMatchesLegacyDatabase("err-15a-company-tier-lease-expired");
  });

  it("임차권이 끝난 회사는 lease_expired 로 회수되고 다음 수집이 다시 고른다", async () => {
    await replayGiven("err-15b-company-tier-lease-reclaimed");
    await sendLegacyRequest("err-15a-company-tier-lease-expired");
    expectMatchesLegacy(
      "err-15b-company-tier-lease-reclaimed",
      await sendLegacyRequest("err-15b-company-tier-lease-reclaimed"),
    );
    await expectMatchesLegacyDatabase("err-15b-company-tier-lease-reclaimed");
  });

  it("실패로 보고한 회사는 평가 ID 없이 failed 로 남는다", async () => {
    await replayGiven("ok-08-post-company-tier-results");
    const queue = await companyTierQueue();
    const reply = await send(
      "POST",
      `/api/positions/v1/company-tier-runs/${queue.companyTierRunId}/results`,
      {
        idempotencyKey: "tier-failures",
        body: {
          schemaVersion: 1,
          collectionRunId: queue.collectionRunId,
          results: [],
          failures: queue.companies.map((company) => ({
            companyKey: company.companyKey,
            failureCode: "research_unavailable",
          })),
        },
      },
    );
    expect(reply.status).toBe(200);
    expect(reply.json).toMatchObject({ status: "partial", failedCount: 2, applied: true });
    const rows = await prisma.$queryRaw<
      { company_key: string; result_status: string; company_tier_assessment_id: string | null }[]
    >`
      SELECT company_key, result_status, company_tier_assessment_id
      FROM company_tier_assessment_run_items ORDER BY selection_order
    `;
    expect(rows.map((row) => row.result_status)).toEqual(["failed", "failed"]);
    expect(rows.map((row) => row.company_tier_assessment_id)).toEqual([null, null]);
  });

  /**
   * 사람 override 와 기본 tier 는 평가 ID 를 붙이지 않는다.
   * DB 의 `CHECK` 제약이 그것을 강제하므로 값을 만드는 함수가 먼저 지켜야 한다.
   */
  it("manual 과 default 출처에는 평가 ID 가 붙지 않는다", () => {
    for (const source of ["manual", "default"] as const) {
      const fields = companyTierProvenanceFields(source, {
        companyTierAssessmentId: "assessment-1",
        companyKey: "회사 1",
        companyName: "회사 1",
        candidateContextVersion: "context-1",
        contractVersion: 1,
        createdByCompanyTierRunId: null,
        recommendedTier: 1,
        confidence: "medium",
        reason: "이유",
        signals: {},
        evidence: [],
        assumptions: [],
        assessedAt: "2026-09-20T00:00:00.000Z",
        validUntil: "2026-12-19",
      });
      expect(fields.companyTierAssessmentId, `${source} 출처의 평가 ID`).toBeUndefined();
      expect(fields.companyTierEvidenceUrls).toEqual([]);
    }
  });
});

/**
 * 같은 실행에 멱등 키가 다른 두 요청을 동시에 보낸다.
 *
 * 행 잠금이 없으면 둘 다 대기 항목을 pending 으로 읽어 각자 평가를 만든다.
 * `company_tier_assessments` 가 회사마다 두 행이 되고 시도 횟수도 2가 된다.
 */
describe("같은 실행에 동시에 온 두 요청", () => {
  it("하나만 반영되고 뒤섞인 상태가 남지 않는다", async () => {
    await replayGiven("ok-08-post-company-tier-results");
    const queue = await companyTierQueue();
    const request = legacyRequest("ok-08-post-company-tier-results");
    const path = `/api/positions/v1/company-tier-runs/${queue.companyTierRunId}/results`;
    const [first, second] = await Promise.all([
      send("POST", path, { body: request.body, idempotencyKey: "concurrent-a" }),
      send("POST", path, { body: request.body, idempotencyKey: "concurrent-b" }),
    ]);

    const replies = [first, second];
    expect(
      replies.filter((reply) => reply.status === 200 && (reply.json as { applied: boolean }).applied)
        .length,
      "실제로 반영한 요청 수",
    ).toBe(1);
    for (const reply of replies) {
      expect([200, 409], "동시 요청의 status").toContain(reply.status);
      if (reply.status === 200) {
        expect(reply.json).toMatchObject({ status: "completed", createdCount: 2, failedCount: 0 });
      }
    }

    const assessments = await prisma.$queryRaw<{ company_key: string }[]>`
      SELECT company_key FROM company_tier_assessments ORDER BY company_key
    `;
    expect(assessments.map((row) => row.company_key), "저장된 평가").toEqual(["회사 1", "회사 2"]);
    const items = await prisma.$queryRaw<{ attempt_count: number; result_status: string }[]>`
      SELECT attempt_count, result_status FROM company_tier_assessment_run_items
      ORDER BY selection_order
    `;
    expect(items.map((row) => Number(row.attempt_count)), "시도 횟수").toEqual([1, 1]);
    expect(items.map((row) => row.result_status)).toEqual(["created", "created"]);
  });
});

/**
 * 모델 호출을 아끼는 동작이다.
 * 전환 전에는 `scripts/position-recommender/company_tier_analysis_pipeline.test.ts` 가
 * 메모리 저장소 위에서 확인했다. 여기서는 실제 DB 위에서 같은 것을 확인한다.
 */
describe("회사 tier 평가를 다시 부르지 않는다", () => {
  const collectedAt = "2026-09-17T00:00:00.000Z";

  function policy(dailyCompanyTierLimit: number) {
    return {
      schemaVersion: 2,
      candidateContextVersion: "candidate-context-2026-09",
      dailyAnalysisLimit: 5,
      prioritySlots: 3,
      agingSlots: 2,
      staleAfterDays: 30,
      defaultCompanyTier: 2,
      dailyCompanyTierLimit,
      companyTierStaleAfterDays: 90,
    };
  }

  function pool(runId: string, companies: string[]) {
    return {
      schemaVersion: 2,
      analysisContractVersion: 1,
      companyTierContractVersion: 1,
      pool: {
        schemaVersion: 1,
        collectionRunId: runId,
        collectedAt,
        requestedSource: "all",
        configuredSources: ["wanted"],
        policy: {
          selection: "llm",
          activeDirectOnly: true,
          fixedPreferenceKeywordsUsed: false,
          sourcePriorityUsed: false,
        },
        candidates: companies.map((company, index) => ({
          id: `wanted:${runId}-${index}`,
          source: "wanted",
          company,
          title: `Backend Engineer ${index}`,
          url: `https://example.com/jobs/${runId}-${index}`,
          identityHash: `wanted-${runId}-${index}`,
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
        })),
        sourceDiagnostics: [
          {
            source: "wanted",
            status: "ok",
            collectedCount: companies.length,
            importedCount: companies.length,
            skippedCount: 0,
            failedCount: 0,
            discoveryModes: ["broad"],
            message: "ok",
          },
        ],
        filterSummary: { personalExcludedCount: 0 },
        errors: [],
      },
    };
  }

  function tierResult(companyKey: string, tier: number) {
    return {
      companyKey,
      recommendedTier: tier,
      confidence: "medium" as const,
      reason: "공개 자료로 성장 범위를 확인했다.",
      signals: [
        { axis: "growth-scope" as const, level: "medium" as const },
        { axis: "compensation-upside" as const, level: "unknown" as const },
        { axis: "team-growth" as const, level: "unknown" as const },
      ],
      evidence: [{ url: "https://example.com/company", checkedAt: "2026-09-17" }],
      assumptions: [],
    };
  }

  async function collect(runId: string, companies: string[], key: string) {
    const reply = await send("POST", "/api/positions/v1/collection-runs", {
      idempotencyKey: key,
      body: pool(runId, companies),
    });
    expect(reply.status, `${runId} 수집 status`).toBe(201);
    return (reply.json as { companyTierQueue: { companyTierRunId: string; companies: { companyKey: string }[] } })
      .companyTierQueue;
  }

  async function assess(runId: string, companyTierRunId: string, keys: string[], key: string) {
    const reply = await send(
      "POST",
      `/api/positions/v1/company-tier-runs/${companyTierRunId}/results`,
      {
        idempotencyKey: key,
        body: {
          schemaVersion: 1,
          collectionRunId: runId,
          results: keys.map((companyKey, index) => tierResult(companyKey, index + 1)),
          failures: [],
        },
      },
    );
    expect(reply.status, `${runId} 결과 반영 status`).toBe(200);
  }

  beforeEach(async () => {
    expect(
      (
        await send("PUT", "/api/positions/v1/analysis-policy", {
          idempotencyKey: "tier-policy",
          body: policy(1),
        })
      ).status,
    ).toBe(200);
  });

  it("첫 실행은 상한만큼만 평가한다", async () => {
    const queue = await collect("collection-1", ["회사 1", "회사 2", "회사 3"], "collect-1");
    expect(queue.companies.map((company) => company.companyKey)).toEqual(["회사 1"]);
  });

  it("둘째 실행은 전날 유효 평가를 다시 모델에 넘기지 않는다", async () => {
    const first = await collect("collection-1", ["회사 1", "회사 2"], "collect-1");
    await assess("collection-1", first.companyTierRunId, ["회사 1"], "assess-1");
    const second = await collect("collection-2", ["회사 1", "회사 2"], "collect-2");
    expect(second.companies.map((company) => company.companyKey)).toEqual(["회사 2"]);
  });

  it("모든 회사 평가가 유효하면 회사 모델 분석을 전혀 실행하지 않는다", async () => {
    await send("PUT", "/api/positions/v1/analysis-policy", {
      idempotencyKey: "tier-policy-wide",
      body: policy(5),
    });
    const first = await collect("collection-1", ["회사 1", "회사 2"], "collect-1");
    expect(first.companies).toHaveLength(2);
    await assess("collection-1", first.companyTierRunId, ["회사 1", "회사 2"], "assess-1");
    const second = await collect("collection-2", ["회사 1", "회사 2"], "collect-2");
    expect(second.companies).toEqual([]);
    expect(second.companyTierRunId).toBe(stableUuid("company-tier:collection-2"));
    const runs = await prisma.$queryRaw<{ status: string }[]>`
      SELECT status FROM company_tier_assessment_runs ORDER BY collection_run_id
    `;
    expect(runs.map((row) => row.status)).toEqual(["completed", "completed"]);
  });
});

/** 앞선 수집이 만든 회사 tier 대기열을 읽는다. */
async function companyTierQueue(): Promise<{
  companyTierRunId: string;
  collectionRunId: string;
  companies: { companyKey: string }[];
}> {
  const rows = await prisma.$queryRaw<{ company_tier_run_id: string; collection_run_id: string }[]>`
    SELECT company_tier_run_id, collection_run_id FROM company_tier_assessment_runs
  `;
  const run = rows[0]!;
  const items = await prisma.$queryRaw<{ company_key: string }[]>`
    SELECT company_key FROM company_tier_assessment_run_items
    WHERE company_tier_run_id = ${run.company_tier_run_id} ORDER BY selection_order
  `;
  return {
    companyTierRunId: run.company_tier_run_id,
    collectionRunId: run.collection_run_id,
    companies: items.map((item) => ({ companyKey: item.company_key })),
  };
}
