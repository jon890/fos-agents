import "./utc.js";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module.js";
import { applyHttpLayers } from "./bootstrap.js";
import { CAREER_BACKEND_CONFIG } from "./config/config.module.js";
import type { CareerBackendConfig } from "./config/config.js";

export async function bootstrap(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get<CareerBackendConfig>(CAREER_BACKEND_CONFIG);
  applyHttpLayers(app, config);
  app.enableShutdownHooks();
  await app.listen(config.port, config.host);
  return app;
}

await bootstrap();
