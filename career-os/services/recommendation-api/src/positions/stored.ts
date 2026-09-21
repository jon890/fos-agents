/**
 * 질의 결과를 담는 저장 형태다.
 *
 * `queue.ts` 와 `tier-provenance.ts` 가 순수 함수라 저장소를 알지 못하므로
 * 두 모듈이 함께 쓰는 형태만 여기 둔다.
 */

export type CompanyTierSource = "manual" | "model" | "default";

export type CompanyTierFailureCode =
  | "research_unavailable"
  | "model_unavailable"
  | "contract_rejected"
  | "internal_error"
  | "lease_expired";

/** `company_tier_assessments` 한 행. `evidence` 는 저장한 JSON 을 그대로 담는다. */
export type StoredCompanyTierAssessment = {
  companyTierAssessmentId: string;
  companyKey: string;
  companyName: string;
  candidateContextVersion: string;
  contractVersion: number;
  createdByCompanyTierRunId: string | null;
  recommendedTier: number;
  confidence: "low" | "medium" | "high";
  reason: string;
  signals: Record<string, unknown>;
  evidence: unknown[];
  assumptions: string[];
  assessedAt: string;
  validUntil: string;
};
