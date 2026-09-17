export function createSqlConnection(databaseUrl: string): Bun.SQL {
  return new Bun.SQL(databaseUrl);
}

export async function withTransaction<T>(
  sql: Bun.SQL,
  callback: (transaction: Bun.SQL) => Promise<T>,
): Promise<T> {
  return sql.begin(callback);
}
