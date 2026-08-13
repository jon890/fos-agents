import { describe, expect, test } from "bun:test";
import { parseArgs } from "./collect_live_postings.ts";

describe("collect_live_postings 인자", () => {
  test("JSON 후보풀과 Markdown 확인 파일의 경로를 분리한다", () => {
    const args = parseArgs([
      "--json-output",
      "/tmp/posting-candidates.json",
      "--output",
      "/tmp/live-postings.md",
      "--source",
      "wanted",
    ]);

    expect(args.jsonOut).toBe("/tmp/posting-candidates.json");
    expect(args.markdownOut).toBe("/tmp/live-postings.md");
    expect(args.source).toBe("wanted");
  });
});
