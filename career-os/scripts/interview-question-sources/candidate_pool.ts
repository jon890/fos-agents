import { createHash } from "node:crypto";
import {
  collectReadingCandidatePool,
} from "../study-topic-recommender/reading_candidate_pool.ts";
import { normalizeReadingSources } from "../study-topic-recommender/reading_sources.ts";
import {
  interviewSourceCandidatePoolSchema,
  type InterviewQuestionSource,
  type InterviewSourceCandidate,
  type InterviewSourceCandidatePool,
} from "./contracts.ts";
import { activeInterviewQuestionSources } from "./sources.ts";

function candidateId(sourceKey: string, url: string): string {
  return `${sourceKey}:${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
}

function staticCandidate(source: InterviewQuestionSource): InterviewSourceCandidate {
  return {
    id: candidateId(source.key, source.url),
    sourceKey: source.key,
    sourceTitle: source.title,
    sourceClass: source.sourceClass,
    usages: source.usages,
    topics: source.topics,
    title: source.title,
    url: source.url,
    published: "",
    kind: "source-root",
  };
}

export function buildStaticInterviewCandidates(
  sources: InterviewQuestionSource[],
): InterviewSourceCandidate[] {
  return sources.filter((source) => source.adapter === "static").map(staticCandidate);
}

function toReadingCategory(source: InterviewQuestionSource) {
  if (source.sourceClass === "conference-talk") return "video" as const;
  if (source.sourceClass === "official-reference") return "ai" as const;
  return "techBlog" as const;
}

export async function collectInterviewSourceCandidatePool(input: {
  config: unknown;
  cacheDir: string;
  maxCandidatesPerSource?: number;
  cacheTtlHours?: number;
  timeoutMs?: number;
}): Promise<InterviewSourceCandidatePool> {
  const sources = activeInterviewQuestionSources(input.config);
  const dynamicSources = sources.filter((source) => source.adapter !== "static");
  const sourceByKey = new Map(sources.map((source) => [source.key, source]));
  const maxCandidatesPerSource = input.maxCandidatesPerSource ?? 24;

  const readingSources = normalizeReadingSources({
    _meta: {
      purpose: "면접 질문 후보 수집을 위해 재사용하는 읽을거리 어댑터 입력",
      schemaVersion: 6,
    },
    sources: dynamicSources.map((source) => ({
      key: source.key,
      title: source.title,
      category: toReadingCategory(source),
      url: source.url,
      feedUrl: source.feedUrl,
      adapter: source.adapter,
      enabled: true,
    })),
  });

  const dynamicPool = await collectReadingCandidatePool({
    readingSources,
    cacheDir: input.cacheDir,
    maxCandidatesPerSource,
    cacheTtlHours: input.cacheTtlHours ?? 12,
    timeoutMs: input.timeoutMs ?? 8_000,
  });

  const dynamicCandidates = dynamicPool.candidates.map((candidate): InterviewSourceCandidate => {
    const source = sourceByKey.get(candidate.sourceKey);
    if (!source) throw new Error(`수집 결과의 출처를 찾을 수 없다: ${candidate.sourceKey}`);
    return {
      id: candidate.id,
      sourceKey: source.key,
      sourceTitle: source.title,
      sourceClass: source.sourceClass,
      usages: source.usages,
      topics: source.topics,
      title: candidate.title,
      url: candidate.url,
      published: candidate.published,
      excerpt: candidate.excerpt,
      kind: candidate.kind.includes("video") ? "video" : "article",
    };
  });

  const staticCandidates = buildStaticInterviewCandidates(sources);
  const pool: InterviewSourceCandidatePool = {
    generatedAt: new Date().toISOString(),
    policy: {
      selection: "llm",
      discoverySourcesAreAnswerAuthority: false,
      maxCandidatesPerSource,
    },
    candidates: [...dynamicCandidates, ...staticCandidates],
    collectionLog: [
      ...dynamicPool.collectionLog.map((entry) => ({
        sourceKey: entry.sourceKey,
        status: entry.candidateCount > 0 ? "collected" as const : "no-candidates" as const,
        candidateCount: entry.candidateCount,
      })),
      ...staticCandidates.map((candidate) => ({
        sourceKey: candidate.sourceKey,
        status: "source-root" as const,
        candidateCount: 1,
      })),
    ],
  };

  return interviewSourceCandidatePoolSchema.parse(pool);
}

