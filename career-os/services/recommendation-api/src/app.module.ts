import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { IdempotencyInterceptor } from "./common/idempotency/idempotency.interceptor.js";
import { ReceiptRepository } from "./common/idempotency/receipt.repository.js";
import { ConfigModule } from "./config/config.module.js";
import { HealthModule } from "./health/health.module.js";
import { PositionsModule } from "./positions/positions.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [ConfigModule, PrismaModule, HealthModule, PositionsModule],
  providers: [
    ReceiptRepository,
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
  exports: [ReceiptRepository],
})
export class AppModule {}
