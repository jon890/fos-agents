import { expect, test } from "bun:test";
import {
  analysisQueueResponseSchema,
  analysisResultsRequestSchema,
} from "../../services/recommendation-api/position/schema.ts";

test("fresh 반복 실행은 빈 분석 큐와 재사용 집계를 허용한다", () => {
  const queue = analysisQueueResponseSchema.parse({
    schemaVersion: 1,
    collectionRunId: "collection-2",
    analysisRunId: "analysis-2",
    generatedAt: "2026-09-18T00:00:00.000Z",
    candidates: [],
    summary: {
      activeCount: 10,
      reusedCount: 10,
      queuedCount: 0,
      pendingCount: 0,
      personalExcludedCount: 2,
      newCount: 0,
      changedCount: 0,
      staleCount: 0,
      warningSourceCount: 0,
    },
  });
  const updates = analysisResultsRequestSchema.parse({
    schemaVersion: 1,
    collectionRunId: queue.collectionRunId,
    results: [],
  });
  expect(queue.candidates).toHaveLength(0);
  expect(queue.summary.reusedCount).toBe(10);
  expect(updates.results).toHaveLength(0);
});
