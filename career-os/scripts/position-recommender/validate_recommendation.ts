#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { firstOptionValue } from "../lib/cli.ts";
import { loadPostingCandidatePool } from "./live-postings/candidate_pool.ts";
import type { PostingCandidatePool } from "./live-postings/contracts.ts";
import { RecommendationRun, type RecommendationRunType } from "./recommendation/schema.ts";

export function validateRecommendationAgainstPool(
  run: RecommendationRunType,
  pool: PostingCandidatePool,
): string[] {
  const errors: string[] = [];
  if (run.sourceSnapshot.collectionRunId !== pool.collectionRunId) {
    errors.push("추천 결과의 수집 실행 ID가 후보풀과 다르다.");
  }
  const byId = new Map(pool.candidates.map((candidate) => [candidate.id, candidate]));
  const rankingById = new Map(run.candidateRanking.map((item) => [item.candidateId, item]));
  const unknownRankedIds = run.candidateRanking
    .map((item) => item.candidateId)
    .filter((candidateId) => !byId.has(candidateId));
  if (unknownRankedIds.length > 0) {
    errors.push(
      `전체 후보 순위에 후보풀 밖의 공고가 있다: ${unknownRankedIds.slice(0, 5).join(", ")}`,
    );
  }
  const missingRankedIds = pool.candidates
    .map((candidate) => candidate.id)
    .filter((candidateId) => !rankingById.has(candidateId));
  if (missingRankedIds.length > 0) {
    errors.push(
      `전체 후보 순위에서 ${missingRankedIds.length}개 공고가 누락됐다: ${missingRankedIds.slice(0, 5).join(", ")}`,
    );
  }
  const orderedRanks = run.candidateRanking.map((item) => item.rank).sort((a, b) => a - b);
  const hasContiguousRanks =
    orderedRanks.length === pool.candidates.length &&
    orderedRanks.every((rank, index) => rank === index + 1);
  if (!hasContiguousRanks) {
    errors.push(`전체 후보 순위는 1부터 ${pool.candidates.length}까지 중복 없이 이어져야 한다.`);
  }
  const selectedIds = new Set<string>();
  for (const item of [...run.tiers.strong, ...run.tiers.stretch]) {
    const candidate = byId.get(item.candidateId);
    if (!candidate) {
      errors.push(`후보풀에 없는 공고 ID: ${item.candidateId}`);
      continue;
    }
    if (selectedIds.has(item.candidateId)) errors.push(`중복 추천 공고 ID: ${item.candidateId}`);
    selectedIds.add(item.candidateId);
    if (item.postingUrl !== candidate.url)
      errors.push(`${item.candidateId}: 공고 URL이 후보풀과 다르다.`);
    if (item.company !== candidate.company)
      errors.push(`${item.candidateId}: 회사명이 후보풀과 다르다.`);
    if (item.title !== candidate.title)
      errors.push(`${item.candidateId}: 공고명이 후보풀과 다르다.`);
    if (item.source !== candidate.source)
      errors.push(`${item.candidateId}: 소스가 후보풀과 다르다.`);
    const ranking = rankingById.get(item.candidateId);
    if (ranking && ranking.rank !== item.rank) {
      errors.push(`${item.candidateId}: 추천 순위와 전체 후보 순위가 다르다.`);
    }
  }
  const suggestedIds = new Set<string>();
  for (const suggestion of run.autoExclusionSuggestions) {
    if (!byId.has(suggestion.candidateId)) {
      errors.push(`자동 제외 제안에 후보풀 밖의 공고가 있다: ${suggestion.candidateId}`);
    }
    const key = `${suggestion.scope}|${suggestion.candidateId}`;
    if (suggestedIds.has(key)) errors.push(`자동 제외 제안이 중복됐다: ${key}`);
    suggestedIds.add(key);
  }
  return errors;
}

export type RecommendationFileValidation =
  | { passed: true; run: RecommendationRunType; pool: PostingCandidatePool }
  | { passed: false; errors: string[] };

/** 스키마를 먼저 검사하고, 통과한 추천만 후보풀과 대조한다. */
export function validateRecommendationFiles(
  input: string,
  candidates: string,
): RecommendationFileValidation {
  const parsed = RecommendationRun.safeParse(
    JSON.parse(readFileSync(resolve(input), "utf8")) as unknown,
  );
  if (!parsed.success) {
    return {
      passed: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }
  const pool = loadPostingCandidatePool(resolve(candidates));
  const errors = validateRecommendationAgainstPool(parsed.data, pool);
  return errors.length > 0 ? { passed: false, errors } : { passed: true, run: parsed.data, pool };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const input = firstOptionValue(args, "--input");
  const candidates = firstOptionValue(args, "--candidates");
  if (!input || !candidates) {
    console.error(
      "사용법: validate_recommendation.ts --input <recommendation.json> --candidates <posting-candidates.json>",
    );
    process.exit(2);
  }
  const result = validateRecommendationFiles(input, candidates);
  if (!result.passed) {
    result.errors.forEach((error) => console.error(error));
    process.exit(1);
  }
  console.log("추천 결과와 공고 후보풀이 일치합니다.");
}
