import { expect, test } from "bun:test";
import { MemoryPositionRepository } from "./memory-repository.ts";

test("transaction callback이 실패하면 변경을 반영하지 않는다", async () => {
  const repository = new MemoryPositionRepository();
  await expect(
    repository.transaction((state) => {
      state.preferences.set("test", {
        companyKey: "test",
        companyName: "테스트",
        tier: 1,
        disposition: "analyze",
        updatedAt: "2026-09-17T00:00:00.000Z",
      });
      throw new Error("rollback");
    }),
  ).rejects.toThrow("rollback");
  expect(repository.snapshot().preferences.size).toBe(0);
});
