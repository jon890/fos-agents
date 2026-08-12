import { readFileSync } from "node:fs";
import {
  READING_CATEGORIES,
  readingSelectionSchema,
  type NormalizedReadingSources,
  type ReadingCandidatePool,
  type ReadingCategory,
  type ReadingRecommendation,
  type ReadingSelection,
  type ReadingSelectionItem,
} from "./reading_contracts.js";

export type { ReadingSelection, ReadingSelectionItem } from "./reading_contracts.js";

export function validateReadingSelection(
  selection: unknown,
  pool: ReadingCandidatePool,
  readingSources: NormalizedReadingSources
): string[] {
  const parsed = readingSelectionSchema.safeParse(selection);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    });
  }
  const errors: string[] = [];
  const candidatesById = new Map(pool.candidates.map((candidate) => [candidate.id, candidate]));
  for (const category of READING_CATEGORIES) {
    const items = parsed.data.selections[category];
    const availableSources = new Set(
      pool.candidates.filter((candidate) => candidate.category === category)
        .map((candidate) => candidate.sourceKey)
    ).size;
    const expected = Math.min(readingSources.categories[category].slots, availableSources);
    if (items.length !== expected) errors.push(`selections.${category}는 ${expected}개여야 한다.`);
    const seenCandidates = new Set<string>();
    const seenSources = new Set<string>();
    for (const rawItem of items) {
      const candidateId = rawItem.candidateId;
      const candidate = candidatesById.get(candidateId);
      if (!candidate) {
        errors.push(`수집 결과에 없는 candidateId: ${candidateId || "(빈 값)"}`);
        continue;
      }
      if (candidate.category !== category) errors.push(`${candidateId}의 카테고리가 ${category}가 아니다.`);
      if (seenCandidates.has(candidateId)) errors.push(`중복 candidateId: ${candidateId}`);
      if (seenSources.has(candidate.sourceKey)) errors.push(`${category}에서 출처가 중복됐다: ${candidate.sourceKey}`);
      seenCandidates.add(candidateId);
      seenSources.add(candidate.sourceKey);
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
  return readingSelectionSchema.parse(raw);
}

export function recommendationsFromSelection(
  selection: ReadingSelection,
  pool: ReadingCandidatePool
): Record<ReadingCategory, ReadingRecommendation[]> {
  const candidatesById = new Map(pool.candidates.map((candidate) => [candidate.id, candidate]));
  const buildCategory = (category: ReadingCategory): ReadingRecommendation[] =>
    selection.selections[category].map((item) => {
      const candidate = candidatesById.get(item.candidateId);
      if (!candidate) throw new Error(`검증된 수집 항목을 찾을 수 없다: ${item.candidateId}`);
      return {
        sourceKey: candidate.sourceKey,
        sourceName: candidate.sourceName,
        category,
        title: candidate.title,
        url: candidate.url,
        published: candidate.published,
        summary: item.summary.trim(),
        reason: item.reason.trim(),
      };
    });
  return {
    techBlog: buildCategory("techBlog"),
    geek: buildCategory("geek"),
  };
}
