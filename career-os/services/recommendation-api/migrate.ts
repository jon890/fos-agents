#!/usr/bin/env bun
import { resolve } from "node:path";
import { loadConfig } from "./config.ts";
import { createSqlConnection } from "./db/connection.ts";
import {
  applyMigrations,
  ensureMigrationTable,
  loadMigrations,
  migrationStatus,
} from "./db/migrations.ts";

export async function runMigration(action: "status" | "up"): Promise<number> {
  const config = loadConfig();
  const sql = createSqlConnection(config.databaseUrl);
  const migrations = loadMigrations(resolve(import.meta.dir, "migrations"));
  try {
    if (action === "status") {
      await ensureMigrationTable(sql);
      const status = await migrationStatus(sql, migrations);
      console.log(
        JSON.stringify({ action, migrations: status.map(({ sql: _sql, ...entry }) => entry) }),
      );
    } else {
      const applied = await applyMigrations(sql, migrations);
      console.log(JSON.stringify({ action, applied }));
    }
    return 0;
  } catch {
    console.error(JSON.stringify({ error: "migration을 적용하거나 확인하지 못했습니다." }));
    return 1;
  } finally {
    await sql.close();
  }
}

if (import.meta.main) {
  const action = process.argv[2];
  if (action !== "status" && action !== "up") {
    console.error("사용법: migrate.ts <status|up>");
    process.exit(2);
  }
  process.exit(await runMigration(action));
}
