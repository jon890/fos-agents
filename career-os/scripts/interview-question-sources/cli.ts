#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { firstOptionValue } from "../lib/cli.ts";
import { interviewQuestionSources } from "../../config/interview-question-sources.ts";
import { collectInterviewSourceCandidatePool } from "./candidate_pool.ts";
import { activeInterviewQuestionSources, validateInterviewQuestionSources } from "./sources.ts";

export type InterviewSourcesResult =
  | { status: "ok"; sources: number }
  | ReturnType<typeof activeInterviewQuestionSources>
  | { status: "ok"; output: string; candidates: number; sources: number };

export async function runInterviewQuestionSources(
  command: string,
  args: readonly string[],
): Promise<InterviewSourcesResult> {
  if (command === "validate") {
    const errors = validateInterviewQuestionSources(interviewQuestionSources);
    if (errors.length > 0) throw new Error(errors.join("\n"));
    return {
      status: "ok",
      sources: activeInterviewQuestionSources(interviewQuestionSources).length,
    };
  }

  if (command === "list") {
    return activeInterviewQuestionSources(interviewQuestionSources);
  }

  if (command !== "collect") {
    throw new Error("사용법: cli.ts <validate|list|collect> [--output path] [--cache-dir path]");
  }

  const output = firstOptionValue(args, "--output");
  const cacheDir = firstOptionValue(args, "--cache-dir");
  if (!output || !cacheDir) {
    throw new Error("collect에는 --output과 --cache-dir가 필요하다.");
  }

  const outputPath = resolve(output);
  const cachePath = resolve(cacheDir);
  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(cachePath, { recursive: true });
  const pool = await collectInterviewSourceCandidatePool({
    config: interviewQuestionSources,
    cacheDir: cachePath,
  });
  writeFileSync(outputPath, `${JSON.stringify(pool, null, 2)}\n`, "utf8");
  return {
    status: "ok",
    output: outputPath,
    candidates: pool.candidates.length,
    sources: pool.collectionLog.length,
  };
}

if (import.meta.main) {
  try {
    const result = await runInterviewQuestionSources(process.argv[2] ?? "validate", process.argv);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
