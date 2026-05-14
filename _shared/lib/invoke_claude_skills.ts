#!/usr/bin/env bun
// _shared/lib/invoke_claude_skills.ts
// Claude CLI 호출 + usage capture + 마크다운 추출. ADR-014 + ADR-019.
//
// 두 가지 사용 모드:
//   1. CLI: bun run invoke_claude_skills.ts <command> <args>
//      - persist-usage <raw-json-path>          (claude_lib.sh::claude_persist_usage 대체)
//      - extract <raw-json> <output-md> [usage]
//   2. Import: import { persistUsage, extractResult } from "@shared/lib/invoke_claude_skills.ts"

import { copyFileSync, existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import type { ClaudeUsage } from "../types/index.ts";

// ============================================================
// persistUsage — claude_lib.sh::claude_persist_usage 대체
// ============================================================

/**
 * raw Claude JSON envelope 을 $TRACK_TASK_CLAUDE_USAGE_FILE 경로로 cp.
 * env 미설정 또는 raw 파일 비어있으면 no-op (caller 실행 깨뜨리지 X).
 */
export function persistUsage(rawJsonPath: string): void {
  const target = process.env.TRACK_TASK_CLAUDE_USAGE_FILE;
  if (!target) return;
  if (!existsSync(rawJsonPath)) {
    console.error(`[invoke_claude_skills] persistUsage: raw 파일 없음: ${rawJsonPath}`);
    return;
  }
  try {
    if (statSync(rawJsonPath).size === 0) {
      console.error(`[invoke_claude_skills] persistUsage: raw 파일 비어있음: ${rawJsonPath}`);
      return;
    }
    copyFileSync(rawJsonPath, target);
  } catch (err) {
    console.error(
      `[invoke_claude_skills] persistUsage 실패: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ============================================================
// extractResult — Claude JSON → markdown 추출
// ============================================================

/**
 * Claude `--output-format json` envelope 에서 `.result` 마크다운 추출 → output-md 에 저장.
 * 선택적으로 usage json 도 별도 파일에 기록.
 */
export function extractResult(rawJsonPath: string, outputMdPath: string, usageJsonPath?: string): void {
  if (!existsSync(rawJsonPath)) {
    throw new Error(`raw JSON 없음: ${rawJsonPath}`);
  }
  const rawContent = readFileSync(rawJsonPath, "utf-8");
  const rawTrimmed = rawContent.trim();
  if (!rawTrimmed) {
    throw new Error(`raw JSON 비어있음: ${rawJsonPath}`);
  }

  let envelope: ClaudeUsage;
  try {
    envelope = JSON.parse(rawTrimmed) as ClaudeUsage;
  } catch (err) {
    throw new Error(`raw JSON 파싱 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  const markdown = (envelope.result ?? "").trim();
  if (!markdown) {
    throw new Error(`envelope.result 비어있음 — Claude 출력이 마크다운을 안 줬을 가능성`);
  }

  writeFileSync(outputMdPath, markdown + "\n", "utf-8");

  if (usageJsonPath) {
    // 원본 파일 내용을 그대로 usage 파일에.
    writeFileSync(usageJsonPath, rawContent, "utf-8");
  }
}

// ============================================================
// CLI 진입점
// ============================================================

if (import.meta.main) {
  const [, , cmd, ...args] = process.argv;
  switch (cmd) {
    case "persist-usage": {
      const [rawJsonPath] = args;
      if (!rawJsonPath) {
        console.error("usage: invoke_claude_skills.ts persist-usage <raw-json-path>");
        process.exit(1);
      }
      persistUsage(rawJsonPath);
      break;
    }
    case "extract": {
      const [rawJsonPath, outputMdPath, usageJsonPath] = args;
      if (!rawJsonPath || !outputMdPath) {
        console.error("usage: invoke_claude_skills.ts extract <raw-json> <output-md> [usage-json]");
        process.exit(1);
      }
      try {
        extractResult(rawJsonPath, outputMdPath, usageJsonPath || undefined);
      } catch (err) {
        console.error(`PHASE_FAILED: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
      break;
    }
    default:
      console.error("usage: invoke_claude_skills.ts <persist-usage|extract> <args>");
      process.exit(1);
  }
}
