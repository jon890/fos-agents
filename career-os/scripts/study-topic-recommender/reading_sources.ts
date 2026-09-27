import {
  READING_CATEGORIES,
  type NormalizedReadingSources,
  type ReadingCategory,
  type ReadingSource,
} from "./reading_contracts.js";

export {
  READING_CATEGORIES,
  type NormalizedReadingSources,
  type ReadingCategory,
  type ReadingSource,
} from "./reading_contracts.js";

export function normalizeReadingSources(
  sources: readonly ReadingSource[]
): NormalizedReadingSources {
  const active = sources.filter((source) => source.enabled !== false);
  const itemsByCategory = Object.fromEntries(
    READING_CATEGORIES.map((category) => [
      category,
      active.filter((source) => source.category === category),
    ])
  ) as Record<ReadingCategory, ReadingSource[]>;

  return {
    sources: active,
    itemsByCategory,
  };
}
