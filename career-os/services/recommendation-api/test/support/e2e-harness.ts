import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { expect } from "vitest";

import { AppModule } from "../../src/app.module.js";
import { applyHttpLayers } from "../../src/bootstrap.js";
import type { RecommendationApiConfig } from "../../src/config/config.js";
import { RECOMMENDATION_CONFIG } from "../../src/config/config.module.js";
import { PrismaService } from "../../src/prisma/prisma.service.js";
import {
  legacyApiToken,
  legacyCase,
  legacyComparedColumns,
  materializeLegacyBody,
  type LegacyErrorBody,
  type LegacyGiven,
  type LegacyRequest,
} from "./legacy-contract.js";

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
  "position_exclusions",
  "request_receipts",
];

export type Reply = {
  status: number;
  cacheControl: string | null;
  requestId: string | null;
  json: unknown;
};

export type SendOptions = { body?: unknown; idempotencyKey?: string };

function requireTestDatabaseUrl(): string {
  const url = process.env.CAREER_RECOMMENDATION_TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "CAREER_RECOMMENDATION_TEST_DATABASE_URL 이 없다. 테스트용 MySQL 연결 문자열을 준다.",
    );
  }
  return url;
}

function pathTokens(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((token) => token.length > 0);
}

/** 실행마다 달라지는 자리를 같은 표식으로 덮는다. 나머지는 그대로 비교한다. */
export function maskVolatile(value: unknown, paths: string[]): unknown {
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

function normalizeCell(actual: unknown, expected: unknown): unknown {
  if (actual instanceof Date) return actual.toISOString();
  if (typeof actual === "bigint") return Number(actual);
  if (typeof actual === "boolean") return actual ? 1 : 0;
  if (typeof actual === "string" && expected !== null && typeof expected === "object") {
    return JSON.parse(actual);
  }
  return actual;
}

/**
 * 전환 후 서버를 실제 MySQL 위에 띄우고, 포착 파일과 대조하는 도구를 함께 준다.
 *
 * 포착 파일을 읽어 요청을 재생하고 응답과 DB 행을 비교하는 방식은 e2e 검사마다 같다.
 * 검사 파일마다 다시 적으면 비교 규칙이 갈라진다.
 */
export type E2eHarness = {
  app: INestApplication;
  prisma: PrismaService;
  baseUrl: string;
  send(method: string, path: string, options?: SendOptions): Promise<Reply>;
  /** 포착 파일의 `given` 을 그대로 재생한다. 선행 상태를 손으로 다시 적지 않기 위해서다. */
  replayGiven(id: string, entries?: LegacyGiven[]): Promise<void>;
  legacyRequest(id: string): LegacyRequest;
  sendLegacyRequest(id: string): Promise<Reply>;
  expectMatchesLegacy(id: string, reply: Reply): void;
  expectMatchesLegacyError(id: string, reply: Reply): void;
  expectMatchesLegacyDatabase(id: string): Promise<void>;
  clearAll(): Promise<void>;
  close(): Promise<void>;
};

export async function startE2eHarness(): Promise<E2eHarness> {
  const databaseUrl = requireTestDatabaseUrl();
  for (const key of ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USERNAME", "DB_PASSWORD"]) {
    delete process.env[key];
  }
  delete process.env.CAREER_RECOMMENDATION_API_TOKEN_FILE;
  delete process.env.CAREER_RECOMMENDATION_MAX_BODY_BYTES;
  process.env.CAREER_RECOMMENDATION_DATABASE_URL = databaseUrl;
  process.env.CAREER_RECOMMENDATION_API_TOKEN = legacyApiToken;
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
  applyHttpLayers(app, app.get<RecommendationApiConfig>(RECOMMENDATION_CONFIG));
  await app.listen(0, "127.0.0.1");
  const baseUrl = await app.getUrl();
  const prisma = app.get(PrismaService);

  async function send(method: string, path: string, options: SendOptions = {}): Promise<Reply> {
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

  const harness: E2eHarness = {
    app,
    prisma,
    baseUrl,
    send,
    async replayGiven(id, entries = legacyCase(id).given) {
      for (const entry of entries) {
        if (entry.kind === "sql") {
          await prisma.$executeRawUnsafe(entry.statement);
          continue;
        }
        const reply = await send(entry.request.method, entry.request.path, {
          body: materializeLegacyBody(entry.request.body),
          idempotencyKey: entry.request.headers.idempotencyKey ?? undefined,
        });
        expect(reply.status, `${id} 의 선행 요청 ${entry.label}`).toBe(entry.responseStatus);
      }
    },
    legacyRequest(id) {
      return legacyCase(id).request;
    },
    async sendLegacyRequest(id) {
      const request = legacyCase(id).request;
      return send(request.method, request.path, {
        body: materializeLegacyBody(request.body),
        idempotencyKey: request.headers.idempotencyKey ?? undefined,
      });
    },
    expectMatchesLegacy(id, reply) {
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
    },
    expectMatchesLegacyError(id, reply) {
      const expected = legacyCase(id).response;
      const body = structuredClone(expected.body) as LegacyErrorBody;
      body.error.requestId = reply.requestId!;
      expect(reply.status, `${id} 의 status`).toBe(expected.status);
      expect(reply.cacheControl, `${id} 의 Cache-Control`).toBe(expected.cacheControl);
      expect(reply.json, `${id} 의 오류 본문`).toEqual(body);
    },
    /** 쓰기 뒤의 DB 행을 포착 파일이 적은 table 과 열만 골라 대조한다. */
    async expectMatchesLegacyDatabase(id) {
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
    },
    /**
     * case 사이의 데이터를 지운다. schema 는 그대로 둔다.
     *
     * `TRUNCATE` 대신 `DELETE` 를 쓴다. 외래 키 확인을 끄려면 같은 연결에서 이어 실행해야 하는데
     * pool 이 문장마다 다른 연결을 줄 수 있다. `DATA_TABLES` 를 자식 table 부터 적어 순서로 푼다.
     */
    async clearAll() {
      for (const table of DATA_TABLES) {
        await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
      }
    },
    async close() {
      await app.close();
    },
  };
  return harness;
}
