import { describe, expect, test } from "bun:test";
import { parseArgs } from "./collect_live_postings.ts";

describe("collect_live_postings 인자", () => {
  test("JSON 후보풀 출력 경로를 받는다", () => {
    const args = parseArgs([
      "--output",
      "/tmp/posting-candidates.json",
      "--source",
      "wanted",
    ]);

    expect(args.jsonOut).toBe("/tmp/posting-candidates.json");
    expect(args.source).toBe("wanted");
  });

  test("출력 경로가 없으면 저장소 state에 쓰지 않고 중단한다", () => {
    expect(() => parseArgs([])).toThrow("--output <output-json> is required");
  });

  test("출력 경로 누락 오류는 절대 경로나 stack trace를 노출하지 않는다", async () => {
    const process = Bun.spawn(["bun", `${import.meta.dir}/collect_live_postings.ts`], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);

    expect(exitCode).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toBe("--output <output-json> is required\n");
    expect(stderr).not.toContain(import.meta.dir);
  });
});
