import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";
import { expectedMigrationNames, resolveMigrationDirectory } from "./migration-directory.js";

type AppliedRow = { migration_name: string };

/**
 * 준비 확인.
 *
 * DDL 을 실행하지 않는다. 연결과 `_prisma_migrations` 의 적용 기록만 읽는다.
 */
@Injectable()
export class HealthService {
  private readonly expected = expectedMigrationNames(resolveMigrationDirectory());

  constructor(private readonly prisma: PrismaService) {}

  async isReady(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const rows = await this.prisma.$queryRaw<AppliedRow[]>`
        SELECT migration_name
        FROM _prisma_migrations
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      `;
      const applied = new Set(rows.map((row) => row.migration_name));
      return this.expected.every((name) => applied.has(name));
    } catch {
      return false;
    }
  }
}
