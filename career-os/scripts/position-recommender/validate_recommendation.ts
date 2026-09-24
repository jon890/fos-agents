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
  const validateOriginalFields = (
    item: { candidateId: string; postingUrl: string; company: string; title: string },
    context: string,
  ) => {
    const candidate = byId.get(item.candidateId);
    if (!candidate) {
      errors.push(`후보풀에 없는 ${context} 공고 ID: ${item.candidateId}`);
      return;
    }
    if (item.postingUrl !== candidate.url)
      errors.push(`${item.candidateId}: ${context} 공고 URL이 후보풀과 다르다.`);
    if (item.company !== candidate.company)
      errors.push(`${item.candidateId}: ${context} 회사명이 후보풀과 다르다.`);
    if (item.title !== candidate.title)
      errors.push(`${item.candidateId}: ${context} 공고명이 후보풀과 다르다.`);
  };

  const rankedIds = new Set<string>();
  for (const item of run.ranking) {
    validateOriginalFields(item, "순위");
    rankedIds.add(item.candidateId);
  }
  const pendingIds = new Set<string>();
  for (const item of run.pendingCandidates) {
    validateOriginalFields(item, "분석 대기");
    pendingIds.add(item.candidateId);
    if (rankedIds.has(item.candidateId))
      errors.push(`순위와 분석 대기에 중복된 공고 ID: ${item.candidateId}`);
  }
  if (rankedIds.size + pendingIds.size !== pool.candidates.length) {
    errors.push(
      `순위와 분석 대기 합계가 후보풀과 다르다: 순위 ${rankedIds.size}건, 대기 ${pendingIds.size}건, 후보풀 ${pool.candidates.length}건`,
    );
  }
  for (const candidate of pool.candidates) {
    if (!rankedIds.has(candidate.id) && !pendingIds.has(candidate.id))
      errors.push(`순위와 분석 대기에서 빠진 공고 ID: ${candidate.id}`);
  }

  const selectedIds = new Set<string>();
  for (const [index, item] of run.recommendations.entries()) {
    validateOriginalFields(item, "추천");
    if (selectedIds.has(item.candidateId)) errors.push(`중복 추천 공고 ID: ${item.candidateId}`);
    selectedIds.add(item.candidateId);
    if (!rankedIds.has(item.candidateId))
      errors.push(`추천 공고가 전체 순위에 없다: ${item.candidateId}`);
    if (run.ranking[index]?.candidateId !== item.candidateId)
      errors.push(`상세 추천 ${index + 1}위가 전체 순위와 다르다: ${item.candidateId}`);
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
      "사용법: validate_recommendation.ts --input <추천.json> --candidates <후보.json>",
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
