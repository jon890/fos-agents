import { Global, Module } from "@nestjs/common";

import { loadConfig } from "./config.js";

/** `RecommendationApiConfig` 주입 token. */
export const RECOMMENDATION_CONFIG = Symbol.for("recommendation-api.config");

@Global()
@Module({
  providers: [{ provide: RECOMMENDATION_CONFIG, useFactory: () => loadConfig() }],
  exports: [RECOMMENDATION_CONFIG],
})
export class ConfigModule {}
