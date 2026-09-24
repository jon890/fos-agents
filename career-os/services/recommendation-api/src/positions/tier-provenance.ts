import type { CompanyTierSource, StoredCompanyTierAssessment } from "./stored.js";
import { companyTierEvidenceSchema } from "./schema.js";

/** 추천 응답이 공고마다 담는 회사 tier 출처다. 모델 평가일 때만 근거가 붙는다. */
export type CompanyTierProvenanceFields = {
  companyTierSource: CompanyTierSource;
  companyTierAssessmentId?: string;
  companyTierAssessedAt?: string;
  companyTierValidUntil?: string;
  companyTierConfidence?: "low" | "medium" | "high";
  companyTierReason?: string;
  companyTierEvidenceUrls: string[];
};

function evidenceUrls(assessment: StoredCompanyTierAssessment): string[] {
  return assessment.evidence
    .map((entry) => companyTierEvidenceSchema.safeParse(entry))
    .flatMap((parsed) => (parsed.success ? [parsed.data.url] : []))
    .slice(0, 3);
}

export function companyTierProvenanceFields(
  source: CompanyTierSource,
  assessment: StoredCompanyTierAssessment | undefined,
): CompanyTierProvenanceFields {
  if (source !== "model" || !assessment) {
    return { companyTierSource: source, companyTierEvidenceUrls: [] };
  }
  return {
    companyTierSource: "model",
    companyTierAssessmentId: assessment.companyTierAssessmentId,
    companyTierAssessedAt: assessment.assessedAt,
    companyTierValidUntil: assessment.validUntil,
    ...(assessment.confidence === null ? {} : { companyTierConfidence: assessment.confidence }),
    companyTierReason: assessment.reason,
    companyTierEvidenceUrls: evidenceUrls(assessment),
  };
}
