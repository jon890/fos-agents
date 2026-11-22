import { afterEach, describe, expect, test } from "bun:test";
import type { CareerDatabase } from "../database.ts";
import { CareerStoreError } from "../errors.ts";
import { cleanupCareerWorkspaces, createCareerWorkspace } from "../test-support.ts";
import {
  ANALYSIS_POLICY_PATH,
  legacyCases as cases,
  materializeBody,
  PREFIX,
  type LegacyRequest,
} from "./legacy-fixture.ts";
import { PositionStore } from "./store.ts";

/** HTTP 계층(인증, health, 본문 크기, 경로 분기)만 보는 case 다. 저장 모듈에는 그 계층이 없다. */
const HTTP_ONLY = new Set([
  "ok-01-health-live",
  "ok-02-health-ready",
  "ok-03-auth-check",
  "err-04-wrong-token",
  "err-05-missing-token",
  "err-06-body-too-large",
  "err-07-unknown-path",
]);

function expectedBody(path: string, body: unknown): unknown {
  if (path !== ANALYSIS_POLICY_PATH || typeof body !== "object" || body === null) return body;
  const { candidateContextVersion: _removed, ...rest } = body as Record<string, unknown>;
  return rest;
}

/** 기록 뒤에 응답에 더해진 칸이다. 기록에는 없으므로 대조에서 뺀다. */
const LATER_RESPONSE_FIELDS = ["companyAssessments"];

function withoutLaterFields(body: unknown): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return body;
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => !LATER_RESPONSE_FIELDS.includes(key)),
  );
}

function maskVolatile(value: unknown, paths: string[]): unknown {
  const masked = structuredClone(value) as Record<string, unknown>;
  for (const path of paths) {
    const tokens = path.split(/[.[\]]/).filter(Boolean);
    let cursor: unknown = masked;
    for (const token of tokens.slice(0, -1)) cursor = (cursor as Record<string, unknown>)?.[token];
    const last = tokens.at(-1)!;
    if (cursor && typeof cursor === "object" && last in (cursor as Record<string, unknown>)) {
      (cursor as Record<string, unknown>)[last] = "<실행마다 달라지는 값>";
    }
  }
  return masked;
}

/** 기록의 선행 SQL 은 MySQL 문장이다. 같은 상태를 만드는 SQLite 문장으로 바꿔 실행한다. */
function runGivenSql(db: CareerDatabase, statement: string): void {
  if (statement === "DELETE FROM company_tier_assessment_runs") {
    db.run(statement);
    return;
  }
  if (statement.startsWith("UPDATE company_tier_assessment_runs SET created_at = DATE_SUB(NOW(3), INTERVAL 3 HOUR)")) {
    db.run("UPDATE company_tier_assessment_runs SET created_at = ?", [
      new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    ]);
    return;
  }
  throw new Error(`옮기지 않은 선행 SQL: ${statement}`);
}

type Reply = { status: number; body: unknown };

/**
 * 기록의 분석 결과 본문은 그 실행에서 만들어진 공고 ID 를 담는다. 공고 ID 는 실행마다 새로 만들어지므로
 * 아직 끝나지 않은 큐 항목의 ID 를 선택 순서대로 채워 넣는다(기록의 `derivedFields` 가 말하는 치환).
 */
async function withCurrentPositionIds(
  store: PositionStore,
  analysisRunId: string,
  body: unknown,
): Promise<unknown> {
  const copy = structuredClone(body) as {
    results?: Array<{ positionId: string }>;
    failures?: Array<{ positionId: string }>;
  };
  let queue: Awaited<ReturnType<PositionStore["getRun"]>>;
  try {
    queue = await store.getRun(analysisRunId);
  } catch {
    return copy;
  }
  if (!("candidates" in queue)) return copy;
  const open = queue.candidates
    .filter((item) => item.resultStatus === "pending" || item.resultStatus === "failed")
    .map((item) => item.positionId);
  for (const entry of [...(copy.results ?? []), ...(copy.failures ?? [])]) {
    const next = open.shift();
    if (next) entry.positionId = next;
  }
  return copy;
}

async function dispatch(store: PositionStore, request: LegacyRequest): Promise<unknown> {
  const key = request.headers.idempotencyKey ?? "";
  const body = materializeBody(request.path, request.body);
  const route = `${request.method} ${request.path.slice(PREFIX.length)}`;
  let match: RegExpMatchArray | null;
  if (route === "PUT /analysis-policy") return store.configureAnalysisPolicy(body, key);
  if (route === "GET /company-preferences") return store.listCompanyPreferences();
  if ((match = route.match(/^PUT \/company-preferences\/(.+)$/))) {
    return store.updateCompanyPreference(decodeURIComponent(match[1]!), body, key);
  }
  if (route === "POST /collection-runs") return store.saveCollection(body, key);
  if ((match = route.match(/^POST \/collection-runs\/(.+)\/analysis-runs$/))) {
    return store.createPositionAnalysisRun(decodeURIComponent(match[1]!), key);
  }
  if ((match = route.match(/^POST \/company-tier-runs\/(.+)\/results$/))) {
    return store.saveCompanyTierResults(match[1]!, body, key);
  }
  if ((match = route.match(/^POST \/analysis-runs\/(.+)\/results$/))) {
    return store.saveAnalysisResults(
      match[1]!,
      await withCurrentPositionIds(store, match[1]!, body),
      key,
    );
  }
  if (route === "POST /recommendation-runs") {
    return store.createRecommendation((body as { analysisRunId: string }).analysisRunId, key);
  }
  if ((match = route.match(/^GET \/runs\/(.+)$/))) return store.getRun(match[1]!);
  throw new Error(`저장 모듈에 대응하는 메서드가 없는 요청: ${route}`);
}

async function send(store: PositionStore, request: LegacyRequest): Promise<Reply> {
  try {
    const body = await dispatch(store, request);
    const created = request.method === "POST" && !request.path.endsWith("/results");
    return { status: created ? 201 : 200, body: JSON.parse(JSON.stringify(body)) };
  } catch (error) {
    if (!(error instanceof CareerStoreError)) throw error;
    return { status: error.status, body: { error: { code: error.code } } };
  }
}

afterEach(cleanupCareerWorkspaces);

describe("전환 전 HTTP 계약 기록을 저장 모듈에 다시 돌린다", () => {
  test("HTTP 계층만 보는 case 목록이 기록에 실제로 있다", () => {
    const ids = new Set(cases.map((entry) => entry.id));
    expect([...HTTP_ONLY].filter((id) => !ids.has(id))).toEqual([]);
  });

  for (const entry of cases.filter((candidate) => !HTTP_ONLY.has(candidate.id))) {
    test(entry.id, async () => {
      const { db } = createCareerWorkspace({ "position-preferences": "예시 선호 문장" });
      const store = new PositionStore(db);
      for (const given of entry.given) {
        if (given.kind === "sql") {
          runGivenSql(db, given.statement);
          continue;
        }
        const reply = await send(store, given.request);
        expect(reply.status, `선행 요청 ${given.label}`).toBe(given.responseStatus);
      }

      const reply = await send(store, entry.request);
      expect(reply.status).toBe(entry.response.status);
      if (reply.status >= 400) {
        const expected = entry.response.body as { error: { code: string } };
        expect((reply.body as { error: { code: string } }).error.code).toBe(expected.error.code);
        return;
      }
      const volatile = entry.response.volatileResponsePaths;
      expect(maskVolatile(withoutLaterFields(reply.body), volatile)).toEqual(
        maskVolatile(expectedBody(entry.request.path, entry.response.body), volatile),
      );
    });
  }
});
