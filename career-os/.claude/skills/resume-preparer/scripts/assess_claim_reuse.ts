#!/usr/bin/env bun
import { runCli } from "../../../../scripts/lib/cli.ts";
import { assess } from "./verified-claims/service.ts";
await runCli(
  {
    name: "assess_claim_reuse.ts",
    summary: "현재 원장에서 재사용 가능한 주장을 판정한다.",
    positional: [{ name: "<application-directory>", description: "지원 디렉터리" }],
    options: { "--state-dir": { value: true, description: "상태 디렉터리" } },
  },
  ({ positional, options }) => assess(positional[0], options["--state-dir"] as string | undefined),
);
