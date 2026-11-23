import { expect, test } from "bun:test";
import { withPeriodicGc } from "./memory-relief.ts";

test("일이 끝나면 결과를 돌려주고 타이머를 남기지 않는다", async () => {
  const original = Bun.gc;
  let calls = 0;
  Bun.gc = (() => {
    calls++;
    return 0;
  }) as typeof Bun.gc;
  try {
    expect(await withPeriodicGc(() => Bun.sleep(30).then(() => "끝"), 5)).toBe("끝");
    const during = calls;
    expect(during).toBeGreaterThan(0);
    await Bun.sleep(30);
    expect(calls).toBe(during);
    await expect(
      withPeriodicGc(async () => {
        throw new Error("실패");
      }, 5),
    ).rejects.toThrow("실패");
    await Bun.sleep(20);
    expect(calls).toBe(during);
  } finally {
    Bun.gc = original;
  }
});
