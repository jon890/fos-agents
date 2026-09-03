import { readFileSync } from "node:fs";
import {
  readingSelectionSchema,
  type ReadingCandidatePool,
  type ReadingSelection,
  type ReadingSelectionItem,
  type ReadingStudyTopic,
} from "./reading_contracts.js";

export type { ReadingSelection, ReadingSelectionItem } from "./reading_contracts.js";

export function validateReadingSelection(selection: unknown, pool: ReadingCandidatePool): string[] {
  const parsed = readingSelectionSchema.safeParse(selection);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    });
  }

  const errors: string[] = [];
  const candidatesById = new Map(pool.candidates.map((candidate) => [candidate.id, candidate]));
  const seenCandidates = new Set<string>();
  const seenContentKeys = new Set<string>();
  const seenTopicKeys = new Set<string>();
  for (const topic of parsed.data.topics) {
    if (pool.recentStudyTopicKeys.includes(topic.topicKey)) {
      errors.push(`직전 리포트에서 추천한 topicKey: ${topic.topicKey}`);
    }
    if (seenTopicKeys.has(topic.topicKey)) {
      errors.push(`중복 topicKey: ${topic.topicKey}`);
    }
    seenTopicKeys.add(topic.topicKey);
    for (const item of topic.items) {
      const candidate = candidatesById.get(item.candidateId);
      if (!candidate) {
        errors.push(`수집 결과에 없는 candidateId: ${item.candidateId}`);
        continue;
      }
      if (candidate.previouslyRecommended) {
        errors.push(`이미 추천한 candidateId: ${item.candidateId}`);
      }
      if (seenCandidates.has(item.candidateId)) {
        errors.push(`중복 candidateId: ${item.candidateId}`);
      }
      seenCandidates.add(item.candidateId);
      if (seenContentKeys.has(candidate.contentKey)) {
        errors.push(`중복 contentKey: ${candidate.contentKey}`);
      }
      seenContentKeys.add(candidate.contentKey);
    }
  }
  return errors;
}

export function loadValidatedReadingSelection(path: string, pool: ReadingCandidatePool): ReadingSelection {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const errors = validateReadingSelection(raw, pool);
  if (errors.length > 0) throw new Error(`읽을거리 선택 검증 실패:\n- ${errors.join("\n- ")}`);
  return readingSelectionSchema.parse(raw);
}

export function topicsFromSelection(
  selection: ReadingSelection,
  pool: ReadingCandidatePool
): ReadingStudyTopic[] {
  const candidatesById = new Map(pool.candidates.map((candidate) => [candidate.id, candidate]));
  return selection.topics.map((topic) => ({
    topicKey: topic.topicKey,
    title: topic.title,
    careerQuestion: topic.careerQuestion,
    items: topic.items.map((item) => {
      const candidate = candidatesById.get(item.candidateId);
      if (!candidate) throw new Error(`검증된 수집 항목을 찾을 수 없다: ${item.candidateId}`);
      return {
        contentKey: candidate.contentKey,
        canonicalUrl: candidate.canonicalUrl,
        sourceKey: candidate.sourceKey,
        sourceName: candidate.sourceName,
        category: candidate.category,
        title: candidate.title,
        url: candidate.url,
        published: candidate.published,
        summary: item.summary.trim(),
        reason: item.reason.trim(),
        careerValue: item.careerValue,
      };
    }),
  }));
}
