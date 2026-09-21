import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["prisma/**/*.test.ts", "src/**/*.test.ts", "test/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**", "src/generated/**"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
