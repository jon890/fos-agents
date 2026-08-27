#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { interviewQuestionSources } from "../../config/interview-question-sources.ts";
import { collectInterviewSourceCandidatePool } from "./candidate_pool.ts";
import { activeInterviewQuestionSources, validateInterviewQuestionSources } from "./sources.ts";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "validate";
  if (command === "validate") {
    const errors = validateInterviewQuestionSources(interviewQuestionSources);
    if (errors.length > 0) throw new Error(errors.join("\n"));
    console.log(JSON.stringify({
      status: "ok",
      sources: activeInterviewQuestionSources(interviewQuestionSources).length,
    }, null, 2));
    return;
  }

  if (command === "list") {
    console.log(JSON.stringify(activeInterviewQuestionSources(interviewQuestionSources), null, 2));
    return;
  }

  if (command !== "collect") {
    throw new Error("사용법: cli.ts <validate|list|collect> [--output path] [--cache-dir path]");
  }

  const output = option("--output");
  const cacheDir = option("--cache-dir");
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
  console.log(JSON.stringify({
    status: "ok",
    output: outputPath,
    candidates: pool.candidates.length,
    sources: pool.collectionLog.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

