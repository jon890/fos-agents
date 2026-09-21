import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import type { PoolConfig } from "mariadb";

import { RECOMMENDATION_CONFIG } from "../config/config.module.js";
import type { RecommendationApiConfig } from "../config/config.js";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * 연결 문자열을 mariadb pool 설정으로 옮기면서 시간대를 UTC 로 고정한다.
 *
 * 드라이버 기본값은 프로세스의 지역 시간이다.
 * 시각 컬럼이 `DATETIME(3)` 이라 시간대를 저장하지 않으므로,
 * 프로세스가 UTC 가 아닌 기기에서 돌면 읽은 시각이 어긋난다.
 */
export function mariaDbPoolConfig(databaseUrl: string): PoolConfig {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    timezone: "Z",
  };
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(RECOMMENDATION_CONFIG) config: RecommendationApiConfig) {
    super({ adapter: new PrismaMariaDb(mariaDbPoolConfig(config.databaseUrl)) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
