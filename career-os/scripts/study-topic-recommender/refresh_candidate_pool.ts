#!/usr/bin/env bun
// 안정적인 공개 진입점이다. 실행 조립은 candidate_refresh_cli.ts가 맡는다.
import { main } from "./candidate_refresh_cli.js";

export { main };

if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`refresh_candidate_pool error: ${message}\n`);
    process.exit(1);
  });
}
