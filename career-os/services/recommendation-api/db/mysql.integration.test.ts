import { expect, test } from "bun:test";

const databaseUrl = process.env.CAREER_RECOMMENDATION_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
  "CAREER_RECOMMENDATION_TEST_DATABASE_URL이 있으면 MySQL 연결을 확인한다",
  async () => {
    const sql = new Bun.SQL(databaseUrl!);
    try {
      const rows = await sql<Array<{ value: number }>>`SELECT 1 AS value`;
      expect(Number(rows[0].value)).toBe(1);
    } finally {
      await sql.close();
    }
  },
);
