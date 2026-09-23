import { z } from "zod";
import {
  postingCandidatePoolSchema,
  postingCandidateSchema,
} from "../contracts/posting-candidate.js";

const nonEmpty = z.string().trim().min(1);
const isoDateTime = z.iso.datetime();
const dateOnly = z.iso.date();
const httpsUrl = z.string().url().startsWith("https://");

export const analysisPolicySchema = z
  .object({
    schemaVersion: z.literal(2),
    candidateContextVersion: nonEmpty,
    dailyAnalysisLimit: z.number().int().min(1).max(20),
    prioritySlots: z.number().int().min(0).max(20),
    agingSlots: z.number().int().min(0).max(20),
    staleAfterDays: z.number().int().min(1).max(365),
    defaultCompanyTier: z.number().int().min(1).max(3),
    dailyCompanyTierLimit: z.number().int().min(1).max(20),
    companyTierStaleAfterDays: z.number().int().min(1).max(365),
  })
  .strict()
  .superRefine((policy, context) => {
    if (policy.prioritySlots + policy.agingSlots !== policy.dailyAnalysisLimit) {
      context.addIssue({
        code: "custom",
        path: ["prioritySlots"],
        message: "우선 슬롯과 보장 슬롯 합계가 일일 상한과 같아야 합니다.",
      });
    }
  });

export const companyPreferenceSchema = z
  .object({
    companyKey: nonEmpty,
    companyName: nonEmpty,
    tier: z.number().int().min(1).max(3),
    disposition: z.enum(["analyze", "exclude"]),
    updatedAt: isoDateTime,
  })
  .strict();

export const recommendationDetailSchema = z
  .object({
    title: nonEmpty.optional(),
    content: nonEmpty,
    evidenceUrls: z.array(z.string().url().startsWith("https://")).default([]),
    assumptions: z.array(nonEmpty).default([]),
  })
  .strict();

export const scoreBreakdownSchema = z
  .object({
    roleFit: z.number().int().min(0).max(40),
    scopeUpside: z.number().int().min(0).max(25),
    companyOpportunity: z.number().int().min(0).max(20),
    constraints: z.number().int().min(0).max(15),
  })
  .strict();

export const analysisUpdateSchema = z
  .object({
    positionId: nonEmpty,
    decision: z.enum(["recommend", "consider", "hold"]),
    fitScore: z.number().int().min(0).max(100),
    scoreBreakdown: scoreBreakdownSchema,
    reason: nonEmpty,
    details: z.array(recommendationDetailSchema).default([]),
    nextActions: z.array(nonEmpty).default([]),
  })
  .strict()
  .superRefine((analysis, context) => {
    const sum = Object.values(analysis.scoreBreakdown).reduce((total, value) => total + value, 0);
    if (sum !== analysis.fitScore) {
      context.addIssue({
        code: "custom",
        path: ["fitScore"],
        message: "점수 합계가 맞지 않습니다.",
      });
    }
  });

export const collectionRequestSchema = z
  .object({
    schemaVersion: z.literal(2),
    analysisContractVersion: z.number().int().positive(),
    companyTierContractVersion: z.number().int().positive().default(1),
    pool: postingCandidatePoolSchema,
  })
  .strict();

export const analysisFailureCodeSchema = z.enum([
  "posting_body_missing",
  "model_unavailable",
  "contract_rejected",
  "internal_error",
]);

export const analysisFailureSchema = z
  .object({
    positionId: nonEmpty,
    failureCode: analysisFailureCodeSchema,
  })
  .strict();

export const analysisResultsRequestSchema = z
  .object({
    schemaVersion: z.literal(2),
    collectionRunId: nonEmpty,
    results: z.array(analysisUpdateSchema).default([]),
    failures: z.array(analysisFailureSchema).default([]),
  })
  .strict();

export const analysisResultsResponseSchema = z
  .object({
    analysisRunId: nonEmpty,
    status: z.enum(["pending", "partial", "completed"]),
    createdCount: z.number().int().nonnegative(),
    reusedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    remainingCount: z.number().int().nonnegative(),
    applied: z.boolean(),
  })
  .strict();

export const recommendationRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    analysisRunId: nonEmpty,
  })
  .strict();

export const companyPreferenceUpdateSchema = companyPreferenceSchema.omit({ updatedAt: true });

export const analysisStatusSchema = z.enum(["fresh", "new", "changed", "stale"]);

export const analysisQueueCandidateSchema = z
  .object({
    positionId: nonEmpty,
    candidateId: nonEmpty,
    contentHash: nonEmpty,
    analysisStatus: z.enum(["new", "changed", "stale"]),
    companyTier: z.number().int().min(1).max(3),
    resultStatus: z.enum(["pending", "created", "reused", "failed"]),
    posting: postingCandidateSchema,
  })
  .strict();

export const analysisQueueSummarySchema = z
  .object({
    activeCount: z.number().int().nonnegative(),
    reusedCount: z.number().int().nonnegative(),
    queuedCount: z.number().int().nonnegative(),
    pendingCount: z.number().int().nonnegative(),
    personalExcludedCount: z.number().int().nonnegative(),
    newCount: z.number().int().nonnegative(),
    changedCount: z.number().int().nonnegative(),
    staleCount: z.number().int().nonnegative(),
    completedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    warningSourceCount: z.number().int().nonnegative(),
  })
  .strict();

export const analysisQueueResponseSchema = z
  .object({
    schemaVersion: z.literal(2),
    collectionRunId: nonEmpty,
    analysisRunId: nonEmpty,
    generatedAt: isoDateTime,
    candidates: z.array(analysisQueueCandidateSchema).max(20),
    summary: analysisQueueSummarySchema,
  })
  .strict();

export const companyTierAssessmentStatusSchema = z.enum(["new", "stale"]);

export const companyTierQueueCompanySchema = z
  .object({
    companyKey: nonEmpty,
    companyName: nonEmpty,
    assessmentStatus: companyTierAssessmentStatusSchema,
    activePositionCount: z.number().int().positive(),
    representativePostingUrls: z.array(httpsUrl).min(1).max(3),
    priorTier: z.number().int().min(1).max(3).nullable(),
    priorReason: nonEmpty.nullable(),
    priorValidUntil: dateOnly.nullable(),
  })
  .strict()
  .superRefine((company, context) => {
    const hasPrior =
      company.priorTier !== null ||
      company.priorReason !== null ||
      company.priorValidUntil !== null;
    if (company.assessmentStatus === "new" && hasPrior) {
      context.addIssue({
        code: "custom",
        path: ["priorTier"],
        message: "첫 평가 회사에는 이전 평가를 담지 않습니다.",
      });
    }
    if (company.assessmentStatus === "stale" && company.priorTier === null) {
      context.addIssue({
        code: "custom",
        path: ["priorTier"],
        message: "재평가 회사에는 만료된 이전 tier가 필요합니다.",
      });
    }
  });

export const companyTierQueueResponseSchema = z
  .object({
    schemaVersion: z.literal(1),
    collectionRunId: nonEmpty,
    companyTierRunId: nonEmpty,
    generatedAt: isoDateTime,
    status: z.enum(["pending", "partial", "completed"]),
    companies: z.array(companyTierQueueCompanySchema).max(20),
    summary: z
      .object({
        activeCompanyCount: z.number().int().nonnegative(),
        manualCount: z.number().int().nonnegative(),
        modelCount: z.number().int().nonnegative(),
        defaultCount: z.number().int().nonnegative(),
        queuedCount: z.number().int().nonnegative(),
        newCount: z.number().int().nonnegative(),
        staleCount: z.number().int().nonnegative(),
        completedCount: z.number().int().nonnegative(),
        failedCount: z.number().int().nonnegative(),
        pendingCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

/** 회사 tier 판정 이유의 길이 상한이다. 이 값이 공개 리포트에 그대로 실린다. */
export const companyTierReasonMaxLength = 200;

export const companyTierSignalAxisSchema = z.enum([
  "growth-scope",
  "compensation-upside",
  "team-growth",
]);

export const companyTierSignalSchema = z
  .object({
    axis: companyTierSignalAxisSchema,
    level: z.enum(["low", "medium", "high", "unknown"]),
  })
  .strict();

export const companyTierEvidenceSchema = z
  .object({
    url: httpsUrl,
    title: nonEmpty.optional(),
    publishedAt: dateOnly.optional(),
    checkedAt: dateOnly,
    validUntil: dateOnly.optional(),
  })
  .strict();

export const companyTierResultSchema = z
  .object({
    companyKey: nonEmpty,
    recommendedTier: z.number().int().min(1).max(3),
    confidence: z.enum(["low", "medium", "high"]),
    // 이 값이 공개 HTML 에 그대로 실리므로 들어오는 자리에서 길이를 막는다.
    reason: nonEmpty.max(companyTierReasonMaxLength),
    signals: z.array(companyTierSignalSchema).length(3),
    evidence: z.array(companyTierEvidenceSchema).min(1),
    assumptions: z.array(nonEmpty).default([]),
    validUntil: dateOnly.optional(),
  })
  .strict()
  .superRefine((result, context) => {
    const axes = result.signals.map((signal) => signal.axis);
    if (new Set(axes).size !== companyTierSignalAxisSchema.options.length) {
      context.addIssue({
        code: "custom",
        path: ["signals"],
        message: "성장 범위와 보상 상승과 팀 성장 신호가 한 번씩 필요합니다.",
      });
    }
  });

export const companyTierFailureCodeSchema = z.enum([
  "research_unavailable",
  "model_unavailable",
  "contract_rejected",
  "internal_error",
]);

export const companyTierFailureSchema = z
  .object({
    companyKey: nonEmpty,
    failureCode: companyTierFailureCodeSchema,
  })
  .strict();

export const companyTierResultsRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    collectionRunId: nonEmpty,
    results: z.array(companyTierResultSchema).default([]),
    failures: z.array(companyTierFailureSchema).default([]),
  })
  .strict();

export const companyTierResultsResponseSchema = z
  .object({
    companyTierRunId: nonEmpty,
    status: z.enum(["pending", "partial", "completed"]),
    createdCount: z.number().int().nonnegative(),
    reusedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    remainingCount: z.number().int().nonnegative(),
    applied: z.boolean(),
  })
  .strict();

export const companyTierSourceSchema = z.enum(["manual", "model", "default"]);

/** 추천과 대기 항목이 함께 담는 회사 tier 출처 필드다. 모델 평가일 때만 근거가 붙는다. */
export const companyTierProvenanceShape = {
  companyTierSource: companyTierSourceSchema,
  companyTierAssessmentId: nonEmpty.optional(),
  companyTierAssessedAt: isoDateTime.optional(),
  companyTierValidUntil: dateOnly.optional(),
  companyTierConfidence: z.enum(["low", "medium", "high"]).optional(),
  companyTierReason: nonEmpty.max(companyTierReasonMaxLength).optional(),
  companyTierEvidenceUrls: z.array(httpsUrl).max(3).default([]),
};

type CompanyTierProvenance = {
  companyTierSource: "manual" | "model" | "default";
  companyTierAssessmentId?: string;
  companyTierAssessedAt?: string;
  companyTierValidUntil?: string;
  companyTierConfidence?: "low" | "medium" | "high";
  companyTierReason?: string;
  companyTierEvidenceUrls: string[];
};

export function refineCompanyTierProvenance(
  value: CompanyTierProvenance,
  context: z.RefinementCtx,
): void {
  const modelOnly = [
    ["companyTierAssessmentId", value.companyTierAssessmentId],
    ["companyTierAssessedAt", value.companyTierAssessedAt],
    ["companyTierValidUntil", value.companyTierValidUntil],
    ["companyTierConfidence", value.companyTierConfidence],
    ["companyTierReason", value.companyTierReason],
  ] as const;
  if (value.companyTierSource === "model") {
    for (const [path, field] of modelOnly) {
      if (field === undefined) {
        context.addIssue({
          code: "custom",
          path: [path],
          message: "모델 평가 tier에는 평가 ID와 시각과 만료일과 신뢰도와 이유가 필요합니다.",
        });
      }
    }
    if (value.companyTierEvidenceUrls.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["companyTierEvidenceUrls"],
        message: "모델 평가 tier에는 근거 URL이 하나 이상 필요합니다.",
      });
    }
    return;
  }
  for (const [path, field] of modelOnly) {
    if (field !== undefined) {
      context.addIssue({
        code: "custom",
        path: [path],
        message: "사람 override와 기본 tier에는 모델 평가 정보를 담지 않습니다.",
      });
    }
  }
  if (value.companyTierEvidenceUrls.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["companyTierEvidenceUrls"],
      message: "사람 override와 기본 tier에는 모델 평가 정보를 담지 않습니다.",
    });
  }
}

export const companyTierRecommendationSummarySchema = z
  .object({
    manualCount: z.number().int().nonnegative(),
    modelCount: z.number().int().nonnegative(),
    defaultCount: z.number().int().nonnegative(),
    assessmentFailedCount: z.number().int().nonnegative(),
  })
  .strict();

export const positionPreparationResponseSchema = z
  .object({
    schemaVersion: z.literal(2),
    collectionRunId: nonEmpty,
    generatedAt: isoDateTime,
    companyTierQueue: companyTierQueueResponseSchema,
    summary: analysisQueueSummarySchema,
  })
  .strict();

const recommendationPositionSchema = z
  .object({
    candidateId: nonEmpty,
    company: nonEmpty,
    title: nonEmpty,
    postingUrl: z.string().url().startsWith("https://"),
    companyTier: z.number().int().min(1).max(3),
    ...companyTierProvenanceShape,
    decision: z.enum(["recommend", "consider", "hold"]),
    fitScore: z.number().int().min(0).max(100),
    reason: nonEmpty,
    details: z.array(recommendationDetailSchema),
    nextActions: z.array(nonEmpty),
  })
  .strict()
  .superRefine(refineCompanyTierProvenance);

export const recommendationResponseSchema = z
  .object({
    schemaVersion: z.literal(1),
    recommendationRunId: nonEmpty,
    analysisRunId: nonEmpty,
    reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    generatedAt: isoDateTime,
    sourceSnapshot: z.object({ collectionRunId: nonEmpty }).strict(),
    ranking: z.array(recommendationPositionSchema),
    recommendations: z.array(recommendationPositionSchema),
    pendingCandidates: z.array(
      z
        .object({
          candidateId: nonEmpty,
          company: nonEmpty,
          title: nonEmpty,
          postingUrl: z.string().url().startsWith("https://"),
          companyTier: z.number().int().min(1).max(3),
          ...companyTierProvenanceShape,
          analysisStatus: z.enum(["new", "changed", "stale"]),
        })
        .strict()
        .superRefine(refineCompanyTierProvenance),
    ),
    analysisSummary: z
      .object({
        activeCount: z.number().int().nonnegative(),
        analyzedNowCount: z.number().int().nonnegative(),
        reusedCount: z.number().int().nonnegative(),
        pendingCount: z.number().int().nonnegative(),
        personalExcludedCount: z.number().int().nonnegative(),
      })
      .strict(),
    companyTierSummary: companyTierRecommendationSummarySchema,
    collectionHealth: z
      .object({
        candidateCount: z.number().int().nonnegative(),
        configuredSourceCount: z.number().int().nonnegative(),
        warningSources: z.array(
          z
            .object({
              source: nonEmpty,
              status: z.enum(["partial", "failed"]),
              failedCount: z.number().int().nonnegative(),
              reason: nonEmpty,
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

/**
 * 개인 공고 제외 규칙의 계약이다.
 *
 * `scope` 마다 요구하는 칸이 다르다. `docs/data-schema.md` 의 「개인 공고 제외 설정」 이 정한다.
 * 수집기 쪽 `scripts/position-recommender/feedback/exclusions.ts` 와 같은 판정이어야 한다.
 */
const exclusionEvidenceShape = {
  decisionKind: z.enum(["career-downside", "manual"]),
  reason: nonEmpty,
  evidenceUrls: z.array(httpsUrl).min(1),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  decidedAt: dateOnly,
  expiresAt: dateOnly.optional(),
};

const postingExclusionSchema = z
  .object({
    scope: z.literal("posting"),
    source: nonEmpty,
    identityHash: nonEmpty.optional(),
    url: httpsUrl.optional(),
    ...exclusionEvidenceShape,
  })
  .strict();

const companyExclusionSchema = z
  .object({
    scope: z.literal("company"),
    company: nonEmpty,
    ...exclusionEvidenceShape,
  })
  .strict();

const companyRoleExclusionSchema = z
  .object({
    scope: z.literal("company-role"),
    company: nonEmpty,
    titleKeywords: z.array(nonEmpty).min(1),
    ...exclusionEvidenceShape,
  })
  .strict();

export const positionExclusionSchema = z
  .discriminatedUnion("scope", [
    postingExclusionSchema,
    companyExclusionSchema,
    companyRoleExclusionSchema,
  ])
  .superRefine((rule, context) => {
    if (rule.scope === "posting" && !rule.identityHash && !rule.url) {
      context.addIssue({
        code: "custom",
        path: ["identityHash"],
        message: "공고 제외에는 identityHash나 url 중 하나가 필요합니다.",
      });
    }
    if (
      rule.decisionKind === "career-downside" &&
      rule.scope === "company" &&
      rule.evidenceUrls.length < 2
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidenceUrls"],
        message: "회사 전체 제외에는 공개 근거 URL이 두 개 이상 필요합니다.",
      });
    }
  });

export const exclusionsRequestSchema = z
  .object({
    schemaVersion: z.literal(2),
    exclusions: z.array(positionExclusionSchema),
  })
  .strict();

export type PositionExclusion = z.infer<typeof positionExclusionSchema>;
export type ExclusionsRequest = z.infer<typeof exclusionsRequestSchema>;

export type AnalysisPolicy = z.infer<typeof analysisPolicySchema>;
export type CompanyPreference = z.infer<typeof companyPreferenceSchema>;
export type AnalysisUpdate = z.infer<typeof analysisUpdateSchema>;
export type CollectionRequest = z.infer<typeof collectionRequestSchema>;
export type AnalysisResultsRequest = z.infer<typeof analysisResultsRequestSchema>;
export type AnalysisResultsResponse = z.infer<typeof analysisResultsResponseSchema>;
export type AnalysisFailure = z.infer<typeof analysisFailureSchema>;
export type AnalysisFailureCode = z.infer<typeof analysisFailureCodeSchema>;
export type AnalysisQueueResponse = z.infer<typeof analysisQueueResponseSchema>;
export type CompanyTierQueueResponse = z.infer<typeof companyTierQueueResponseSchema>;
export type CompanyTierResult = z.infer<typeof companyTierResultSchema>;
export type CompanyTierFailure = z.infer<typeof companyTierFailureSchema>;
export type CompanyTierReportedFailureCode = z.infer<typeof companyTierFailureCodeSchema>;
export type CompanyTierResultsRequest = z.infer<typeof companyTierResultsRequestSchema>;
export type CompanyTierResultsResponse = z.infer<typeof companyTierResultsResponseSchema>;
export type PositionPreparationResponse = z.infer<typeof positionPreparationResponseSchema>;
export type CompanyTierRecommendationSummary = z.infer<
  typeof companyTierRecommendationSummarySchema
>;
export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>;
