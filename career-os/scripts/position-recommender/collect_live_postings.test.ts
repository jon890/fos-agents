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
});
