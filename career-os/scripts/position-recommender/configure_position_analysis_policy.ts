#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runCli, type CliSpec } from "../lib/cli.ts";
import { analysisPolicySchema } from "../lib/career-store/positions/schema.ts";
import { createPositionStore } from "./position-store.ts";

/**
 * 호출마다 새 키다. 정책 hash 를 키로 쓰면 값을 예전 것으로 되돌리는 요청이
 * 처음 응답의 재전송으로 읽혀 반영되지 않는다.
 */
export function analysisPolicyIdempotencyKey(): string {
  return `analysis-policy:${crypto.randomUUID()}`;
}

const spec: CliSpec = {
  name: "configure_position_analysis_policy.ts",
  summary: "새 커리어 저장소에 포지션 분석 정책을 설정한다.",
  options: {
    "--input": { value: true, description: "분석 정책 JSON" },
  },
};

if (import.meta.main) {
  await runCli(spec, async ({ options }) => {
    const input = options["--input"];
    if (typeof input !== "string") throw new Error("--input이 필요합니다.");
    const policy = analysisPolicySchema.parse(
      JSON.parse(readFileSync(resolve(input), "utf8")) as unknown,
    );
    const configured = await createPositionStore().configureAnalysisPolicy(
      policy,
      analysisPolicyIdempotencyKey(),
    );
    return {
      passed: true,
      dailyAnalysisLimit: configured.dailyAnalysisLimit,
      prioritySlots: configured.prioritySlots,
      agingSlots: configured.agingSlots,
    };
  });
}
