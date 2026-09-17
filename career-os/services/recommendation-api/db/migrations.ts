import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ApiError } from "../http/errors.ts";

export type Migration = { version: string; checksum: string; sql: string };

export function splitMigrationStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export function loadMigrations(directory: string): Migration[] {
  return readdirSync(directory)
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(directory, name), "utf8");
      return {
        version: basename(name, ".sql"),
        checksum: createHash("sha256").update(sql).digest("hex"),
        sql,
      };
    });
}

type AppliedMigration = { version: string; checksum: string };

export async function ensureMigrationTable(sql: Bun.SQL): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(64) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB
  `;
}

export async function migrationStatus(sql: Bun.SQL, migrations: Migration[]) {
  const applied = await sql<AppliedMigration[]>`
    SELECT version, checksum FROM schema_migrations ORDER BY version
  `;
  const byVersion = new Map(applied.map((entry) => [entry.version, entry.checksum]));
  return migrations.map((migration) => ({
    ...migration,
    state: byVersion.has(migration.version) ? "applied" : "pending",
    valid:
      !byVersion.has(migration.version) || byVersion.get(migration.version) === migration.checksum,
  }));
}

export async function applyMigrations(sql: Bun.SQL, migrations: Migration[]): Promise<string[]> {
  await ensureMigrationTable(sql);
  const status = await migrationStatus(sql, migrations);
  const changed = status.find((entry) => !entry.valid);
  if (changed) {
    throw new ApiError(
      409,
      "VERSION_CONFLICT",
      `적용된 migration checksum이 다릅니다: ${changed.version}`,
    );
  }
  const applied: string[] = [];
  for (const migration of status.filter((entry) => entry.state === "pending")) {
    await sql.begin(async (transaction) => {
      for (const statement of splitMigrationStatements(migration.sql)) {
        await transaction(statement);
      }
      await transaction`
        INSERT INTO schema_migrations (version, checksum)
        VALUES (${migration.version}, ${migration.checksum})
      `;
    });
    applied.push(migration.version);
  }
  return applied;
}
