import { expect, test } from "bun:test";
import type { PostingCandidate } from "../../../scripts/position-recommender/live-postings/contracts.ts";
import { selectAnalysisQueue, type PendingPosition } from "./queue.ts";

function pending(index: number, tier: number, pendingSince: string): PendingPosition {
  const posting: PostingCandidate = {
    id: `candidate-${index}`,
    source: "wanted",
    company: `회사 ${index}`,
    title: `백엔드 ${index}`,
    url: `https://example.com/jobs/${index}`,
    identityHash: `wanted:${index}`,
    linkType: "direct_posting",
    postingStatus: "active",
    activeEvidence: "active",
    openedAt: "",
    closesAt: "",
    daysUntilClose: "",
    closeUrgency: "normal",
    category: "개발",
    summary: "서버 개발",
    tags: [],
    skills: [],
    dueTime: "",
    mainTasks: "서버 개발",
    requirements: "Java",
    preferred: "",
  };
  return {
    positionId: `position-${index.toString().padStart(2, "0")}`,
    candidateId: posting.id,
    contentHash: `hash-${index}`,
    status: "new",
    companyTier: tier,
    companyTierSource: tier === 3 ? ("default" as const) : ("manual" as const),
    companyTierAssessmentId: null,
    pendingSince,
    posting,
  };
}

test("16개 우선 슬롯과 4개 오래 기다린 슬롯을 중복 없이 고른다", () => {
  const candidates = [
    ...Array.from({ length: 16 }, (_, index) => pending(index, 1, "2026-09-17T00:00:00.000Z")),
    ...Array.from({ length: 9 }, (_, index) =>
      pending(index + 16, 3, `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
    ),
  ];
  const selected = selectAnalysisQueue(candidates, {
    schemaVersion: 2,
    candidateContextVersion: "context-1",
    dailyAnalysisLimit: 20,
    prioritySlots: 16,
    agingSlots: 4,
    staleAfterDays: 30,
    defaultCompanyTier: 3,
    dailyCompanyTierLimit: 5,
    companyTierStaleAfterDays: 90,
  });
  expect(selected).toHaveLength(20);
  expect(selected.slice(0, 16).every((entry) => entry.selectionReason === "priority")).toBe(true);
  expect(selected.slice(16).map((entry) => entry.positionId)).toEqual([
    "position-16",
    "position-17",
    "position-18",
    "position-19",
  ]);
  expect(new Set(selected.map((entry) => entry.positionId)).size).toBe(20);
});
