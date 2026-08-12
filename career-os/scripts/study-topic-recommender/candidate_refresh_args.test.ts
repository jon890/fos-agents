import { describe, expect, test } from "bun:test";
import { parseCandidateRefreshArgs } from "./candidate_refresh_args.js";

describe("학습 후보 refresh 인자", () => {
  test("허용된 실행 옵션을 구조화한다", () => {
    const parsed = parseCandidateRefreshArgs([
      "bun",
      "refresh_candidate_pool.ts",
      "--proposals",
      "/tmp/proposals.json",
      "--trigger-kind",
      "recommendation-needs-refresh",
      "--dry-run",
    ]);
    expect(parsed.proposalsPath).toBe("/tmp/proposals.json");
    expect(parsed.triggerKind).toBe("recommendation-needs-refresh");
    expect(parsed.dryRun).toBe(true);
  });

  test("알 수 없는 옵션과 잘못된 상수를 거부한다", () => {
    expect(() => parseCandidateRefreshArgs(["bun", "script", "--unknown"]))
      .toThrow("알 수 없는 옵션이다");
    expect(() => parseCandidateRefreshArgs([
      "bun",
      "script",
      "--trigger-kind",
      "invalid",
    ])).toThrow("--trigger-kind는");
  });
});
