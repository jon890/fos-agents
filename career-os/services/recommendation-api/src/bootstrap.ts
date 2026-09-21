import type { INestApplication } from "@nestjs/common";

import { createAuthMiddleware } from "./common/auth.middleware.js";
import { createRawBodyMiddleware } from "./common/raw-body.middleware.js";
import { requestIdMiddleware } from "./common/request-id.middleware.js";
import type { RecommendationApiConfig } from "./config/config.js";

/**
 * 라우팅 전에 도는 계층을 붙인다. 순서가 전환 전 `app.ts` 의 순서다.
 *
 * 요청 ID 와 공통 헤더는 없는 경로의 응답에도 필요하므로 맨 앞이다.
 * 인증은 경로 분기보다 먼저 돌아야 token 없는 호출이 경로의 실재를 알아내지 못한다.
 * 본문은 인증 뒤에 모은다. 크기와 JSON 판정은 멱등 키 확인 뒤라야 하므로
 * 여기서 하지 않고 멱등 interceptor 가 한다.
 */
export function applyHttpLayers(
  app: INestApplication,
  config: RecommendationApiConfig,
): void {
  app.use(requestIdMiddleware);
  app.use(createAuthMiddleware(config.apiToken));
  app.use(createRawBodyMiddleware(config.maxBodyBytes));
}
