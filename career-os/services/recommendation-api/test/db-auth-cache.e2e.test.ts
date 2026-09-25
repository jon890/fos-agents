import { createPool } from "mariadb";
import { describe, expect, it } from "vitest";

import { mariaDbPoolConfig } from "../src/prisma/prisma.service.js";

type AuthenticationPluginRow = {
  current_user_name: string;
  plugin: string;
};

function requireTestDatabaseUrl(): string {
  const url = process.env.CAREER_RECOMMENDATION_TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "CAREER_RECOMMENDATION_TEST_DATABASE_URL 이 없다. 테스트용 MySQL 연결 문자열을 준다.",
    );
  }
  return url;
}

async function queryWithinTwoSeconds<T>(query: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      query,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("DB 연결이 2초 안에 끝나지 않았다.")), 2_000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

describe("MySQL 인증 캐시", () => {
  it("FLUSH PRIVILEGES 직후 TLS pool 이 2초 안에 연결한다", async () => {
    const databaseUrl = requireTestDatabaseUrl();
    const rootPool = createPool(mariaDbPoolConfig(databaseUrl));
    try {
      const [authentication] = await rootPool.query<AuthenticationPluginRow[]>(`
        SELECT CURRENT_USER() AS current_user_name,
               (
                 SELECT plugin
                 FROM mysql.user
                 WHERE User = SUBSTRING_INDEX(CURRENT_USER(), '@', 1)
                   AND Host = SUBSTRING_INDEX(CURRENT_USER(), '@', -1)
               ) AS plugin
      `);
      expect(authentication?.current_user_name, "root 연결의 CURRENT_USER()").toBeTruthy();
      expect(authentication?.plugin, "root 연결의 인증 plugin").toBe("caching_sha2_password");

      await rootPool.query("FLUSH PRIVILEGES");
    } finally {
      await rootPool.end();
    }

    const pool = createPool(mariaDbPoolConfig(databaseUrl));
    try {
      await expect(queryWithinTwoSeconds(pool.query("SELECT 1"))).resolves.toBeTruthy();
    } finally {
      await pool.end();
    }
  });
});
