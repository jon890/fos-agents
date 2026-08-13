#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadPostingCandidatePool } from "./live-postings/candidate_pool.ts";
import type { PostingCandidatePool } from "./live-postings/contracts.ts";
import { RecommendationRun, type RecommendationRunType } from "./recommendation_schema.ts";

export function validateRecommendationAgainstPool(
  run: RecommendationRunType,
  pool: PostingCandidatePool,
): string[] {
  const errors: string[] = [];
  if (run.sourceSnapshot.collectionRunId !== pool.collectionRunId) {
    errors.push("추천 결과의 수집 실행 ID가 후보풀과 다르다.");
  }
  const byId = new Map(pool.candidates.map((candidate) => [candidate.id, candidate]));
  const selectedIds = new Set<string>();
  for (const item of [...run.tiers.strong, ...run.tiers.stretch]) {
    const candidate = byId.get(item.candidateId);
    if (!candidate) {
      errors.push(`후보풀에 없는 공고 ID: ${item.candidateId}`);
      continue;
    }
    if (selectedIds.has(item.candidateId)) errors.push(`중복 추천 공고 ID: ${item.candidateId}`);
    selectedIds.add(item.candidateId);
    if (item.postingUrl !== candidate.url) errors.push(`${item.candidateId}: 공고 URL이 후보풀과 다르다.`);
    if (item.company !== candidate.company) errors.push(`${item.candidateId}: 회사명이 후보풀과 다르다.`);
    if (item.title !== candidate.title) errors.push(`${item.candidateId}: 공고명이 후보풀과 다르다.`);
    if (item.source !== candidate.source) errors.push(`${item.candidateId}: 소스가 후보풀과 다르다.`);
  }
  return errors;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const poolIndex = args.indexOf("--candidates");
  const input = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  const candidates = poolIndex >= 0 ? args[poolIndex + 1] : undefined;
  if (!input || !candidates) {
    console.error("사용법: validate_recommendation.ts --input <recommendation.json> --candidates <posting-candidates.json>");
    process.exit(2);
  }
  const parsed = RecommendationRun.safeParse(JSON.parse(readFileSync(resolve(input), "utf8")) as unknown);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) console.error(`${issue.path.join(".")}: ${issue.message}`);
    process.exit(1);
  }
  const errors = validateRecommendationAgainstPool(parsed.data, loadPostingCandidatePool(resolve(candidates)));
  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }
  console.log("추천 결과와 공고 후보풀이 일치합니다.");
}
