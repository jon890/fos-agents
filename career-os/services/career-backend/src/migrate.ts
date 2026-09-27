import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

import { loadConfig } from "./config/config.js";
import { resolveMigrationDirectory } from "./health/migration-directory.js";

/**
 * 적용되지 않은 migration 을 적용한다.
 *
 * `prisma.config.ts` 의 datasource 가 `DATABASE_URL` 을 읽는다.
 * 기동과 같은 환경값으로 접속하도록 이 자리에서 그 값을 만들어 넘긴다.
 * 그래서 이 명령은 `serve` 와 같은 환경 파일 하나로 돈다.
 *
 * `prisma migrate deploy` 는 `prisma/schema.prisma` 와 `prisma/migrations/` 를
 * 작업 디렉터리 기준으로 찾으므로, migration 디렉터리에서 package 루트를 거슬러 올라가 쓴다.
 */
export function runMigrateDeploy(): number {
  const config = loadConfig();
  const packageRoot = dirname(dirname(resolveMigrationDirectory()));
  const result = spawnSync(
    join(packageRoot, "node_modules", ".bin", "prisma"),
    ["migrate", "deploy"],
    {
      cwd: packageRoot,
      env: { ...process.env, DATABASE_URL: config.databaseUrl },
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status === null) {
    throw new Error(`prisma migrate deploy 가 signal ${result.signal} 로 끝났습니다.`);
  }
  return result.status;
}
