import { execFile } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { applyHttpLayers } from "../src/bootstrap.js";
import { canonicalRequestHash } from "../src/common/idempotency/request-hash.js";
import { loadConfig, type RecommendationApiConfig } from "../src/config/config.js";
import { RECOMMENDATION_CONFIG } from "../src/config/config.module.js";
import { mariaDbPoolConfig, PrismaService } from "../src/prisma/prisma.service.js";
import {
  legacyApiToken,
  legacyCase,
  type LegacyErrorBody,
  legacyMaxBodyBytes,
} from "./support/legacy-contract.js";
import { ProbeAppModule } from "./support/probe.controller.js";

const execFileAsync = promisify(execFile);

const serviceRoot = fileURLToPath(new URL("..", import.meta.url));
const mainPath = fileURLToPath(new URL("../src/main.ts", import.meta.url));

/** migration 을 적용하지 않은 상태를 만드는 임시 database. 테스트가 만들고 지운다. */
const SCRATCH_DATABASE = "fos_career_ready_check";

/**
 * 연결 문자열이 없으면 건너뛰지 않고 실패한다.
 * 건너뛴 실행을 완료 근거로 쓰지 않기 위해서다.
 */
function requireTestDatabaseUrl(): string {
  const url = process.env.CAREER_RECOMMENDATION_TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "CAREER_RECOMMENDATION_TEST_DATABASE_URL 이 없다. 테스트용 MySQL 연결 문자열을 준다.",
    );
  }
  return url;
}

function withDatabase(baseUrl: string, name: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function runSql(connectionUrl: string, statements: string[]): Promise<void> {
  const adapter = await new PrismaMariaDb(connectionUrl).connect();
  try {
    for (const sql of statements) {
      await adapter.executeRaw({ sql, args: [], argTypes: [] });
    }
  } finally {
    await adapter.dispose();
  }
}

type RunningApp = { app: INestApplication; baseUrl: string; config: RecommendationApiConfig };

async function startApp(databaseUrl: string): Promise<RunningApp> {
  for (const key of ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USERNAME", "DB_PASSWORD"]) {
    delete process.env[key];
  }
  delete process.env.CAREER_RECOMMENDATION_API_TOKEN_FILE;
  delete process.env.CAREER_RECOMMENDATION_MAX_BODY_BYTES;
  process.env.CAREER_RECOMMENDATION_DATABASE_URL = databaseUrl;
  process.env.CAREER_RECOMMENDATION_API_TOKEN = legacyApiToken;
  const app = await NestFactory.create(ProbeAppModule, { bodyParser: false, logger: false });
  const config = app.get<RecommendationApiConfig>(RECOMMENDATION_CONFIG);
  applyHttpLayers(app, config);
  await app.listen(0, "127.0.0.1");
  return { app, baseUrl: await app.getUrl(), config };
}

type Reply = {
  status: number;
  cacheControl: string | null;
  requestId: string | null;
  text: string;
  json: unknown;
};

async function send(baseUrl: string, path: string, init: RequestInit = {}): Promise<Reply> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  return {
    status: response.status,
    cacheControl: response.headers.get("Cache-Control"),
    requestId: response.headers.get("X-Request-Id"),
    text,
    json: text.length > 0 ? (JSON.parse(text) as unknown) : null,
  };
}

function authorized(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${legacyApiToken}`, ...extra };
}

/** 포착한 정상 경로 응답과 status, 본문, 공통 헤더를 그대로 대조한다. */
function expectMatchesLegacy(id: string, reply: Reply): void {
  const expected = legacyCase(id).response;
  expect(reply.status, `${id} 의 status`).toBe(expected.status);
  expect(reply.cacheControl, `${id} 의 Cache-Control`).toBe(expected.cacheControl);
  expect(typeof reply.requestId === "string", `${id} 의 X-Request-Id 유무`).toBe(
    expected.hasRequestId,
  );
  expect(reply.json, `${id} 의 응답 본문`).toEqual(expected.body);
}

/**
 * 포착한 오류 응답과 전문을 대조한다.
 *
 * `error.requestId` 는 실행마다 달라 포착 파일이 `volatileResponsePaths` 로 표시한 자리다.
 * 그 자리만 이번 응답의 헤더 값으로 바꿔 넣고 나머지는 그대로 비교한다.
 */
function expectMatchesLegacyError(id: string, reply: Reply): void {
  const expected = legacyCase(id).response;
  expect(expected.volatileResponsePaths, `${id} 의 실행마다 달라지는 자리`).toEqual([
    "error.requestId",
  ]);
  const body = structuredClone(expected.body) as LegacyErrorBody;
  body.error.requestId = reply.requestId!;
  expect(reply.status, `${id} 의 status`).toBe(expected.status);
  expect(reply.cacheControl, `${id} 의 Cache-Control`).toBe(expected.cacheControl);
  expect(typeof reply.requestId === "string", `${id} 의 X-Request-Id 유무`).toBe(
    expected.hasRequestId,
  );
  expect(reply.json, `${id} 의 오류 본문`).toEqual(body);
}

let running: RunningApp;
let databaseUrl: string;

beforeAll(async () => {
  databaseUrl = requireTestDatabaseUrl();
  running = await startApp(databaseUrl);
});

afterAll(async () => {
  await running?.app.close();
});

beforeEach(async () => {
  await runSql(databaseUrl, ["TRUNCATE TABLE request_receipts"]);
});

describe("health 확인", () => {
  it("생존 확인은 인증 없이 200 을 준다", async () => {
    expectMatchesLegacy("ok-01-health-live", await send(running.baseUrl, "/health/live"));
  });

  it("migration 을 모두 적용한 DB 에서 준비 확인이 200 이다", async () => {
    expectMatchesLegacy("ok-02-health-ready", await send(running.baseUrl, "/health/ready"));
  });

  it("적용되지 않은 migration 이 있는 DB 에서 준비 확인이 503 이다", async () => {
    const scratchUrl = withDatabase(databaseUrl, SCRATCH_DATABASE);
    await runSql(databaseUrl, [`DROP DATABASE IF EXISTS \`${SCRATCH_DATABASE}\``]);
    await runSql(databaseUrl, [
      `CREATE DATABASE \`${SCRATCH_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    ]);
    try {
      await execFileAsync("npx", ["prisma", "migrate", "deploy"], {
        cwd: serviceRoot,
        env: { ...process.env, DATABASE_URL: scratchUrl },
      });
      // 적용 기록만 지운다. schema 는 그대로 두므로 「적용되지 않은 migration 이 있는」 상태다.
      await runSql(scratchUrl, ["DELETE FROM _prisma_migrations"]);
      const scratchApp = await startApp(scratchUrl);
      try {
        const reply = await send(scratchApp.baseUrl, "/health/ready");
        expect(reply.status).toBe(503);
        expect(reply.json).toEqual({ ok: false });
        expect(reply.cacheControl).toBe("no-store");
        expect(reply.requestId).toBeTruthy();
      } finally {
        await scratchApp.app.close();
      }
    } finally {
      await runSql(databaseUrl, [`DROP DATABASE IF EXISTS \`${SCRATCH_DATABASE}\``]);
      running = await startApp(databaseUrl);
    }
  });
});

describe("인증", () => {
  it("유효한 token 은 204 와 빈 본문을 준다", async () => {
    const reply = await send(running.baseUrl, "/api/v1/auth/check", { headers: authorized() });
    expectMatchesLegacy("ok-03-auth-check", reply);
    expect(reply.text).toBe("");
  });

  it("틀린 token 은 401 UNAUTHORIZED 다", async () => {
    const reply = await send(running.baseUrl, "/test/guarded", {
      headers: { Authorization: "Bearer wrong-token-0000000000000000000" },
    });
    expectMatchesLegacyError("err-04-wrong-token", reply);
  });

  it("token 을 아예 주지 않아도 401 UNAUTHORIZED 다", async () => {
    const reply = await send(running.baseUrl, "/test/guarded");
    expectMatchesLegacyError("err-05-missing-token", reply);
  });

  it("길이가 같아도 값이 다르면 401 이다", async () => {
    const sameLength = `x${legacyApiToken.slice(1)}`;
    const reply = await send(running.baseUrl, "/test/guarded", {
      headers: { Authorization: `Bearer ${sameLength}` },
    });
    expect(reply.status).toBe(401);
    expect(reply.json).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "인증 정보가 올바르지 않습니다.",
        requestId: reply.requestId,
      },
    });
  });

  it("token 파일의 권한이 0600 이 아니면 기동 전에 실패한다", () => {
    const directory = mkdtempSync(join(tmpdir(), "recommendation-token-"));
    const path = join(directory, "token");
    try {
      writeFileSync(path, legacyApiToken);
      chmodSync(path, 0o644);
      expect(() =>
        loadConfig({
          CAREER_RECOMMENDATION_DATABASE_URL: databaseUrl,
          CAREER_RECOMMENDATION_API_TOKEN_FILE: path,
        }),
      ).toThrow("token 파일을 읽거나 검증할 수 없습니다");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("공통 응답 계약", () => {
  it("없는 경로에 올바른 token 으로 보내면 404 NOT_FOUND 이고 형식이 같다", async () => {
    const reply = await send(running.baseUrl, legacyCase("err-07-unknown-path").request.path, {
      headers: authorized(),
    });
    expectMatchesLegacyError("err-07-unknown-path", reply);
  });

  /**
   * 기대값 401 은 포착 파일이 아니라 전환 전 `app.ts` 의 코드 순서에서 나온다.
   * 거기서는 `authorize` 가 경로 분기보다 먼저 돌아 token 이 없으면 경로와 무관하게 401 이었다.
   * 포착 목록에 이 조합이 빠져 있어 `cases.json` 에 대응하는 case 가 없다.
   * 이 응답이 404 로 돌아가면 인증 없는 호출자가 경로의 실재를 알아낼 수 있다.
   */
  it("없는 경로에 token 없이 보내면 401 UNAUTHORIZED 다", async () => {
    const reply = await send(running.baseUrl, legacyCase("err-07-unknown-path").request.path);
    expect(reply.status).toBe(401);
    expect(reply.cacheControl).toBe("no-store");
    expect(reply.json).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "인증 정보가 올바르지 않습니다.",
        requestId: reply.requestId,
      },
    });
  });

  it("health 확인 둘은 token 없이도 통과한다", async () => {
    expect((await send(running.baseUrl, "/health/live")).status).toBe(200);
    expect((await send(running.baseUrl, "/health/ready")).status).toBe(200);
  });

  it("인증 확인은 token 이 없으면 401 이다", async () => {
    const reply = await send(running.baseUrl, "/api/v1/auth/check");
    expect(reply.status).toBe(401);
    expect(reply.json).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "인증 정보가 올바르지 않습니다.",
        requestId: reply.requestId,
      },
    });
  });

  it("받은 X-Request-Id 가 100자 이하면 그 값을 되돌려준다", async () => {
    const supplied = "a".repeat(100);
    const reply = await send(running.baseUrl, "/health/live", {
      headers: { "X-Request-Id": supplied },
    });
    expect(reply.requestId).toBe(supplied);
  });

  it("받은 X-Request-Id 가 100자를 넘으면 새 값을 낸다", async () => {
    const supplied = "a".repeat(101);
    const reply = await send(running.baseUrl, "/health/live", {
      headers: { "X-Request-Id": supplied },
    });
    expect(reply.requestId).not.toBe(supplied);
    expect(reply.requestId).toBeTruthy();
  });

  it("연결 실패 예외는 503 DATABASE_UNAVAILABLE 형식으로 나온다", async () => {
    const reply = await send(running.baseUrl, "/test/database-unavailable", {
      headers: authorized(),
    });
    expect(reply.status).toBe(503);
    expect(reply.json).toEqual({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "추천 상태 저장소를 사용할 수 없습니다.",
        requestId: reply.requestId,
      },
    });
    expect(reply.text).not.toContain("응답에 담기면 안 되는 내부 상세");
  });

  it("그 밖의 예외는 500 INTERNAL_ERROR 이고 원본 메시지를 담지 않는다", async () => {
    const reply = await send(running.baseUrl, "/test/internal-error", { headers: authorized() });
    expect(reply.status).toBe(500);
    expect(reply.json).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "요청을 처리하지 못했습니다.",
        requestId: reply.requestId,
      },
    });
    expect(reply.text).not.toContain("응답에 담기면 안 되는 내부 상세");
  });
});

describe("본문 크기", () => {
  it("상한을 넘는 본문은 400 BODY_TOO_LARGE 다", async () => {
    const overhead = '{"pad":""}'.length;
    const body = JSON.stringify({ pad: "a".repeat(legacyMaxBodyBytes + 100 - overhead) });
    expect(Buffer.byteLength(body)).toBeGreaterThan(legacyMaxBodyBytes);
    const reply = await send(running.baseUrl, "/test/echo", {
      method: "POST",
      headers: authorized({ "Content-Type": "application/json", "Idempotency-Key": "too-large" }),
      body,
    });
    expectMatchesLegacyError("err-06-body-too-large", reply);
    expect(await receiptKeys()).toEqual([]);
  });
});

async function receiptKeys(): Promise<string[]> {
  const rows = await running.app
    .get(PrismaService)
    .$queryRaw<{ idempotency_key: string }[]>`
      SELECT idempotency_key FROM request_receipts ORDER BY idempotency_key
    `;
  return rows.map((row) => row.idempotency_key);
}

async function receiptState(key: string): Promise<{ state: string; response_status: number | null } | undefined> {
  const rows = await running.app
    .get(PrismaService)
    .$queryRaw<{ state: string; response_status: number | null }[]>`
      SELECT state, response_status FROM request_receipts WHERE idempotency_key = ${key}
    `;
  return rows[0];
}

describe("멱등 처리", () => {
  const payload = { note: "첫 본문", nested: { b: 2, a: 1 } };

  async function post(key: string | undefined, body: unknown, path = "/test/echo"): Promise<Reply> {
    const headers = authorized({ "Content-Type": "application/json" });
    if (key !== undefined) headers["Idempotency-Key"] = key;
    return send(running.baseUrl, path, {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  it("새 키는 처리하고 응답을 저장한다", async () => {
    const reply = await post("key-new", payload);
    expect(reply.status).toBe(201);
    expect(reply.json).toEqual({ echoed: payload });
    expect(await receiptState("key-new")).toEqual({ state: "completed", response_status: 201 });
  });

  it("같은 키에 같은 본문은 저장된 응답을 그대로 준다", async () => {
    const first = await post("key-replay", payload);
    // 키 순서를 바꿔 보내도 정규화 해시가 같아 같은 요청으로 판정한다.
    const second = await post("key-replay", { nested: { a: 1, b: 2 }, note: "첫 본문" });
    expect(second.status).toBe(first.status);
    expect(second.json).toEqual(first.json);
    expect(await receiptKeys()).toEqual(["key-replay"]);
  });

  it("같은 키에 다른 본문은 409 IDEMPOTENCY_CONFLICT 다", async () => {
    await post("key-conflict", payload);
    const reply = await post("key-conflict", { note: "다른 본문" });
    expectMatchesLegacyError("err-02-idempotency-conflict", reply);
  });

  it("앞선 요청이 처리 중이면 409 VERSION_CONFLICT 다", async () => {
    const hash = canonicalRequestHash(payload);
    await running.app.get(PrismaService).$executeRaw`
      INSERT INTO request_receipts (idempotency_key, request_hash, state, created_at, updated_at)
      VALUES ('key-processing', ${hash}, 'processing', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
    `;
    const reply = await post("key-processing", payload);
    expect(reply.status).toBe(409);
    expect(reply.json).toEqual({
      error: {
        code: "VERSION_CONFLICT",
        message: "같은 요청이 처리 중입니다.",
        requestId: reply.requestId,
      },
    });
  });

  it("다른 키는 다시 처리한다", async () => {
    await post("key-first", payload);
    const reply = await post("key-second", payload);
    expect(reply.status).toBe(201);
    expect(reply.json).toEqual({ echoed: payload });
    expect(await receiptKeys()).toEqual(["key-first", "key-second"]);
  });

  it("Idempotency-Key 가 없으면 400 BAD_REQUEST 다", async () => {
    expectMatchesLegacyError("err-03-missing-idempotency-key", await post(undefined, payload));
  });

  it("Idempotency-Key 가 200자를 넘으면 400 BAD_REQUEST 다", async () => {
    const reply = await post("k".repeat(201), payload);
    expect(reply.status).toBe(400);
    expect(reply.json).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Idempotency-Key가 필요합니다.",
        requestId: reply.requestId,
      },
    });
    expect(await receiptKeys()).toEqual([]);
  });

  it("200자 키는 받아들인다", async () => {
    const key = "k".repeat(200);
    const reply = await post(key, payload);
    expect(reply.status).toBe(201);
    expect(await receiptKeys()).toEqual([key]);
  });

  it("잘못된 JSON 본문은 400 BAD_REQUEST 다", async () => {
    const reply = await post("key-broken-json", "{ 이건 JSON 이 아니다");
    expect(reply.status).toBe(400);
    expect(reply.json).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "JSON 요청 본문이 올바르지 않습니다.",
        requestId: reply.requestId,
      },
    });
    expect(await receiptKeys()).toEqual([]);
  });

  it("처리 중 예외가 나면 processing 행이 남지 않는다", async () => {
    const reply = await post("key-boom", payload, "/test/boom");
    expect(reply.status).toBe(500);
    expect(await receiptKeys()).toEqual([]);
  });
});

describe("시간대 고정", () => {
  it("테스트 하네스가 프로세스 시간대를 UTC 로 고정한다", () => {
    expect(process.env.TZ).toBe("UTC");
    expect(new Date(2026, 0, 1).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("진입점이 다른 무엇보다 먼저 시간대를 고정한다", () => {
    const source = readFileSync(mainPath, "utf8");
    expect(source.trimStart().split("\n")[0]).toBe('import "./utc.js";');
  });

  it("프로세스가 Asia/Seoul 이어도 DB 가 기록한 시각을 그대로 읽는다", async () => {
    const original = process.env.TZ;
    process.env.TZ = "Asia/Seoul";
    const prisma = new PrismaService({
      databaseUrl,
      apiToken: legacyApiToken,
      host: "127.0.0.1",
      port: 0,
      maxBodyBytes: legacyMaxBodyBytes,
    });
    try {
      await prisma.$connect();
      const before = Date.now();
      await prisma.$executeRaw`
        INSERT INTO request_receipts (idempotency_key, request_hash, state, created_at, updated_at)
        VALUES ('key-timezone', 'sha256:timezone', 'processing',
                CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
      `;
      const rows = await prisma.$queryRaw<{ created_at: Date }[]>`
        SELECT created_at FROM request_receipts WHERE idempotency_key = 'key-timezone'
      `;
      const after = Date.now();
      const stored = new Date(rows[0]!.created_at).getTime();
      // 고정이 풀리면 이 값이 9시간 어긋난다.
      expect(stored, "DB 가 기록한 시각과 프로세스 시각의 차이").toBeGreaterThanOrEqual(before - 1_000);
      expect(stored, "DB 가 기록한 시각과 프로세스 시각의 차이").toBeLessThanOrEqual(after + 1_000);
    } finally {
      await prisma.$disconnect();
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("연결 옵션이 UTC 로 고정돼 있다", () => {
    const config = mariaDbPoolConfig("mysql://user:secret@db:3306/fos_career");
    expect(config.timezone).toBe("Z");
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });
});
