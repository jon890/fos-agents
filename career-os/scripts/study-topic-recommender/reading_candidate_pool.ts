import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  readingCandidatePoolSchema,
  type NormalizedReadingSources,
  type ReadingCandidate,
  type ReadingCandidatePool,
  type ReadingCollectionLog,
  type ReadingSource,
} from "./reading_contracts.js";
import { resolveReadingSourceAdapter } from "./source/adapters/index.js";
import { canonicalizeReadingUrl, readingContentKey } from "./url_identity.js";

export type { ReadingCandidate, ReadingCandidatePool, ReadingCollectionLog } from "./reading_contracts.js";

function sourceName(source: ReadingSource): string {
  return source.title;
}

function candidateId(sourceKey: string, url: string): string {
  return `${sourceKey}:${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
}

async function collectSource(
  source: ReadingSource,
  cacheDir: string,
  previousContentKeys: Set<string>,
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
  const candidatesByContentKey = new Map<string, ReadingCandidate>();
  for (const item of collected) {
    const canonicalUrl = canonicalizeReadingUrl(item.url);
    const contentKey = readingContentKey(canonicalUrl);
    if (candidatesByContentKey.has(contentKey)) continue;
    candidatesByContentKey.set(contentKey, {
      id: candidateId(source.key, canonicalUrl),
      contentKey,
      canonicalUrl,
      sourceKey: source.key,
      sourceName: sourceName(source),
      category: source.category,
      title: item.title,
      url: canonicalUrl,
      published: item.published,
      excerpt: item.excerpt,
      kind: item.kind,
      previouslyRecommended: previousContentKeys.has(contentKey),
    });
  }
  const candidates = [...candidatesByContentKey.values()];
  return {
    candidates,
    log: {
      sourceKey: source.key,
      status: candidates.length === 0
        ? "no-articles"
        : adapter.id === "page"
          ? "page-links"
          : "collected",
      candidateCount: candidates.length,
    },
  };
}

export async function collectReadingCandidatePool(input: {
  readingSources: NormalizedReadingSources;
  cacheDir: string;
  previousContentKeys?: Set<string>;
  recentStudyTopicKeys?: Set<string>;
  maxCandidatesPerSource: number;
  cacheTtlHours: number;
  timeoutMs: number;
}): Promise<ReadingCandidatePool> {
  const maxCandidatesPerSource = input.maxCandidatesPerSource;
  const results = await Promise.all(input.readingSources.sources.map((source) => collectSource(
    source,
    input.cacheDir,
    input.previousContentKeys ?? new Set<string>(),
    maxCandidatesPerSource,
    input.cacheTtlHours,
    input.timeoutMs
  )));
  const candidatesByContentKey = new Map<string, ReadingCandidate>();
  for (const candidate of results.flatMap((result) => result.candidates)) {
    if (!candidatesByContentKey.has(candidate.contentKey)) {
      candidatesByContentKey.set(candidate.contentKey, candidate);
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    recentStudyTopicKeys: [...(input.recentStudyTopicKeys ?? new Set<string>())].sort(),
    policy: {
      selection: "llm",
      fixedKeywordsUsed: false,
      sourcePriorityUsed: false,
      maxCandidatesPerSource,
    },
    candidates: [...candidatesByContentKey.values()],
    collectionLog: results.map((result) => result.log),
  };
}

export function loadReadingCandidatePool(path: string): ReadingCandidatePool {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const result = readingCandidatePoolSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`읽을거리 후보 풀 검증 실패:\n- ${formatIssues(result.error.issues).join("\n- ")}`);
  }
  return result.data;
}

function formatIssues(issues: { path: PropertyKey[]; message: string }[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

export function validateReadingCandidatePool(pool: unknown): string[] {
  const result = readingCandidatePoolSchema.safeParse(pool);
  return result.success ? [] : formatIssues(result.error.issues);
}
