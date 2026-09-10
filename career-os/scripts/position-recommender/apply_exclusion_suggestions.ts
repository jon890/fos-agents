#!/usr/bin/env bun
import { mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { firstOptionValue } from "../lib/cli.ts";
import {
  defaultExclusionsPath,
  loadPositionExclusions,
  positionExclusionsSchema,
  validateCareerDownsideExclusion,
  type EnrichedPositionExclusion,
  type PositionExclusions,
} from "./feedback/exclusions.ts";
import { validateRecommendationFiles } from "./validate_recommendation.ts";

function ruleKey(rule: PositionExclusions["exclusions"][number]): string {
  if ("scope" in rule && rule.scope === "company") return `company|${rule.company}`;
  return `posting|${rule.source}|${rule.identityHash ?? ""}|${rule.url ?? ""}`;
}

export function applyExclusionSuggestions(
  input: string,
  candidates: string,
  configPath = defaultExclusionsPath,
): { added: number; total: number } {
  const validation = validateRecommendationFiles(input, candidates);
  if (!validation.passed) throw new Error(validation.errors.join("\n"));
  const current = loadPositionExclusions(configPath);
  const rules: PositionExclusions["exclusions"][number][] = [...current.exclusions];
  const keys = new Set(rules.map(ruleKey));
  const candidatesById = new Map(
    validation.pool.candidates.map((candidate) => [candidate.id, candidate]),
  );
  let added = 0;

  for (const suggestion of validation.run.autoExclusionSuggestions) {
    const candidate = candidatesById.get(suggestion.candidateId);
    if (!candidate)
      throw new Error(`자동 제외 후보가 후보풀에 없습니다: ${suggestion.candidateId}`);
    const common = {
      decisionKind: "career-downside" as const,
      reason: suggestion.reason,
      axes: suggestion.axes,
      evidenceUrls: suggestion.evidenceUrls,
      decidedAt: validation.run.reportDate,
    };
    const rule: EnrichedPositionExclusion =
      suggestion.scope === "company"
        ? { scope: "company", company: candidate.company, ...common }
        : {
            scope: "posting",
            source: candidate.source,
            identityHash: candidate.identityHash,
            url: candidate.url,
            ...common,
          };
    validateCareerDownsideExclusion(rule);
    const key = ruleKey(rule);
    if (keys.has(key)) continue;
    keys.add(key);
    rules.push(rule);
    added += 1;
  }

  if (added === 0) return { added: 0, total: current.exclusions.length };

  const next = positionExclusionsSchema.parse({ schemaVersion: 2, exclusions: rules });
  const output = resolve(configPath);
  const temporary = `${output}.tmp-${process.pid}`;
  mkdirSync(dirname(output), { recursive: true });
  try {
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporary, output);
  } finally {
    try {
      unlinkSync(temporary);
    } catch {
      /* rename 뒤에는 파일이 없다. */
    }
  }
  return { added, total: next.exclusions.length };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const input = firstOptionValue(args, "--input");
  const candidates = firstOptionValue(args, "--candidates");
  const config = firstOptionValue(args, "--config") ?? defaultExclusionsPath;
  if (!input || !candidates) {
    console.error(
      "사용법: apply_exclusion_suggestions.ts --input <recommendation.json> --candidates <posting-candidates.json> [--config <position-exclusions.json>]",
    );
    process.exit(2);
  }
  try {
    const result = applyExclusionSuggestions(input, candidates, config);
    console.log(`자동 제외 설정: ${result.added}건 추가, 전체 ${result.total}건`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
