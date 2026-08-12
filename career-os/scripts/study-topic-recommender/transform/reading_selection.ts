import { readFileSync } from "node:fs";
import type {
  ReadingCandidate,
  ReadingCandidatePool,
  ReadingSelection,
  ReadingSelectionItem,
} from "../reading_contracts.js";
import type {
  NormalizedReadingSources,
  ReadingCategory,
} from "../reading_sources.js";
import { READING_SELECTION_TEXT_MAX_LENGTH } from "../reading_contracts.js";
import type { Recommendation } from "./types.js";

export type { ReadingSelection, ReadingSelectionItem } from "../reading_contracts.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function publicationTime(candidate: ReadingCandidate): number {
  const time = Date.parse(candidate.published);
  return Number.isNaN(time) ? 0 : time;
}

export function deterministicFallbackSelection(
  pool: ReadingCandidatePool,
  readingSources: NormalizedReadingSources
): ReadingSelection {
  const selections = Object.fromEntries(([
    "techBlog",
    "ai",
    "geek",
  ] as ReadingCategory[]).map((category) => {
    const limit = readingSources.categories[category].slots;
    const chosen: ReadingCandidate[] = [];
    const usedSources = new Set<string>();
    const candidates = pool.candidates
      .filter((candidate) => candidate.category === category)
      .sort((a, b) =>
        Number(a.recentlyRecommended) - Number(b.recentlyRecommended) ||
        publicationTime(b) - publicationTime(a) ||
        a.id.localeCompare(b.id)
      );
    for (const candidate of candidates) {
      if (usedSources.has(candidate.sourceKey)) continue;
      chosen.push(candidate);
      usedSources.add(candidate.sourceKey);
      if (chosen.length >= limit) break;
    }
    return [category, chosen.map((candidate) => ({
      candidateId: candidate.id,
      summary: `${candidate.sourceName}에서 공개한 ${candidate.title} 읽을거리다.`,
      reason: "모델 선택 결과가 없을 때 최신성과 출처 다양성을 기준으로 고른 예비 후보다.",
    }))];
  })) as Record<ReadingCategory, ReadingSelectionItem[]>;
  return { selections };
}

export function validateReadingSelection(
  selection: unknown,
  pool: ReadingCandidatePool,
  readingSources: NormalizedReadingSources
): string[] {
  if (!isRecord(selection) || !isRecord(selection.selections)) {
    return ["selections 객체가 없다."];
  }
  const errors: string[] = [];
  const candidatesById = new Map(pool.candidates.map((candidate) => [candidate.id, candidate]));
  for (const category of ["techBlog", "ai", "geek"] as ReadingCategory[]) {
    const items = selection.selections[category];
    if (!Array.isArray(items)) {
      errors.push(`selections.${category}가 배열이 아니다.`);
      continue;
    }
    const availableSources = new Set(
      pool.candidates.filter((candidate) => candidate.category === category)
        .map((candidate) => candidate.sourceKey)
    ).size;
    const expected = Math.min(readingSources.categories[category].slots, availableSources);
    if (items.length !== expected) errors.push(`selections.${category}는 ${expected}개여야 한다.`);
    const seenCandidates = new Set<string>();
    const seenSources = new Set<string>();
    for (const rawItem of items) {
      if (!isRecord(rawItem)) {
        errors.push(`selections.${category} 항목이 객체가 아니다.`);
        continue;
      }
      const candidateId = typeof rawItem.candidateId === "string" ? rawItem.candidateId : "";
      const summary = typeof rawItem.summary === "string" ? rawItem.summary : "";
      const reason = typeof rawItem.reason === "string" ? rawItem.reason : "";
      const candidate = candidatesById.get(candidateId);
      if (!candidate) {
        errors.push(`후보 풀에 없는 candidateId: ${candidateId || "(빈 값)"}`);
        continue;
      }
      if (candidate.category !== category) errors.push(`${candidateId}의 카테고리가 ${category}가 아니다.`);
      if (seenCandidates.has(candidateId)) errors.push(`중복 candidateId: ${candidateId}`);
      if (seenSources.has(candidate.sourceKey)) errors.push(`${category}에서 출처가 중복됐다: ${candidate.sourceKey}`);
      seenCandidates.add(candidateId);
      seenSources.add(candidate.sourceKey);
      if (!summary.trim()) errors.push(`${candidateId}.summary가 비어 있다.`);
      if (!reason.trim()) errors.push(`${candidateId}.reason이 비어 있다.`);
      if (summary.length > READING_SELECTION_TEXT_MAX_LENGTH) {
        errors.push(`${candidateId}.summary가 ${READING_SELECTION_TEXT_MAX_LENGTH}자를 넘는다.`);
      }
      if (reason.length > READING_SELECTION_TEXT_MAX_LENGTH) {
        errors.push(`${candidateId}.reason이 ${READING_SELECTION_TEXT_MAX_LENGTH}자를 넘는다.`);
      }
    }
  }
  return errors;
}

export function loadValidatedReadingSelection(
  path: string,
  pool: ReadingCandidatePool,
  readingSources: NormalizedReadingSources
): ReadingSelection {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const errors = validateReadingSelection(raw, pool, readingSources);
  if (errors.length > 0) throw new Error(`읽을거리 선택 검증 실패:\n- ${errors.join("\n- ")}`);
  return raw as ReadingSelection;
}

export function recommendationsFromSelection(
  selection: ReadingSelection,
  pool: ReadingCandidatePool
): Record<ReadingCategory, Recommendation[]> {
  const candidatesById = new Map(pool.candidates.map((candidate) => [candidate.id, candidate]));
  const buildCategory = (category: ReadingCategory): Recommendation[] =>
    selection.selections[category].map((item) => {
      const candidate = candidatesById.get(item.candidateId);
      if (!candidate) throw new Error(`검증된 후보를 찾을 수 없다: ${item.candidateId}`);
      return {
        key: candidate.sourceKey,
        title: candidate.title,
        source: candidate.sourceName,
        category,
        estMinutes: candidate.estMinutes,
        whyNow: [item.summary.trim(), item.reason.trim()],
        discoveredArticle: {
          title: candidate.title,
          url: candidate.url,
          published: candidate.published,
        },
      } satisfies Recommendation;
    });
  return {
    techBlog: buildCategory("techBlog"),
    ai: buildCategory("ai"),
    geek: buildCategory("geek"),
  };
}
