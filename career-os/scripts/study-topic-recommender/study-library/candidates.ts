import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  type MorningReadingReport,
  type ReadingCandidate,
  type ReadingCandidatePool,
  type ReadingCategory,
} from "../reading_contracts.js";
import { toReadingCandidate, type StudyLibrarySource } from "./contracts.js";
import { StudyLibraryApiError, type StudyLibraryClient } from "./client.js";

export const STUDY_LIBRARY_CANDIDATE_LIMIT = 100;
export const STUDY_LIBRARY_META_FILENAME = "study-library-meta.json";

export interface StudyLibraryCandidateFilters {
  sourceKey?: string;
  category?: ReadingCategory;
  publishedFrom?: string;
  publishedTo?: string;
  limit?: number;
  cursor?: string;
}

export interface StudyLibraryCandidateMeta {
  historyVersion: number;
  filters: {
    sourceKey?: string;
    category?: ReadingCategory;
    publishedFrom?: string;
    publishedTo?: string;
    limit: number;
    cursor?: string;
  };
  nextCursor: string | null;
  enabledSources: Array<{
    sourceKey: string;
    title: string;
    category: ReadingCategory;
  }>;
}

export interface PrepareStudyLibraryCandidatesResult {
  candidatePoolPath: string;
  metaPath: string;
  candidateCount: number;
  historyVersion: number;
  nextCursor: string | null;
}

function normalizedLimit(limit?: number): number {
  if (limit === undefined) return STUDY_LIBRARY_CANDIDATE_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > STUDY_LIBRARY_CANDIDATE_LIMIT) {
    throw new Error("--limit은 1 이상 100 이하의 정수여야 한다.");
  }
  return limit;
}

function searchParams(filters: StudyLibraryCandidateFilters): Record<string, string | number | undefined> {
  return {
    sourceKey: filters.sourceKey,
    category: filters.category,
    publishedFrom: filters.publishedFrom,
    publishedTo: filters.publishedTo,
    limit: normalizedLimit(filters.limit),
    cursor: filters.cursor,
  };
}

function enabledSourceSummary(sources: StudyLibrarySource[]): StudyLibraryCandidateMeta["enabledSources"] {
  return sources
    .filter((source) => source.enabled)
    .map((source) => ({
      sourceKey: source.sourceKey,
      title: source.title,
      category: source.category,
    }));
}

export function studyLibraryMetaPath(candidatePoolPath: string): string {
  return join(dirname(candidatePoolPath), STUDY_LIBRARY_META_FILENAME);
}

export function buildLibraryCandidatePool(input: {
  generatedAt?: string;
  limit?: number;
  candidates: ReturnType<typeof toReadingCandidate>[];
  recentStudyTopicKeys: string[];
}): ReadingCandidatePool {
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    recentStudyTopicKeys: [...input.recentStudyTopicKeys].sort(),
    policy: {
      selection: "llm",
      fixedKeywordsUsed: false,
      sourcePriorityUsed: false,
      maxCandidatesPerSource: normalizedLimit(input.limit),
    },
    candidates: input.candidates,
    collectionLog: [],
  };
}

export function buildReportCountsFromLibrary(input: {
  candidatePool: ReadingCandidatePool;
  meta: StudyLibraryCandidateMeta;
}): MorningReadingReport["counts"] {
  const categoryCounts: Record<ReadingCategory, number> = {
    techBlog: 0,
    geek: 0,
    ai: 0,
    video: 0,
  };
  for (const source of input.meta.enabledSources) {
    categoryCounts[source.category] += 1;
  }
  return {
    activeSources: input.meta.enabledSources.length,
    sourcesWithCandidates: new Set(input.candidatePool.candidates.map((candidate) => candidate.sourceKey)).size,
    collectedArticles: input.candidatePool.candidates.length,
    techBlogSources: categoryCounts.techBlog,
    geekSources: categoryCounts.geek,
    aiSources: categoryCounts.ai,
    videoSources: categoryCounts.video,
  };
}

export async function fetchStudyLibraryCandidatePool(input: {
  client: StudyLibraryClient;
  filters?: StudyLibraryCandidateFilters;
  generatedAt?: string;
}): Promise<{ pool: ReadingCandidatePool; meta: StudyLibraryCandidateMeta }> {
  const filters = input.filters ?? {};
  const limit = normalizedLimit(filters.limit);
  const sourcesResponse = await input.client.getSources();
  const candidates: ReadingCandidate[] = [];
  const seenCursors = new Set<string>();
  let cursor = filters.cursor;
  let historyVersion: number | undefined;
  let recentStudyTopicKeys: string[] = [];
  let nextCursor: string | null = null;

  while (true) {
    const page = await input.client.getCandidates(searchParams({ ...filters, limit, cursor }));
    if (historyVersion === undefined) {
      historyVersion = page.historyVersion;
      recentStudyTopicKeys = page.recentStudyTopicKeys;
    } else if (page.historyVersion !== historyVersion) {
      throw new StudyLibraryApiError({ status: 409, code: "VERSION_CONFLICT" });
    }
    candidates.push(...page.candidates.map(toReadingCandidate));
    nextCursor = page.nextCursor;
    if (!nextCursor) break;
    if (seenCursors.has(nextCursor)) {
      throw new Error("후보 조회 cursor가 반복되어 중단한다.");
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  const meta: StudyLibraryCandidateMeta = {
    historyVersion: historyVersion ?? 0,
    filters: {
      sourceKey: filters.sourceKey,
      category: filters.category,
      publishedFrom: filters.publishedFrom,
      publishedTo: filters.publishedTo,
      limit,
      cursor: filters.cursor,
    },
    nextCursor,
    enabledSources: enabledSourceSummary(sourcesResponse.sources),
  };
  return {
    pool: buildLibraryCandidatePool({
      generatedAt: input.generatedAt,
      limit,
      candidates,
      recentStudyTopicKeys,
    }),
    meta,
  };
}

export async function prepareStudyLibraryCandidates(input: {
  client: StudyLibraryClient;
  outputPath: string;
  filters?: StudyLibraryCandidateFilters;
  generatedAt?: string;
}): Promise<PrepareStudyLibraryCandidatesResult> {
  const { pool, meta } = await fetchStudyLibraryCandidatePool(input);
  mkdirSync(dirname(input.outputPath), { recursive: true });
  writeFileSync(input.outputPath, `${JSON.stringify(pool, null, 2)}\n`, "utf8");
  const metaPath = studyLibraryMetaPath(input.outputPath);
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  return {
    candidatePoolPath: input.outputPath,
    metaPath,
    candidateCount: pool.candidates.length,
    historyVersion: meta.historyVersion,
    nextCursor: meta.nextCursor,
  };
}
