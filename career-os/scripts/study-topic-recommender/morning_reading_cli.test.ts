import { describe, expect, test } from "bun:test";
import { main } from "./morning_reading_cli.ts";

async function withArgs(args: string[], run: () => Promise<void>): Promise<void> {
  const originalArgv = process.argv;
  process.argv = ["bun", "morning_reading_cli.ts", ...args];
  try {
    await run();
  } finally {
    process.argv = originalArgv;
  }
}

describe("morning_reading_cli", () => {
  test("--library는 기본 실행이라는 사용법 오류를 낸다", async () => {
    await expect(withArgs(["--library", "--collect-only"], main)).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining("--library는 이제 기본이다"),
    });
  });

  test("--commit-history는 제거한 사용법 오류를 낸다", async () => {
    await expect(withArgs(["--commit-history"], main)).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining("--commit-history는 더 이상 지원하지 않는다"),
    });
  });
});
