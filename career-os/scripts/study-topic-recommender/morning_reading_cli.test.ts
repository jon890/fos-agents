import { describe, expect, test } from "bun:test";
import { main, reportMorningReadingError } from "./morning_reading_cli.ts";

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

  test("제거한 파일모드 옵션은 지원하지 않는 옵션 오류를 낸다", async () => {
    await expect(withArgs(["--commit-history"], main)).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining("지원하지 않는 옵션"),
    });
  });

  test("render-only 분기 전에 동작 플래그 수를 검증한다", async () => {
    await expect(withArgs(["--render-only", "--collect-only"], main)).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining("하위 동작 플래그 하나가 필요하다"),
    });
  });

  test("render-only 분기 전에 지원하지 않는 옵션을 검증한다", async () => {
    await expect(withArgs(["--render-only", "--commit-history"], main)).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining("지원하지 않는 옵션"),
    });
  });

  test("알 수 없는 오류는 오류 객체에 붙은 값 없이 메시지만 출력한다", () => {
    const originalError = console.error;
    const originalExit = process.exit;
    const printed: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      printed.push(args);
    };
    process.exit = ((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    }) as typeof process.exit;
    const error = Object.assign(new Error("요청이 실패했다"), {
      request: { headers: { authorization: "Bearer secret-token" } },
    });

    try {
      expect(() => reportMorningReadingError(error)).toThrow("exit:1");
    } finally {
      console.error = originalError;
      process.exit = originalExit;
    }

    expect(printed).toEqual([["study-topic-recommender error:", "요청이 실패했다"]]);
  });
});
