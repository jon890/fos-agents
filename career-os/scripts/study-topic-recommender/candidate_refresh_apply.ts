/**
 * candidate_refresh_apply.ts — ADR-070 config/study-pack-candidates.json append/update/stale helper.
 *
 * `new` 결정이 통과된 후보만 config에 반영한다.
 * `update-existing`, `skip`, `needs-confirmation`은 이 파일에서 config에 쓰지 않는다.
 * active 자동 후보 30개 제한, 30일 이상 미선택 stale 판정을 적용한다.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import {
  isAutoCandidate,
  type AutoCandidateEntry,
  type CandidateRefreshApplied,
  type CandidateRefreshDecision,
  type CandidateRefreshProposal,
} from "./candidate_refresh_schema.js";

// ── 상수 ──────────────────────────────────────────────────────────────────────

/** active 자동 후보 상한 (ADR-070 D8) */
export const ACTIVE_AUTO_LIMIT = 30;

/** stale 판정 기준 일수 (ADR-070 D8) */
export const STALE_DAYS = 30;

const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

// ── config 파일 구조 ──────────────────────────────────────────────────────────

export interface StudyPackCandidatesFile {
  _meta: Record<string, unknown>;
  _comment?: string;
  topics: Array<Record<string, unknown>>;
}

// ── stale 판정 ────────────────────────────────────────────────────────────────

/**
 * 자동 후보가 stale 처리 대상인지 판정한다.
 *
 * `generatedAt`을 기준으로 STALE_DAYS 이상 경과하고 여전히 active이면 stale 대상이다.
 * 선택 이력 필드(lastSelectedAt 등)가 schema에 없으므로 생성일을 기준으로 삼는다.
 * promoted 상태는 이미 study pack이 생성된 경우이므로 stale 대상이 아니다.
 */
export function isStaleAutoCandidate(
  entry: AutoCandidateEntry,
  nowMs: number
): boolean {
  if (entry.status !== "active") return false;
  const generatedMs = new Date(entry.generatedAt).getTime();
  if (isNaN(generatedMs)) return false;
  return nowMs - generatedMs > STALE_MS;
}

// ── 카운트 helper ─────────────────────────────────────────────────────────────

/** source=llm-candidate-refresh이고 status=active인 후보 수를 반환한다. */
export function countActiveAutoCandidates(
  topics: Array<Record<string, unknown>>
): number {
  return topics.filter(
    (t) => isAutoCandidate(t) && (t as AutoCandidateEntry).status === "active"
  ).length;
}

// ── apply ─────────────────────────────────────────────────────────────────────

/**
 * `new` 결정을 통과한 후보만 config/study-pack-candidates.json에 append/update한다.
 *
 * 처리 순서:
 * 1. 기존 자동 후보 중 stale 대상을 status=stale로 전환한다.
 * 2. 남은 active 슬롯만큼 `new` 결정 후보를 추가한다.
 *    - 같은 key가 이미 있으면 update(덮어쓰기), 없으면 append한다.
 * 3. 변경된 파일을 trailing newline과 함께 저장한다.
 *
 * `update-existing`, `skip`, `needs-confirmation`은 이 함수에서 config에 쓰지 않는다.
 */
export function applyNewCandidates(
  configPath: string,
  proposals: CandidateRefreshProposal[],
  decisions: CandidateRefreshDecision[],
  generatedAt: string
): CandidateRefreshApplied {
  const applied: CandidateRefreshApplied = {
    configPath,
    added: [],
    updated: [],
    staled: [],
  };

  let file: StudyPackCandidatesFile;
  if (existsSync(configPath)) {
    try {
      file = JSON.parse(readFileSync(configPath, "utf-8")) as StudyPackCandidatesFile;
    } catch {
      file = { _meta: { schema_version: "3" }, topics: [] };
    }
  } else {
    file = { _meta: { schema_version: "3" }, topics: [] };
  }

  if (!Array.isArray(file.topics)) {
    file.topics = [];
  }

  const nowMs = new Date(generatedAt).getTime();

  // 1. stale 전환
  for (const topic of file.topics) {
    if (!isAutoCandidate(topic)) continue;
    const entry = topic as AutoCandidateEntry;
    if (isStaleAutoCandidate(entry, nowMs)) {
      entry.status = "stale";
      applied.staled.push(entry.key);
    }
  }

  // 2. new 결정만 반영 (update-existing / skip / needs-confirmation 제외)
  const newDecisions = decisions.filter((d) => d.decision === "new");
  const proposalMap = new Map(proposals.map((p) => [p.key, p]));

  for (const decision of newDecisions) {
    const proposal = proposalMap.get(decision.key);
    if (!proposal) continue;

    const existingIdx = file.topics.findIndex(
      (t) => (t as AutoCandidateEntry).key === decision.key
    );

    const newEntry: AutoCandidateEntry = {
      key: proposal.key,
      title: proposal.title,
      domain: proposal.domain,
      tag: proposal.tag,
      difficulty: proposal.difficulty,
      estMinutes: proposal.estMinutes,
      whyNow: proposal.whyNow,
      source: "llm-candidate-refresh",
      generatedAt,
      status: "active",
      sourceSignals: proposal.sourceSignals,
      promotionTarget: { outputPath: proposal.promotionTarget.outputPath },
    };

    if (existingIdx >= 0) {
      // 사람이 고른 seed/pin은 자동 후보가 덮어쓰지 않는다.
      const existing = file.topics[existingIdx];
      if (!isAutoCandidate(existing)) continue;

      // 기존 자동 후보 update — active 슬롯 카운트 변동 없이 덮어쓴다
      file.topics[existingIdx] = newEntry;
      applied.updated.push(decision.key);
    } else {
      // 신규 append — active 한도 초과 여부 확인
      const activeCount = countActiveAutoCandidates(file.topics);
      if (activeCount >= ACTIVE_AUTO_LIMIT) break;
      file.topics.push(newEntry);
      applied.added.push(decision.key);
    }
  }

  writeFileSync(configPath, JSON.stringify(file, null, 2) + "\n", "utf-8");
  return applied;
}
