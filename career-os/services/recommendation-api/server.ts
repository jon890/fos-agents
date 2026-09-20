#!/usr/bin/env bun
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createSqlConnection } from "./db/connection.ts";
import { SqlReceiptStore } from "./db/receipt-store.ts";
import { loadMigrations, migrationStatus } from "./db/migrations.ts";
import { resolve } from "node:path";
import { SqlPositionRepository } from "./position/sql-repository.ts";
import { PositionService } from "./position/service.ts";

export function startServer() {
  const config = loadConfig();
  const sql = createSqlConnection(config.databaseUrl);
  const positionRepository = new SqlPositionRepository(sql);
  const server = Bun.serve({
    hostname: config.host,
    port: config.port,
    fetch: createApp({
      config,
      positionService: new PositionService(positionRepository),
      receipts: new SqlReceiptStore(sql),
      readiness: async () => {
        try {
          await sql`SELECT 1`;
          await positionRepository.ensureReady();
          const status = await migrationStatus(
            sql,
            loadMigrations(resolve(import.meta.dir, "migrations")),
          );
          return status.every((entry) => entry.state === "applied" && entry.valid);
        } catch {
          return false;
        }
      },
    }),
  });
  return { server, sql };
}

if (import.meta.main) {
  const { server } = startServer();
  console.log(`recommendation-api listening on ${server.hostname}:${server.port}`);
}
