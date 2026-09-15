#!/usr/bin/env bun
import { runCli } from "../../../../scripts/lib/cli.ts";
import { promote } from "./verified-claims/service.ts";
await runCli(
  {
    name: "promote_verified_claims.ts",
    summary: "안전한 원장을 검증 완료 주장 상태로 반영한다.",
    positional: [{ name: "<application-directory>", description: "지원 디렉터리" }],
    options: { "--state-dir": { value: true, description: "상태 디렉터리" } },
  },
  ({ positional, options }) => promote(positional[0], options["--state-dir"] as string | undefined),
);
