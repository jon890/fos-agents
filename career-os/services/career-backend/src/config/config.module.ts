import { Global, Module } from "@nestjs/common";

import { loadConfig } from "./config.js";

/** `CareerBackendConfig` 주입 token. */
export const CAREER_BACKEND_CONFIG = Symbol.for("career-backend.config");

@Global()
@Module({
  providers: [{ provide: CAREER_BACKEND_CONFIG, useFactory: () => loadConfig() }],
  exports: [CAREER_BACKEND_CONFIG],
})
export class ConfigModule {}
