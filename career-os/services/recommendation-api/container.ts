#!/usr/bin/env bun
import { runMigration } from "./migrate.ts";
import { startServer } from "./server.ts";

const command = process.argv[2] ?? "serve";
if (command === "serve") {
  startServer();
} else if (command === "migrate") {
  process.exit(await runMigration("up"));
} else {
  console.error("사용법: container.ts <serve|migrate>");
  process.exit(2);
}
