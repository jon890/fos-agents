/**
 * 대기열 선택 순서의 참조 구현이다.
 *
 * 서비스는 이 모듈을 부르지 않는다. 선택이 SQL 로 내려가
 * `repository/positions.repository.ts` 의 `selectAnalysisQueue` 와 `selectCompanyTierQueue` 가
 * 같은 순서를 `ORDER BY` 로 표현한다.
 * 순서 규칙을 읽고 `queue.test.ts` 로 확인하는 자리로 남긴다. 지우지 않는다.
 */
import type { PostingCandidate } from "../contracts/posting-candidate.js";
import type { CompanyTierSource } from "./stored.js";
import type { AnalysisPolicy } from "./schema.js";

export type PendingPosition = {
  positionId: string;
  candidateId: string;
  contentHash: string;
  status: "new" | "changed" | "stale";
  companyTier: number;
  companyTierSource: CompanyTierSource;
  companyTierAssessmentId: string | null;
  pendingSince: string;
  posting: PostingCandidate;
};

export type SelectedPosition = PendingPosition & {
  selectionReason: "priority" | "aging" | "overflow";
};

export type PendingCompany = {
  companyKey: string;
  companyName: string;
  assessmentStatus: "new" | "stale";
  activePositionCount: number;
  firstSeenAt: string;
  representativePostingUrls: string[];
  priorTier: number | null;
  priorReason: string | null;
  priorValidUntil: string | null;
};

const statusOrder = { new: 0, changed: 1, stale: 2 } as const;
const urgencyOrder = { urgent: 0, soon: 1, normal: 2, no_deadline: 3, unknown: 4 } as const;

function priorityCompare(left: PendingPosition, right: PendingPosition): number {
  return (
    left.companyTier - right.companyTier ||
    statusOrder[left.status] - statusOrder[right.status] ||
    urgencyOrder[left.posting.closeUrgency] - urgencyOrder[right.posting.closeUrgency] ||
    left.pendingSince.localeCompare(right.pendingSince) ||
    left.positionId.localeCompare(right.positionId)
  );
}

function agingCompare(left: PendingPosition, right: PendingPosition): number {
  return (
    left.pendingSince.localeCompare(right.pendingSince) ||
    left.positionId.localeCompare(right.positionId)
  );
}

export function selectAnalysisQueue(
  candidates: PendingPosition[],
  policy: AnalysisPolicy,
): SelectedPosition[] {
  const unique = [
    ...new Map(candidates.map((candidate) => [candidate.positionId, candidate])).values(),
  ];
  const selected: SelectedPosition[] = [];
  const selectedIds = new Set<string>();
  const add = (
    candidate: PendingPosition,
    selectionReason: SelectedPosition["selectionReason"],
  ) => {
    if (selectedIds.has(candidate.positionId)) return;
    selectedIds.add(candidate.positionId);
    selected.push({ ...candidate, selectionReason });
  };

  unique
    .slice()
    .sort(priorityCompare)
    .slice(0, policy.prioritySlots)
    .forEach((candidate) => add(candidate, "priority"));
  unique
    .filter((candidate) => !selectedIds.has(candidate.positionId))
    .sort(agingCompare)
    .slice(0, policy.agingSlots)
    .forEach((candidate) => add(candidate, "aging"));
  unique
    .filter((candidate) => !selectedIds.has(candidate.positionId))
    .sort(priorityCompare)
    .slice(0, policy.dailyAnalysisLimit - selected.length)
    .forEach((candidate) => add(candidate, "overflow"));
  return selected;
}

export function selectCompanyTierQueue(
  candidates: PendingCompany[],
  policy: AnalysisPolicy,
): PendingCompany[] {
  const discovery = candidates
    .filter((candidate) => candidate.assessmentStatus === "new")
    .sort(
      (left, right) =>
        right.activePositionCount - left.activePositionCount ||
        left.firstSeenAt.localeCompare(right.firstSeenAt) ||
        left.companyKey.localeCompare(right.companyKey),
    );
  const refresh = candidates
    .filter((candidate) => candidate.assessmentStatus === "stale")
    .sort(
      (left, right) =>
        (left.priorTier ?? 3) - (right.priorTier ?? 3) ||
        (left.priorValidUntil ?? "").localeCompare(right.priorValidUntil ?? "") ||
        left.companyKey.localeCompare(right.companyKey),
    );
  return [...discovery, ...refresh].slice(0, policy.dailyCompanyTierLimit);
}
