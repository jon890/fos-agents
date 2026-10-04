#!/usr/bin/env bun
import { runCli } from "../lib/cli.ts";
import { search } from "./verified-claims/service.ts";

export async function main(): Promise<never> {
  return runCli(
    {
      name: "search_verified_claims.ts",
      summary: "검증 완료 주장과 근거를 검색한다.",
      positional: [{ name: "<query>", description: "검색어" }],
      options: { "--state-dir": { value: true, description: "상태 디렉터리" } },
    },
    ({ positional, options }) => ({
      passed: true,
      query: positional[0],
      results: search(positional[0], options["--state-dir"] as string | undefined),
    }),
  );
}

if (import.meta.main) await main();
