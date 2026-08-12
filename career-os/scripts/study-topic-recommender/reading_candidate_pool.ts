import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  DEFAULT_MAX_CANDIDATES_PER_SOURCE,
  isReadingCandidateKind,
  isReadingCollectionStatus,
  isReadingCategory,
  type NormalizedReadingSources,
  type ReadingCandidate,
  type ReadingCandidatePool,
  type ReadingCollectionLog,
  type ReadingSource,
} from "./reading_contracts.js";
import { resolveReadingSourceAdapter } from "./source/adapters/index.js";

export type { ReadingCandidate, ReadingCandidatePool, ReadingCollectionLog } from "./reading_contracts.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sourceName(source: ReadingSource): string {
  return String(source.source || source.title || source.key);
}

function candidateId(sourceKey: string, url: string): string {
  return `${sourceKey}:${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
}

async function collectSource(
  source: ReadingSource,
  cacheDir: string,
  recentUrls: Set<string>,
  maxCandidatesPerSource: number,
  cacheTtlHours: number,
  timeoutMs: number
): Promise<{ candidates: ReadingCandidate[]; log: ReadingCollectionLog }> {
  const adapter = resolveReadingSourceAdapter(source);
  if (!adapter) {
    return {
      candidates: [],
      log: { sourceKey: source.key, status: "no-public-url", candidateCount: 0 },
    };
  }
  const collected = await adapter.collect(source, {
    cacheDir,
    cacheTtlHours,
    timeoutMs,
    maxCandidatesPerSource,
  });
  const candidates = collected.map((item) => ({
    id: candidateId(source.key, item.url),
    sourceKey: source.key,
    sourceName: sourceName(source),
    category: source.category,
    title: item.title,
    url: item.url,
    published: item.published,
    kind: item.kind,
    recentlyRecommended: recentUrls.has(item.url),
    estMinutes: Number(source.estMinutes ?? 20),
  }));
  return {
    candidates,
    log: {
      sourceKey: source.key,
      status: candidates.length === 0
        ? "feed-empty"
        : adapter.id === "feed"
          ? "collected"
          : candidates.some((candidate) => candidate.kind === "page-link")
            ? "page-links"
            : "source-page",
      candidateCount: candidates.length,
    },
  };
}

export async function collectReadingCandidatePool(input: {
  readingSources: NormalizedReadingSources;
  cacheDir: string;
  recentUrls?: Set<string>;
  maxCandidatesPerSource?: number;
  cacheTtlHours?: number;
  timeoutMs?: number;
}): Promise<ReadingCandidatePool> {
  const maxCandidatesPerSource = input.maxCandidatesPerSource ?? DEFAULT_MAX_CANDIDATES_PER_SOURCE;
  const results = await Promise.all(input.readingSources.sources.map((source) => collectSource(
    source,
    input.cacheDir,
    input.recentUrls ?? new Set<string>(),
    maxCandidatesPerSource,
    input.cacheTtlHours ?? 6,
    input.timeoutMs ?? 8_000
  )));
  return {
    generatedAt: new Date().toISOString(),
    policy: {
      selection: "llm",
      fixedKeywordsUsed: false,
      sourcePriorityUsed: false,
      maxCandidatesPerSource,
    },
    candidates: results.flatMap((result) => result.candidates),
    collectionLog: results.map((result) => result.log),
  };
}

export function loadReadingCandidatePool(path: string): ReadingCandidatePool {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const errors = validateReadingCandidatePool(raw);
  if (errors.length > 0) throw new Error(`읽을거리 후보 풀 검증 실패:\n- ${errors.join("\n- ")}`);
  return raw as ReadingCandidatePool;
}

export function validateReadingCandidatePool(pool: unknown): string[] {
  if (!isRecord(pool)) return ["후보 풀이 객체가 아니다."];
  const errors: string[] = [];
  if (typeof pool.generatedAt !== "string" || Number.isNaN(Date.parse(pool.generatedAt))) {
    errors.push("generatedAt이 유효한 시각이 아니다.");
  }
  if (!isRecord(pool.policy)) {
    errors.push("policy 객체가 없다.");
  } else {
    if (pool.policy.selection !== "llm") errors.push("policy.selection은 llm이어야 한다.");
    if (pool.policy.fixedKeywordsUsed !== false) errors.push("고정 키워드 사용은 허용하지 않는다.");
    if (pool.policy.sourcePriorityUsed !== false) errors.push("소스 우선순위 사용은 허용하지 않는다.");
    if (!Number.isInteger(pool.policy.maxCandidatesPerSource) || Number(pool.policy.maxCandidatesPerSource) <= 0) {
      errors.push("policy.maxCandidatesPerSource는 양의 정수여야 한다.");
    }
  }
  if (!Array.isArray(pool.candidates)) return [...errors, "candidates가 배열이 아니다."];
  const ids = new Set<string>();
  for (const rawCandidate of pool.candidates) {
    if (!isRecord(rawCandidate)) {
      errors.push("candidate가 객체가 아니다.");
      continue;
    }
    const id = typeof rawCandidate.id === "string" ? rawCandidate.id : "";
    if (!id) errors.push("candidate.id가 비어 있다.");
    if (ids.has(id)) errors.push(`candidate.id가 중복됐다: ${id}`);
    ids.add(id);
    if (!isReadingCategory(rawCandidate.category)) {
      errors.push(`${id || "candidate"}.category가 올바르지 않다.`);
    }
    if (typeof rawCandidate.sourceKey !== "string" || !rawCandidate.sourceKey.trim()) {
      errors.push(`${id}.sourceKey가 비어 있다.`);
    }
    if (typeof rawCandidate.sourceName !== "string" || !rawCandidate.sourceName.trim()) {
      errors.push(`${id}.sourceName이 비어 있다.`);
    }
    if (!isReadingCandidateKind(rawCandidate.kind)) {
      errors.push(`${id}.kind가 올바르지 않다.`);
    }
    if (typeof rawCandidate.published !== "string") {
      errors.push(`${id}.published는 문자열이어야 한다.`);
    }
    if (typeof rawCandidate.recentlyRecommended !== "boolean") {
      errors.push(`${id}.recentlyRecommended는 boolean이어야 한다.`);
    }
    if (!Number.isInteger(rawCandidate.estMinutes) || Number(rawCandidate.estMinutes) <= 0) {
      errors.push(`${id}.estMinutes는 양의 정수여야 한다.`);
    }
    try {
      const url = new URL(String(rawCandidate.url ?? ""));
      if (url.protocol !== "https:") errors.push(`${id}.url은 HTTPS여야 한다.`);
    } catch {
      errors.push(`${id}.url이 올바르지 않다.`);
    }
    if (typeof rawCandidate.title !== "string" || !rawCandidate.title.trim()) {
      errors.push(`${id}.title이 비어 있다.`);
    }
  }
  if (!Array.isArray(pool.collectionLog)) errors.push("collectionLog가 배열이 아니다.");
  if (Array.isArray(pool.collectionLog)) {
    for (const entry of pool.collectionLog) {
      if (!isRecord(entry)) {
        errors.push("collectionLog 항목이 객체가 아니다.");
        continue;
      }
      if (typeof entry.sourceKey !== "string" || !entry.sourceKey) {
        errors.push("collectionLog.sourceKey가 비어 있다.");
      }
      if (!isReadingCollectionStatus(entry.status)) {
        errors.push(`${String(entry.sourceKey || "collectionLog")}.status가 올바르지 않다.`);
      }
      if (!Number.isInteger(entry.candidateCount) || Number(entry.candidateCount) < 0) {
        errors.push(`${String(entry.sourceKey || "collectionLog")}.candidateCount가 올바르지 않다.`);
      }
    }
  }
  return errors;
}
