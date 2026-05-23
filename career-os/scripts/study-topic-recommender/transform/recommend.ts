import type { ReservoirItem } from "../feed_discovery.js";
import type { PossibleDuplicate } from "../duplicate_detection.js";
import type { TopicItem, BackendItem, LiveSeed, Recommendation, UpdateExistingItem } from "./types.js";
import {
  BACKEND_TARGET_TOTAL,
  BACKEND_MIX_TARGET,
  backendDomainGroup,
  scoreBackendItem,
} from "./scoring.js";

// ── backend recommendations (ADR-010 점수 기반 + ADR-012 3-item mix target) ──

export function pickBackendRecommendations(
  yesterdayKeysSet: Set<string>,
  candidateRecommendations: TopicItem[],
  remainingLive: LiveSeed[],
  remainingLiveCandidates: LiveSeed[],
  recentDomainCounts: Map<string, number>,
  recentBackendKeyCounts: Map<string, number>
): BackendItem[] {
  const pool: BackendItem[] = candidateRecommendations.map((item) => ({ ...item }));

  const liveItemSource =
    remainingLive.length > 0
      ? remainingLive.slice(0, 3)
      : remainingLiveCandidates.slice(0, 3);

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
      if (chosen.length >= BACKEND_TARGET_TOTAL) break;
    }
  }

  // Second pass: if one mix slot is impossible, still prefer a fresh domain and non-recent key.
  if (chosen.length < BACKEND_TARGET_TOTAL) {
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
      if (chosen.length >= BACKEND_TARGET_TOTAL) break;
    }
  }

  // Final fallback: only repeat domains when the reservoir is genuinely narrow.
  if (chosen.length < BACKEND_TARGET_TOTAL) {
    for (const item of pool) {
      const key = item.key ?? "";
      if (chosenKeys.has(key)) continue;
      chosen.push(item);
      chosenKeys.add(key);
      if (chosen.length >= BACKEND_TARGET_TOTAL) break;
    }
  }

  return chosen.slice(0, BACKEND_TARGET_TOTAL);
}

// ── secondary recommendations ─────────────────────────────────────────────────

/**
 * 비-backend 카테고리(tech-blog / AI / geek) 추천 선택.
 *
 * 1차: cooldown(최근 history N개) 안에 없는 항목을 reservoir 순서대로 선택.
 * 2차: 부족하면 recently_shown 포함해서라도 채움.
 * reservoir 순서는 사람이 큐레이션한 우선도이므로 추가 정렬을 하지 않는다.
 */
export function pickSecondary(
  items: ReservoirItem[],
  recentlyShownKeys: Set<string>,
  limit: number
): Recommendation[] {
  if (items.length === 0) return [];
  const fresh = items.filter((item) => !recentlyShownKeys.has(item.key ?? ""));
  const chosen: Recommendation[] = fresh.slice(0, limit).map((i) => ({ ...i }));
  if (chosen.length >= limit) return chosen;
  const chosenKeys = new Set(chosen.map((item) => item.key));
  for (const item of items) {
    if (chosenKeys.has(item.key)) continue;
    chosen.push({ ...item });
    chosenKeys.add(item.key);
    if (chosen.length >= limit) break;
  }
  return chosen.slice(0, limit);
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
