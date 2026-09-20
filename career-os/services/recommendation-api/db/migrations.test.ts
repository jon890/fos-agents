import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadMigrations, migrationStatus, splitMigrationStatements } from "./migrations.ts";

const directory = resolve(import.meta.dir, "../migrations");

describe("recommendation-api migration", () => {
  test("순서가 있는 파일과 안정적인 checksum을 만든다", () => {
    const first = loadMigrations(directory);
    const second = loadMigrations(directory);
    expect(first.map((entry) => entry.version)).toEqual(["001_position_schema"]);
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
