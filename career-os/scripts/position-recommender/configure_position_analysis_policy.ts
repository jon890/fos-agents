#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runCli, type CliSpec } from "../lib/cli.ts";
import { analysisPolicySchema } from "../../services/career-backend/src/positions/schema.ts";
import { createCareerBackendClient } from "./career-backend/client.ts";

const spec: CliSpec = {
  name: "configure_position_analysis_policy.ts",
  summary: "fresh career-backend에 명시적인 포지션 분석 정책을 설정한다.",
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
    const configured = await createCareerBackendClient().configureAnalysisPolicy(
      policy,
      `analysis-policy:${policy.candidateContextVersion}`,
    );
    return {
      passed: true,
      candidateContextVersion: configured.candidateContextVersion,
      dailyAnalysisLimit: configured.dailyAnalysisLimit,
      prioritySlots: configured.prioritySlots,
      agingSlots: configured.agingSlots,
    };
  });
}
