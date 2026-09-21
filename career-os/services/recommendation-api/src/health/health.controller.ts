import { Controller, Get, HttpCode, Res } from "@nestjs/common";
import type { Response } from "express";

import { HealthService } from "./health.service.js";

/**
 * `/health/live` 와 `/health/ready` 는 인증을 요구하지 않는다.
 * 그 판정은 `src/common/auth.middleware.ts` 가 경로로 소유한다.
 */
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get("health/live")
  live(): { ok: true } {
    return { ok: true };
  }

  @Get("health/ready")
  async ready(@Res({ passthrough: true }) response: Response): Promise<{ ok: boolean }> {
    const ok = await this.health.isReady();
    response.status(ok ? 200 : 503);
    return { ok };
  }

  @Get("api/v1/auth/check")
  @HttpCode(204)
  check(): void {}
}
