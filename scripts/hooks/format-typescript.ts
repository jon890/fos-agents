#!/usr/bin/env bun
import { existsSync, realpathSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";

type HookInput = { cwd?: unknown; tool_input?: unknown };

const TYPESCRIPT_EXTENSIONS = new Set([".ts", ".tsx"]);

export function patchText(input: HookInput): string {
  const toolInput = input.tool_input;
  if (typeof toolInput === "string") return toolInput;
  if (toolInput && typeof toolInput === "object") {
    const value = toolInput as Record<string, unknown>;
    return typeof value.patch === "string"
      ? value.patch
      : typeof value.input === "string"
        ? value.input
        : "";
  }
  return "";
}

/** apply_patch의 생성·수정·이동 대상만 읽고 삭제 대상은 제외한다. */
export function patchTargets(patch: string): string[] {
  const targets: string[] = [];
  for (const line of patch.split("\n")) {
    const match =
      line.match(/^\*\*\* (Add|Update) File: (.+)$/) ?? line.match(/^\*\*\* Move to: (.+)$/);
    if (match) targets.push(match[match.length - 1]);
  }
  return [...new Set(targets)];
}

export function repositoryRoot(): string {
  return realpathSync(resolve(import.meta.dir, "../.."));
}

export function formatTargets(patch: string, cwd: string, root = repositoryRoot()): string[] {
  const resolvedRoot = realpathSync(root);
  const resolvedCwd = resolve(cwd);
  return patchTargets(patch).flatMap((path) => {
    if (!TYPESCRIPT_EXTENSIONS.has(extname(path))) return [];
    const target = resolve(resolvedCwd, path);
    if (!existsSync(target)) return [];
    const realTarget = realpathSync(target);
    const outside = relative(resolvedRoot, realTarget);
    if (outside.startsWith("..") || isAbsolute(outside)) return [];
    return [realTarget];
  });
}

export async function runHook(input: HookInput): Promise<void> {
  const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();
  const targets = formatTargets(patchText(input), cwd);
  if (!targets.length) return;
  const prettier = resolve(repositoryRoot(), "node_modules/.bin/prettier");
  const result = Bun.spawnSync([prettier, "--write", ...targets], {
    cwd,
    stdout: "ignore",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    const detail = new TextDecoder().decode(result.stderr).trim();
    throw new Error(`TypeScript 포맷에 실패했습니다.${detail ? ` ${detail}` : ""}`);
  }
}

if (import.meta.main) {
  try {
    await runHook(JSON.parse(await Bun.stdin.text()) as HookInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: message },
      }),
    );
    process.exitCode = 1;
  }
}
