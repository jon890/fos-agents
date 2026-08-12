import { readFileSync } from "node:fs";
import type { ReservoirItem } from "./feed_discovery.js";

export const READING_CATEGORIES = ["techBlog", "ai", "geek"] as const;
export type ReadingCategory = (typeof READING_CATEGORIES)[number];

export interface ReadingCategoryPolicy {
  label: string;
  slots: number;
  requireDiscoveredArticle: boolean;
}

export interface ReadingSource extends ReservoirItem {
  key: string;
  category: ReadingCategory;
  title: string;
  enabled?: boolean;
  priority?: number;
}

export interface ReadingSourcesConfigV2 {
  _meta: {
    purpose: string;
    schemaVersion: 2;
  };
  categories: Record<ReadingCategory, ReadingCategoryPolicy>;
  sources: ReadingSource[];
}

export interface NormalizedReadingSources {
  categories: Record<ReadingCategory, ReadingCategoryPolicy>;
  sources: ReadingSource[];
  itemsByCategory: Record<ReadingCategory, ReadingSource[]>;
}

const DEFAULT_POLICIES: Record<ReadingCategory, ReadingCategoryPolicy> = {
  techBlog: {
    label: "기술 블로그",
    slots: 3,
    requireDiscoveredArticle: true,
  },
  ai: {
    label: "AI 실전",
    slots: 1,
    requireDiscoveredArticle: false,
  },
  geek: {
    label: "개발 동향",
    slots: 1,
    requireDiscoveredArticle: false,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCategory(value: unknown): value is ReadingCategory {
  return typeof value === "string" && READING_CATEGORIES.includes(value as ReadingCategory);
}

function validateHttps(value: unknown, field: string, key: string, errors: string[]): void {
  if (value === undefined) return;
  if (typeof value !== "string") {
    errors.push(`${key}.${field}는 문자열이어야 한다.`);
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") errors.push(`${key}.${field}는 HTTPS URL이어야 한다.`);
  } catch {
    errors.push(`${key}.${field}는 올바른 URL이어야 한다.`);
  }
}

function normalizePolicies(raw: unknown): Record<ReadingCategory, ReadingCategoryPolicy> {
  const source = isRecord(raw) ? raw : {};
  return Object.fromEntries(
    READING_CATEGORIES.map((category) => {
      const value = isRecord(source[category]) ? source[category] : {};
      const defaults = DEFAULT_POLICIES[category];
      const slots = Number(value.slots ?? defaults.slots);
      return [category, {
        label: String(value.label ?? defaults.label),
        slots: Number.isInteger(slots) && slots >= 0 ? slots : defaults.slots,
        requireDiscoveredArticle: Boolean(
          value.requireDiscoveredArticle ?? defaults.requireDiscoveredArticle
        ),
      }];
    })
  ) as Record<ReadingCategory, ReadingCategoryPolicy>;
}

function legacySources(raw: Record<string, unknown>): ReadingSource[] {
  return READING_CATEGORIES.flatMap((category) => {
    const section = isRecord(raw[category]) ? raw[category] : {};
    const items = Array.isArray(section.items) ? section.items : [];
    return items
      .filter(isRecord)
      .map((item, index) => ({
        ...item,
        key: String(item.key ?? ""),
        title: String(item.title ?? item.key ?? ""),
        category,
        enabled: item.enabled !== false,
        priority: Number(item.priority ?? index + 1),
      })) as ReadingSource[];
  });
}

export function toReadingSourcesV2(raw: unknown): ReadingSourcesConfigV2 {
  const root = isRecord(raw) ? raw : {};
  const policies = normalizePolicies(root.categories);
  const rawSources = Array.isArray(root.sources) ? root.sources : legacySources(root);
  const sources = rawSources
    .filter(isRecord)
    .map((item, index) => ({
      ...item,
      key: String(item.key ?? ""),
      title: String(item.title ?? item.key ?? ""),
      category: item.category,
      enabled: item.enabled !== false,
      priority: Number(item.priority ?? index + 1),
    })) as ReadingSource[];

  return {
    _meta: {
      purpose: "study-topic-recommender 외부 읽을거리 소스의 단일 출처",
      schemaVersion: 2,
    },
    categories: policies,
    sources,
  };
}

export function validateReadingSources(config: ReadingSourcesConfigV2): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();

  for (const category of READING_CATEGORIES) {
    const policy = config.categories[category];
    if (!policy) {
      errors.push(`categories.${category}가 없다.`);
      continue;
    }
    if (!Number.isInteger(policy.slots) || policy.slots < 0) {
      errors.push(`categories.${category}.slots는 0 이상의 정수여야 한다.`);
    }
  }

  for (const source of config.sources) {
    if (!source.key) errors.push("소스 key가 비어 있다.");
    if (keys.has(source.key)) errors.push(`중복 key: ${source.key}`);
    keys.add(source.key);
    if (!isCategory(source.category)) errors.push(`${source.key}.category가 올바르지 않다.`);
    if (!source.title) errors.push(`${source.key}.title이 비어 있다.`);
    if (!Number.isFinite(source.priority)) errors.push(`${source.key}.priority는 숫자여야 한다.`);
    validateHttps(source.url, "url", source.key, errors);
    validateHttps(source.feedUrl, "feedUrl", source.key, errors);
    if (source.whyNow !== undefined && !Array.isArray(source.whyNow)) {
      errors.push(`${source.key}.whyNow는 배열이어야 한다.`);
    }
  }
  return errors;
}

export function normalizeReadingSources(raw: unknown): NormalizedReadingSources {
  const config = toReadingSourcesV2(raw);
  const errors = validateReadingSources(config);
  if (errors.length > 0) {
    throw new Error(`외부 읽을거리 설정 오류:\n- ${errors.join("\n- ")}`);
  }

  const active = config.sources
    .filter((source) => source.enabled !== false)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const itemsByCategory = Object.fromEntries(
    READING_CATEGORIES.map((category) => [
      category,
      active.filter((source) => source.category === category),
    ])
  ) as Record<ReadingCategory, ReadingSource[]>;

  return {
    categories: config.categories,
    sources: active,
    itemsByCategory,
  };
}

export function loadReadingSources(path: string): NormalizedReadingSources {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return normalizeReadingSources(raw);
}
