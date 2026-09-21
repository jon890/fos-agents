import { Body, Controller, Get, Module, Post } from "@nestjs/common";

import { AppModule } from "../../src/app.module.js";
import { Prisma } from "../../src/generated/prisma/client.js";

/**
 * 공통 계층만 검증하려고 두는 경로다.
 *
 * 운영 코드에 테스트용 경로를 남기면 배포되므로 테스트 module 에서만 등록한다.
 */
@Controller("test")
export class ProbeController {
  @Get("guarded")
  guarded(): { ok: true } {
    return { ok: true };
  }

  @Post("echo")
  echo(@Body() body: unknown): { echoed: unknown } {
    return { echoed: body };
  }

  @Post("boom")
  boom(): never {
    throw new Error("응답에 담기면 안 되는 내부 상세");
  }

  @Get("database-unavailable")
  databaseUnavailable(): never {
    throw new Prisma.PrismaClientInitializationError(
      "응답에 담기면 안 되는 내부 상세",
      "7.10.0",
      "P1001",
    );
  }

  @Get("internal-error")
  internalError(): never {
    throw new Error("응답에 담기면 안 되는 내부 상세");
  }
}

@Module({ imports: [AppModule], controllers: [ProbeController] })
export class ProbeAppModule {}
