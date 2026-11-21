#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runCli, type CliSpec } from "../lib/cli.ts";
import { analysisPolicySchema } from "../lib/career-store/positions/schema.ts";
import { canonicalRequestHash } from "../lib/career-store/request-hash.ts";
import { createPositionStore } from "./position-store.ts";

/** 정책 전체의 hash 다. 칸 하나만 바꿔도 키가 달라져 같은 키에 다른 본문을 보내는 충돌이 없다. */
export function analysisPolicyIdempotencyKey(policy: unknown): string {
  return `analysis-policy:${canonicalRequestHash(policy).slice("sha256:".length)}`;
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
      analysisPolicyIdempotencyKey(policy),
    );
    return {
      passed: true,
      dailyAnalysisLimit: configured.dailyAnalysisLimit,
      prioritySlots: configured.prioritySlots,
      agingSlots: configured.agingSlots,
    };
  });
}
