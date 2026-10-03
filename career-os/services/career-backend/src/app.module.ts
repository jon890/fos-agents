import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import { CandidateContextModule } from "./candidate-context/candidate-context.module.js";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { IdempotencyInterceptor } from "./common/idempotency/idempotency.interceptor.js";
import { ReceiptRepository } from "./common/idempotency/receipt.repository.js";
import { ConfigModule } from "./config/config.module.js";
import { HealthModule } from "./health/health.module.js";
import { InterviewModule } from "./interview/interview.module.js";
import { PositionsModule } from "./positions/positions.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ProfileModule } from "./profile/profile.module.js";
import { StudyModule } from "./study/study.module.js";

@Module({
  imports: [ConfigModule, PrismaModule, HealthModule, PositionsModule, StudyModule, InterviewModule, CandidateContextModule, ProfileModule],
  providers: [
    ReceiptRepository,
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
  exports: [ReceiptRepository],
})
export class AppModule {}
