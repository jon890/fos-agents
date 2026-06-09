/**
 * candidate_refresh_schema.ts — ADR-070 후보 refresh 타입 및 검증 helper.
 *
 * proposal/decision/applied 타입과 JSON parse/validate 함수만 담는다.
 * LLM 호출 entrypoint와 config write는 이 파일 밖에서 처리한다.
 */

// ── 상수 ──────────────────────────────────────────────────────────────────────

export const CANDIDATE_TAGS = ["new", "deepen", "interview", "live-coding"] as const;
export const DECISION_CLASSES = ["new", "update-existing", "skip", "needs-confirmation"] as const;
export const AUTO_CANDIDATE_STATUSES = ["active", "stale", "promoted"] as const;
export const TRIGGER_KINDS = ["on-demand", "cron-health-check", "recommendation-needs-refresh"] as const;

export type CandidateTag = (typeof CANDIDATE_TAGS)[number];
export type CandidateDecisionClass = (typeof DECISION_CLASSES)[number];
export type AutoCandidateStatus = (typeof AUTO_CANDIDATE_STATUSES)[number];
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

// ── 제안 (LLM 출력) ──────────────────────────────────────────────────────────

export interface CandidateRefreshProposal {
  key: string;
  title: string;
  domain: string;
  tag: CandidateTag;
  difficulty: string;
  estMinutes: number;
  whyNow: string[];
  promotionTarget: { outputPath: string };
  sourceSignals: string[];
}

// ── 결정 (deterministic 검증 후) ─────────────────────────────────────────────

export interface CandidateRefreshDecision {
  key: string;
  decision: CandidateDecisionClass;
  candidatePath: string;
  matchedPath: string | null;
  reason: string;
}

// ── 적용 결과 ─────────────────────────────────────────────────────────────────

export interface CandidateRefreshApplied {
  configPath: string;
  added: string[];
  updated: string[];
  staled: string[];
}

// ── refresh 실행 기록 전체 ────────────────────────────────────────────────────

export interface CandidateRefreshTrigger {
  kind: TriggerKind;
  reason: string;
  sourceMessage: string | null;
}

export interface CandidateRefreshInputs {
  fosStudyMarkdownCount: number;
  recentHistoryEntries: number;
  remainingNewCandidates: number;
  dominantRecentDomains: string[];
}

export interface CandidateRefreshReport {
  generatedAt: string;
  trigger: CandidateRefreshTrigger;
  inputs: CandidateRefreshInputs;
  proposals: CandidateRefreshProposal[];
  decisions: CandidateRefreshDecision[];
  applied: CandidateRefreshApplied;
}

// ── config에 자동 반영되는 후보 항목 (ADR-070) ────────────────────────────────

export interface AutoCandidateEntry {
  key: string;
  title: string;
  domain: string;
  tag: CandidateTag;
  difficulty: string;
  estMinutes: number;
  whyNow: string[];
  source: "llm-candidate-refresh";
  generatedAt: string;
  status: AutoCandidateStatus;
  sourceSignals: string[];
  promotionTarget: { outputPath: string };
}

// ── 검증 결과 타입 ────────────────────────────────────────────────────────────

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

// ── 검증 helper ───────────────────────────────────────────────────────────────

const tagSet = new Set<string>(CANDIDATE_TAGS);
const decisionSet = new Set<string>(DECISION_CLASSES);
const triggerKindSet = new Set<string>(TRIGGER_KINDS);

export function validateProposal(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["proposal must be an object"] };
  }
  const p = raw as Record<string, unknown>;
  if (typeof p.key !== "string" || !p.key.trim()) {
    errors.push("key: required non-empty string");
  }
  if (typeof p.title !== "string" || !p.title.trim()) {
    errors.push("title: required non-empty string");
  }
  if (typeof p.domain !== "string" || !p.domain.trim()) {
    errors.push("domain: required non-empty string");
  }
  if (!tagSet.has(p.tag as string)) {
    errors.push(`tag: must be one of ${CANDIDATE_TAGS.join(" | ")}`);
  }
  if (typeof p.difficulty !== "string" || !p.difficulty.trim()) {
    errors.push("difficulty: required non-empty string");
  }
  if (typeof p.estMinutes !== "number" || p.estMinutes <= 0 || !Number.isInteger(p.estMinutes)) {
    errors.push("estMinutes: required positive integer");
  }
  if (
    !Array.isArray(p.whyNow) ||
    p.whyNow.length === 0 ||
    p.whyNow.some((item) => typeof item !== "string" || !item.trim())
  ) {
    errors.push("whyNow: required non-empty string array");
  }
  if (
    !Array.isArray(p.sourceSignals) ||
    p.sourceSignals.some((item) => typeof item !== "string" || !item.trim())
  ) {
    errors.push("sourceSignals: required string array");
  }
  if (!p.promotionTarget || typeof p.promotionTarget !== "object") {
    errors.push("promotionTarget: required object");
  } else {
    const pt = p.promotionTarget as Record<string, unknown>;
    if (typeof pt.outputPath !== "string" || !pt.outputPath.trim()) {
      errors.push("promotionTarget.outputPath: required non-empty string");
    }
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export function validateDecision(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["decision must be an object"] };
  }
  const d = raw as Record<string, unknown>;
  if (typeof d.key !== "string" || !d.key.trim()) {
    errors.push("key: required non-empty string");
  }
  if (!decisionSet.has(d.decision as string)) {
    errors.push(`decision: must be one of ${DECISION_CLASSES.join(" | ")}`);
  }
  if (typeof d.candidatePath !== "string" || !d.candidatePath.trim()) {
    errors.push("candidatePath: required non-empty string");
  }
  if (d.matchedPath !== null && typeof d.matchedPath !== "string") {
    errors.push("matchedPath: must be string or null");
  }
  if (typeof d.reason !== "string") {
    errors.push("reason: required string");
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export function validateTrigger(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["trigger must be an object"] };
  }
  const t = raw as Record<string, unknown>;
  if (!triggerKindSet.has(t.kind as string)) {
    errors.push(`trigger.kind: must be one of ${TRIGGER_KINDS.join(" | ")}`);
  }
  if (typeof t.reason !== "string") {
    errors.push("trigger.reason: required string");
  }
  if (t.sourceMessage !== null && typeof t.sourceMessage !== "string") {
    errors.push("trigger.sourceMessage: must be string or null");
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ── 배열 parse helper ─────────────────────────────────────────────────────────

export interface ParseResult<T> {
  valid: T[];
  invalid: Array<{ index: number; errors: string[] }>;
}

export function parseProposals(raw: unknown): ParseResult<CandidateRefreshProposal> {
  if (!Array.isArray(raw)) {
    return { valid: [], invalid: [{ index: -1, errors: ["proposals must be an array"] }] };
  }
  const valid: CandidateRefreshProposal[] = [];
  const invalid: Array<{ index: number; errors: string[] }> = [];
  for (let i = 0; i < raw.length; i++) {
    const result = validateProposal(raw[i]);
    if (result.valid) {
      valid.push(raw[i] as CandidateRefreshProposal);
    } else {
      invalid.push({ index: i, errors: result.errors });
    }
  }
  return { valid, invalid };
}

export function parseDecisions(raw: unknown): ParseResult<CandidateRefreshDecision> {
  if (!Array.isArray(raw)) {
    return { valid: [], invalid: [{ index: -1, errors: ["decisions must be an array"] }] };
  }
  const valid: CandidateRefreshDecision[] = [];
  const invalid: Array<{ index: number; errors: string[] }> = [];
  for (let i = 0; i < raw.length; i++) {
    const result = validateDecision(raw[i]);
    if (result.valid) {
      valid.push(raw[i] as CandidateRefreshDecision);
    } else {
      invalid.push({ index: i, errors: result.errors });
    }
  }
  return { valid, invalid };
}

// ── AutoCandidateEntry 판별 ───────────────────────────────────────────────────

export function isAutoCandidate(
  entry: Record<string, unknown>
): entry is AutoCandidateEntry {
  return entry.source === "llm-candidate-refresh";
}
