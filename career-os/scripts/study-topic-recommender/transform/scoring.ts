// ── scoring constants (ADR-009/010/012) ──────────────────────────────────────

export const BACKEND_TARGET_TOTAL = 3;
export const BACKEND_MIX_TARGET: Record<string, number> = {
  new: 1,
  deepen: 1,
  "live-coding": 1,
};
export const WEAK_AREAS = new Set([
  "ai-agent",
  "llm-serving",
  "rag",
  "python",
  "security",
  "observability",
]);
// Weak areas still matter, but they should not dominate the daily list.
export const WEAK_AREA_BONUS = 1;
export const RECENT_PENALTY_PER = 3;
export const CARRYOVER_PENALTY = 2;
// Strongly suppress topics already shown in recent recommendation history.
export const RECENT_KEY_PENALTY_PER = 8;
export const BACKEND_KEY_COOLDOWN_ENTRIES = 7;
export const TAG_PRIORITY: Record<string, number> = {
  new: 0,
  deepen: -1,
  review: -2,
  "live-coding": 0,
};

// ADR-012: 보조 카테고리 슬롯
export const TECH_BLOG_SLOTS = 3;
export const AI_SLOTS = 3;
export const GEEK_SLOTS = 1;
// key suppression: cooldown|recent history entries — SECONDARY for secondary, BACKEND for backend keys
export const SECONDARY_COOLDOWN_ENTRIES = 3;

// ── pure utility ──────────────────────────────────────────────────────────────

export function countMap(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const item of items) {
    m.set(item, (m.get(item) ?? 0) + 1);
  }
  return m;
}

/** Collapse adjacent domains for visible diversity in a 3-item daily set. */
export function backendDomainGroup(domain: string | undefined): string {
  const d = domain ?? "";
  if (["database", "mysql", "postgresql"].includes(d)) return "database";
  if (["redis", "cache"].includes(d)) return "cache";
  if (["kafka", "rabbitmq", "sqs", "message-queue"].includes(d))
    return "message-queue";
  if (["spring", "java", "security"].includes(d)) return "java-spring";
  return d || "unknown";
}

/** Pure scoring for a single backend candidate (ADR-009/010). */
export function scoreBackendItem(
  key: string,
  domain: string,
  tag: string,
  yesterdayKeysSet: Set<string>,
  recentDomainCounts: Map<string, number>,
  recentBackendKeyCounts: Map<string, number>
): number {
  let score = -RECENT_PENALTY_PER * (recentDomainCounts.get(domain) ?? 0);
  score -= RECENT_KEY_PENALTY_PER * (recentBackendKeyCounts.get(key) ?? 0);
  if (WEAK_AREAS.has(domain)) score += WEAK_AREA_BONUS;
  score += TAG_PRIORITY[tag] ?? -3;
  if (yesterdayKeysSet.has(key)) score -= CARRYOVER_PENALTY;
  return score;
}
