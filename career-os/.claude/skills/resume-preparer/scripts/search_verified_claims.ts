#!/usr/bin/env bun
import { runCli } from "../../../../scripts/lib/cli.ts";
import { search } from "./verified-claims/service.ts";
await runCli(
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
