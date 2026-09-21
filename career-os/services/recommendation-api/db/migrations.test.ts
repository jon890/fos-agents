import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadMigrations, migrationStatus, splitMigrationStatements } from "./migrations.ts";

const directory = resolve(import.meta.dir, "../migrations");

describe("recommendation-api migration", () => {
  test("순서가 있는 파일과 안정적인 checksum을 만든다", () => {
    const first = loadMigrations(directory);
    const second = loadMigrations(directory);
    expect(first.map((entry) => entry.version)).toEqual([
      "001_position_schema",
      "002_company_tier_assessments",
    ]);
    expect(first.map((entry) => entry.checksum)).toEqual(second.map((entry) => entry.checksum));
  });

  test("포지션 table과 삭제 규칙을 모두 선언한다", () => {
    const sql = readFileSync(resolve(directory, "001_position_schema.sql"), "utf8");
    for (const table of [
      "position_sources",
      "position_collection_runs",
      "position_source_run_diagnostics",
      "positions",
      "position_versions",
      "position_collection_items",
      "position_analysis_policy",
      "company_preferences",
      "position_analysis_runs",
      "position_analysis_run_items",
      "position_analyses",
      "position_recommendation_runs",
      "position_recommendation_items",
      "request_receipts",
    ]) {
      expect(sql).toContain(`CREATE TABLE ${table}`);
    }
    expect(sql).toContain("ON DELETE CASCADE");
    expect(sql).toContain("ON DELETE RESTRICT");
    const versionTable =
      sql.match(/CREATE TABLE position_versions \([\s\S]*?\n\) ENGINE=InnoDB;/)?.[0] ?? "";
    expect(versionTable).not.toContain("fit_score");
    expect(versionTable).not.toContain("reason");
    expect(sql).toContain("analyzed_now_count INT UNSIGNED NOT NULL DEFAULT 0");
    expect(sql).toContain("pending_candidates_json JSON NOT NULL");
    const recommendationItems =
      sql.match(/CREATE TABLE position_recommendation_items \([\s\S]*?\n\) ENGINE=InnoDB;/)?.[0] ??
      "";
    expect(recommendationItems).toContain("company_tier TINYINT UNSIGNED NOT NULL");
    expect(splitMigrationStatements(sql)).toHaveLength(15);
  });

  test("실행 결과와 생성 출처 열을 선언하고 참조 순서를 지킨다", () => {
    const sql = readFileSync(resolve(directory, "001_position_schema.sql"), "utf8");
    expect(sql.indexOf("CREATE TABLE position_analyses")).toBeLessThan(
      sql.indexOf("CREATE TABLE position_analysis_run_items"),
    );
    expect(sql.indexOf("CREATE TABLE position_analysis_runs")).toBeLessThan(
      sql.indexOf("CREATE TABLE position_analyses"),
    );
    expect(sql).toContain("created_by_analysis_run_id CHAR(36) NULL");
    expect(sql).toContain("fk_position_analyses_created_run");
    expect(sql).toContain(
      "result_status ENUM('pending', 'created', 'reused', 'failed') NOT NULL DEFAULT 'pending'",
    );
    expect(sql).toContain("attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0");
    expect(sql).toContain("chk_position_analysis_item_result");
    expect(sql).toContain("status ENUM('pending', 'partial', 'completed') NOT NULL");
  });

  test("회사 tier 평가 table과 참조 순서를 선언한다", () => {
    const sql = readFileSync(resolve(directory, "002_company_tier_assessments.sql"), "utf8");
    for (const table of [
      "company_tier_assessment_runs",
      "company_tier_assessments",
      "company_tier_assessment_run_items",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(sql.indexOf("CREATE TABLE IF NOT EXISTS company_tier_assessment_runs")).toBeLessThan(
      sql.indexOf("CREATE TABLE IF NOT EXISTS company_tier_assessments"),
    );
    expect(sql.indexOf("CREATE TABLE IF NOT EXISTS company_tier_assessments")).toBeLessThan(
      sql.indexOf("CREATE TABLE IF NOT EXISTS company_tier_assessment_run_items"),
    );
    expect(sql).toContain("fk_company_tier_assessments_created_run");
    expect(sql).toContain("fk_company_tier_items_assessment");
    expect(sql).toContain("ON DELETE RESTRICT");
    expect(sql).toContain("assessment_status ENUM('new', 'stale') NOT NULL");
    expect(sql).toContain("selection_reason ENUM('discovery', 'refresh') NOT NULL");
    expect(sql).toContain("confidence ENUM('low', 'medium', 'high') NOT NULL");
    expect(sql).toContain("chk_company_tier_item_result");
    expect(sql).toContain("uq_company_tier_item_order");
    expect(sql).toContain("idx_company_tier_assessment_lookup");
    expect(sql).toContain("collection_run_id VARCHAR(191) NOT NULL UNIQUE");
    for (const failureCode of [
      "research_unavailable",
      "model_unavailable",
      "contract_rejected",
      "internal_error",
      "lease_expired",
    ]) {
      expect(sql).toContain(`'${failureCode}'`);
    }
  });

  test("기존 table의 column 추가를 네 단계와 존재 확인으로 감싼다", () => {
    const sql = readFileSync(resolve(directory, "002_company_tier_assessments.sql"), "utf8");
    expect(sql).not.toContain("ADD COLUMN IF NOT EXISTS");
    expect(sql).not.toContain("ADD COLUMN company_tier TINYINT");
    for (const column of ["daily_company_tier_limit", "company_tier_stale_after_days"]) {
      expect(sql).toContain(`AND COLUMN_NAME = '${column}'`);
    }
    for (const table of ["position_analysis_run_items", "position_recommendation_items"]) {
      const addColumn = sql.indexOf(`ALTER TABLE ${table} ADD COLUMN company_tier_source`);
      const migrate = sql.indexOf(`UPDATE ${table} SET company_tier_source = 'default'`);
      const modify = sql.indexOf(
        `ALTER TABLE ${table}\n  MODIFY COLUMN company_tier_source ENUM('manual', 'model', 'default') NOT NULL`,
      );
      expect(addColumn).toBeGreaterThan(-1);
      expect(addColumn).toBeLessThan(migrate);
      expect(migrate).toBeLessThan(modify);
      expect(sql).toContain(`UPDATE ${table} SET company_tier_source = 'default'\nWHERE company_tier_source IS NULL`);
    }
    expect(sql).toContain(
      "UPDATE position_analysis_policy SET daily_company_tier_limit = 5\nWHERE daily_company_tier_limit IS NULL",
    );
    expect(sql).toContain(
      "UPDATE position_analysis_policy SET company_tier_stale_after_days = 90\nWHERE company_tier_stale_after_days IS NULL",
    );
    expect(sql).toContain("MODIFY COLUMN daily_company_tier_limit TINYINT UNSIGNED NOT NULL");
    expect(sql).toContain("MODIFY COLUMN company_tier_stale_after_days SMALLINT UNSIGNED NOT NULL");
    for (const constraint of [
      "chk_position_policy_company_tier_limit",
      "chk_position_policy_company_tier_stale",
      "chk_position_analysis_item_tier_source",
      "chk_position_recommendation_item_tier_source",
    ]) {
      expect(sql).toContain(`AND CONSTRAINT_NAME = '${constraint}'`);
      expect(sql).toContain(`ADD CONSTRAINT ${constraint} CHECK`);
      const guard = sql.indexOf(`AND CONSTRAINT_NAME = '${constraint}'`);
      expect(sql.indexOf(`ADD CONSTRAINT ${constraint} CHECK`)).toBeLessThan(guard);
    }
    expect(sql.match(/PREPARE stmt FROM @ddl;/g)).toHaveLength(10);
    expect(sql.match(/DEALLOCATE PREPARE stmt;/g)).toHaveLength(10);
  });

  test("002 본문은 세미콜론이 잘리지 않은 문장으로 쪼개진다", () => {
    const sql = readFileSync(resolve(directory, "002_company_tier_assessments.sql"), "utf8");
    const statements = splitMigrationStatements(sql);
    expect(statements).toHaveLength(51);
    expect(statements.filter((statement) => statement.includes(";"))).toEqual([]);
    expect(statements.filter((statement) => statement.startsWith("SET @ddl :="))).toHaveLength(10);
    expect(statements.at(-1)).toBe("DEALLOCATE PREPARE stmt");
  });

  test("001과 002 순서대로 checksum을 확인하고 변경을 거절한다", async () => {
    const migrations = loadMigrations(directory);
    const applied = new Map(migrations.map((entry) => [entry.version, entry.checksum]));
    const sql = ((strings: TemplateStringsArray | string) => {
      void strings;
      return Promise.resolve(
        [...applied].map(([version, checksum]) => ({ version, checksum })),
      );
    }) as unknown as Bun.SQL;
    const status = await migrationStatus(sql, migrations);
    expect(status.map((entry) => entry.version)).toEqual([
      "001_position_schema",
      "002_company_tier_assessments",
    ]);
    expect(status.every((entry) => entry.state === "applied" && entry.valid)).toBe(true);
    const tampered = migrations.map((entry, index) =>
      index === 1 ? { ...entry, checksum: "0".repeat(64) } : entry,
    );
    const tamperedStatus = await migrationStatus(sql, tampered);
    expect(tamperedStatus[1].valid).toBe(false);
  });

  test("runtime migration 상태 조회는 DDL 없이 checksum만 읽는다", async () => {
    const queries: string[] = [];
    const sql = ((strings: TemplateStringsArray | string) => {
      queries.push(typeof strings === "string" ? strings : strings.join("?"));
      return Promise.resolve([]);
    }) as unknown as Bun.SQL;
    await migrationStatus(sql, loadMigrations(directory));
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("SELECT version, checksum FROM schema_migrations");
    expect(queries[0]).not.toContain("CREATE TABLE");
  });
});
