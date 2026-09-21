import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["prisma/**/*.test.ts", "src/**/*.test.ts", "test/**/*.test.ts"],
    exclude: [
      "node_modules/**",
      "dist/**",
      "src/generated/**",
      "test/fixtures/legacy-contract/capture-legacy.bun.ts",
    ],
    // 시각 컬럼이 시간대를 저장하지 않으므로 테스트 하네스도 UTC 로 고정한다.
    // 고정하지 않으면 같은 테스트가 기기의 시간대에 따라 통과와 실패로 갈린다.
    env: { TZ: "UTC" },
    // 테스트 file 이 같은 MySQL 하나를 함께 쓴다. 나란히 돌리면 서로의 행을 지운다.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
