import { defineConfig } from "vitest/config";

/**
 * 배포한 서비스를 상대로 도는 검사만 담는다.
 *
 * 기본 `vitest.config.ts` 는 이 file 을 `exclude` 로 뺀다.
 * 운영 endpoint 와 token 을 요구하므로 로컬 검증에 섞이면 항상 실패한다.
 */
export default defineConfig({
  test: {
    include: ["test/deployed-contract.e2e.test.ts"],
    env: { TZ: "UTC" },
    testTimeout: 30_000,
  },
});
