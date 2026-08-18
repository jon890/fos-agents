import { z } from "zod";
import {
  READING_CATEGORIES,
  readingSourcesConfigSchema,
  type NormalizedReadingSources,
  type ReadingCategory,
  type ReadingSource,
  type ReadingSourcesConfig,
} from "./reading_contracts.js";

export {
  READING_CATEGORIES,
  type NormalizedReadingSources,
  type ReadingCategory,
  type ReadingSource,
  type ReadingSourcesConfig,
} from "./reading_contracts.js";

function issueMessage(issue: z.core.$ZodIssue): string {
  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

export function validateReadingSources(raw: unknown): string[] {
  const result = readingSourcesConfigSchema.safeParse(raw);
  return result.success ? [] : result.error.issues.map(issueMessage);
}

export function parseReadingSourcesConfig(raw: unknown): ReadingSourcesConfig {
  const result = readingSourcesConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`외부 읽을거리 설정 오류:\n- ${result.error.issues.map(issueMessage).join("\n- ")}`);
  }
  return result.data;
}

export function normalizeReadingSources(raw: unknown): NormalizedReadingSources {
  const config = parseReadingSourcesConfig(raw);
  const active = config.sources.filter((source) => source.enabled !== false);
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
