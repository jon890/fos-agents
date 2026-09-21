import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

/** 운영 schema 를 옮긴 초기 migration 이 만드는 `CHECK` 제약 수. */
const EXPECTED_CHECK_CONSTRAINT_COUNT = 16;
/** `001` 의 테이블 15개와 `002` 의 3개를 합한 수. `schema_migrations` 가 그 안에 있다. */
const EXPECTED_MODEL_COUNT = 18;
/** 초기 migration 을 빈 database 에 적용해 보는 임시 database. 테스트가 만들고 지운다. */
const SCRATCH_DATABASE = "fos_career_baseline_check";

const serviceRoot = fileURLToPath(new URL("..", import.meta.url));
const baselineSqlPath = fileURLToPath(
  new URL("./migrations/20260921000000_baseline/migration.sql", import.meta.url),
);
const schemaPath = fileURLToPath(new URL("./schema.prisma", import.meta.url));
const legacyMigrationPaths = [
  fileURLToPath(new URL("../migrations/001_position_schema.sql", import.meta.url)),
  fileURLToPath(new URL("../migrations/002_company_tier_assessments.sql", import.meta.url)),
];

/**
 * 연결 문자열이 없으면 건너뛰지 않고 실패한다.
 * 건너뛴 실행을 이 phase 의 완료 근거로 쓰지 않기 위해서다.
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

function scratchDatabaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${SCRATCH_DATABASE}`;
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

async function countCheckConstraints(connectionUrl: string, schema: string): Promise<number> {
  const adapter = await new PrismaMariaDb(connectionUrl).connect();
  try {
    const result = await adapter.queryRaw({
      sql: "SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ?",
      args: [schema],
      argTypes: [{ scalarType: "string", arity: "scalar" }],
    });
    const cell = result.rows[0]?.[0];
    return Number(cell);
  } finally {
    await adapter.dispose();
  }
}

async function dropScratchDatabase(adminUrl: string): Promise<void> {
  await runSql(adminUrl, [`DROP DATABASE IF EXISTS \`${SCRATCH_DATABASE}\``]);
}

describe("초기 migration 기준점", () => {
  afterAll(async () => {
    const adminUrl = process.env.CAREER_RECOMMENDATION_TEST_DATABASE_URL;
    if (adminUrl) {
      await dropScratchDatabase(adminUrl);
    }
  });

  it("빈 database 에 적용하면 CHECK 제약이 16개 생긴다", async () => {
    const adminUrl = requireTestDatabaseUrl();
    await dropScratchDatabase(adminUrl);
    await runSql(adminUrl, [
      `CREATE DATABASE \`${SCRATCH_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    ]);

    const targetUrl = scratchDatabaseUrl(adminUrl);
    await execFileAsync("npx", ["prisma", "migrate", "deploy"], {
      cwd: serviceRoot,
      env: { ...process.env, DATABASE_URL: targetUrl },
    });

    const checkCount = await countCheckConstraints(targetUrl, SCRATCH_DATABASE);
    expect(checkCount).toBe(EXPECTED_CHECK_CONSTRAINT_COUNT);
  });

  it("적용한 database 와 schema.prisma 의 차이가 없다", async () => {
    requireTestDatabaseUrl();
    const { stdout } = await execFileAsync(
      "npx",
      [
        "prisma",
        "migrate",
        "diff",
        "--from-migrations",
        "prisma/migrations",
        "--to-schema",
        "prisma/schema.prisma",
        "--script",
      ],
      { cwd: serviceRoot },
    );
    expect(stdout).toContain("-- This is an empty migration.");
    expect(stdout).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/);
  });

  it("schema.prisma 에 model 이 18개 있다", () => {
    const schema = readFileSync(schemaPath, "utf8");
    const models = schema.split("\n").filter((line) => line.startsWith("model "));
    expect(models).toHaveLength(EXPECTED_MODEL_COUNT);
  });

  it("초기 migration SQL 이 001 과 002 를 이어 붙인 것과 바이트 단위로 같다", () => {
    const expected = Buffer.concat(legacyMigrationPaths.map((path) => readFileSync(path)));
    const actual = readFileSync(baselineSqlPath);
    expect(actual.byteLength).toBe(expected.byteLength);
    expect(actual.equals(expected)).toBe(true);
  });
});
