import type { PossibleDuplicate } from "../duplicate_detection.js";
import type { TopicItem, BackendItem, LiveSeed, UpdateExistingItem } from "./types.js";
import {
  BACKEND_MIX_TARGET,
  backendDomainGroup,
  scoreBackendItem,
} from "./scoring.js";

// ── backend recommendations (점수 기반 + 설정 가능한 하루 추천 수) ──

export function pickBackendRecommendations(
  yesterdayKeysSet: Set<string>,
  candidateRecommendations: TopicItem[],
  remainingLive: LiveSeed[],
  remainingLiveCandidates: LiveSeed[],
  recentDomainCounts: Map<string, number>,
  recentBackendKeyCounts: Map<string, number>,
  targetTotal: number
): BackendItem[] {
  if (targetTotal <= 0) return [];
  const pool: BackendItem[] = candidateRecommendations.map((item) => ({ ...item }));

  const liveItemSource =
    remainingLive.length > 0
      ? remainingLive.slice(0, targetTotal)
      : remainingLiveCandidates.slice(0, targetTotal);

  for (const seed of liveItemSource) {
    pool.push({
      key: `live-coding-${seed.slug}`,
      title: `라이브코딩 — ${seed.title}`,
      domain: "live-coding",
      tag: "live-coding",
      difficulty: seed.difficulty ?? "중",
      estMinutes: 40,
      whyNow: [
        "1차 면접 live-coding 축을 유지하기 좋다",
        "주제 풀이와 설명 연습을 같이 할 수 있다",
      ],
    });
  }

  for (const item of pool) {
    const key = item.key ?? "";
    const domain = item.domain ?? "";
    const tag = item.tag ?? "new";
    item._score = scoreBackendItem(
      key,
      domain,
      tag,
      yesterdayKeysSet,
      recentDomainCounts,
      recentBackendKeyCounts
    );
  }

  pool.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

  const chosen: BackendItem[] = [];
  const usedTags = new Map<string, number>();
  const chosenKeys = new Set<string>();
  const usedDomains = new Set<string>();

  // First pass: satisfy the tag mix while avoiding repeated backend domain groups
  // and recently shown exact keys.
  for (const item of pool) {
    const key = item.key ?? "";
    const tag = item.tag ?? "new";
    const domain = backendDomainGroup(item.domain);
    if ((recentBackendKeyCounts.get(key) ?? 0) > 0) continue;
    if (usedDomains.has(domain)) continue;
    const tagCount = usedTags.get(tag) ?? 0;
    if (tagCount < (BACKEND_MIX_TARGET[tag] ?? 0)) {
      chosen.push(item);
      chosenKeys.add(key);
      usedDomains.add(domain);
      usedTags.set(tag, tagCount + 1);
      if (chosen.length >= targetTotal) break;
    }
  }

  // Second pass: if one mix slot is impossible, still prefer a fresh domain and non-recent key.
  if (chosen.length < targetTotal) {
    for (const item of pool) {
      const key = item.key ?? "";
      const domain = backendDomainGroup(item.domain);
      if (
        chosenKeys.has(key) ||
        usedDomains.has(domain) ||
        (recentBackendKeyCounts.get(key) ?? 0) > 0
      )
        continue;
      chosen.push(item);
      chosenKeys.add(key);
      usedDomains.add(domain);
      if (chosen.length >= targetTotal) break;
    }
  }

  // 후보 풀이 좁을 때만 같은 분야를 예비 선택한다.
  if (chosen.length < targetTotal) {
    for (const item of pool) {
      const key = item.key ?? "";
      if (chosenKeys.has(key)) continue;
      chosen.push(item);
      chosenKeys.add(key);
      if (chosen.length >= targetTotal) break;
    }
  }

  return chosen.slice(0, targetTotal);
}

// ── duplicate review helpers (ADR-033) ───────────────────────────────────────

export function buildUpdateExisting(
  review: { status: string; items?: UpdateExistingItem[] },
  possibleDuplicates: PossibleDuplicate[]
): UpdateExistingItem[] {
  if (review.items && review.items.length > 0) {
    return review.items
      .filter((i) => i.decision === "update-existing" || i.decision === "needs-user-confirmation")
      .slice(0, 5);
  }
  return possibleDuplicates
    .map((p) => ({
      key: p.key,
      candidatePath: p.candidatePath,
      matchedPath: p.matchedPath,
      decision: "needs-user-confirmation",
      reason: p.reason + " (Claude review skipped/failed — deterministic 추정)",
    }))
    .slice(0, 5);
}
