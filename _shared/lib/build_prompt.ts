#!/usr/bin/env bun
/**
 * build_prompt.ts — Template prompt builder with config injection.
 *
 * Loads context from mvp-target.json + target-context.json + candidate-profile.md,
 * resolves {{placeholder}} syntax, and writes the completed prompt to stdout.
 *
 * CLI:  bun build_prompt.ts <template-path> [task-root]
 * Env:  TASK_ROOT          — workspace root override
 *       BUILD_PROMPT_STRICT=0 — demote missing-placeholder errors to warnings
 *
 * Supported placeholders:
 *   {{primary.company}}       mvp-target.json primary.company
 *   {{primary.team}}          mvp-target.json primary.team
 *   {{primary.role}}          mvp-target.json primary.role
 *   {{primary.interviewDate}} mvp-target.json primary.interview_date (or "미정")
 *   {{primary.industryContext}} mvp-target.json primary.industryContext
 *   {{role}}                  alias for primary.role
 *   {{priorityDomains}}       target-context.json priorityDomains (array → ", " join)
 *   {{weakAreas}}             target-context.json weakAreas (array → ", " join)
 *   {{candidateProfile}}      full content of candidate-profile.md
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface BuildPromptContext {
  "primary.company": string;
  "primary.team": string;
  "primary.role": string;
  "primary.interviewDate": string;
  "primary.industryContext": string;
  role: string;
  priorityDomains: string;
  weakAreas: string;
  candidateProfile: string;
  [key: string]: string;
}

function loadJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toStr(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "string") return v;
  return "";
}

function findTaskRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    if (existsSync(`${dir}/config/mvp-target.json`)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

export function buildContext(taskRoot: string): BuildPromptContext {
  const mvp = loadJson(`${taskRoot}/config/mvp-target.json`) as Record<string, unknown>;
  const tc = loadJson(`${taskRoot}/config/target-context.json`) as Record<string, unknown>;
  const profilePath = `${taskRoot}/config/candidate-profile.md`;
  const candidateProfile = existsSync(profilePath) ? readFileSync(profilePath, "utf-8") : "";

  const primary = (mvp.primary ?? {}) as Record<string, unknown>;
  const interviewDate = toStr(primary.interview_date) || "미정";

  return {
    "primary.company": toStr(primary.company),
    "primary.team": toStr(primary.team),
    "primary.role": toStr(primary.role),
    "primary.interviewDate": interviewDate,
    "primary.industryContext": toStr(primary.industryContext),
    role: toStr(primary.role),
    priorityDomains: toStr(tc.priorityDomains),
    weakAreas: toStr(tc.weakAreas),
    candidateProfile,
  };
}

export function resolveTemplate(
  template: string,
  context: BuildPromptContext,
  strict = true,
): string {
  const missing: string[] = [];
  const resolved = template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const k = key.trim();
    if (k in context) return context[k];
    missing.push(k);
    return `{{${k}}}`;
  });
  if (missing.length > 0) {
    const msg = `[build_prompt] 누락된 placeholder: ${missing.join(", ")}`;
    if (strict) {
      console.error(msg);
      process.exit(1);
    } else {
      console.error(`[build_prompt] 경고: ${msg}`);
    }
  }
  return resolved;
}

if (import.meta.main) {
  const [, , templatePath, taskRootArg] = process.argv;
  if (!templatePath) {
    console.error("usage: build_prompt.ts <template-path> [task-root]");
    process.exit(1);
  }

  const absTemplate = resolve(templatePath);
  if (!existsSync(absTemplate)) {
    console.error(`[build_prompt] 템플릿 파일 없음: ${absTemplate}`);
    process.exit(1);
  }

  const taskRoot =
    taskRootArg ??
    process.env.TASK_ROOT ??
    findTaskRoot(dirname(absTemplate));

  const template = readFileSync(absTemplate, "utf-8");
  const context = buildContext(taskRoot);
  const strict = process.env.BUILD_PROMPT_STRICT !== "0";
  const output = resolveTemplate(template, context, strict);
  process.stdout.write(output);
}
