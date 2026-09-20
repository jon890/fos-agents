import { z } from "zod";
import {
  postingCandidatePoolSchema,
  postingCandidateSchema,
} from "../../../scripts/position-recommender/live-postings/contracts.ts";

const nonEmpty = z.string().trim().min(1);
const isoDateTime = z.iso.datetime();

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

export const analysisQueueResponseSchema = z
  .object({
    schemaVersion: z.literal(2),
    collectionRunId: nonEmpty,
    analysisRunId: nonEmpty,
    generatedAt: isoDateTime,
    candidates: z.array(analysisQueueCandidateSchema).max(20),
    summary: z
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
      .strict(),
  })
  .strict();

const recommendationPositionSchema = z
  .object({
    candidateId: nonEmpty,
    company: nonEmpty,
    title: nonEmpty,
    postingUrl: z.string().url().startsWith("https://"),
    companyTier: z.number().int().min(1).max(3),
    decision: z.enum(["recommend", "consider", "hold"]),
    fitScore: z.number().int().min(0).max(100),
    reason: nonEmpty,
    details: z.array(recommendationDetailSchema),
    nextActions: z.array(nonEmpty),
  })
  .strict();

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
          analysisStatus: z.enum(["new", "changed", "stale"]),
        })
        .strict(),
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

export type AnalysisPolicy = z.infer<typeof analysisPolicySchema>;
export type CompanyPreference = z.infer<typeof companyPreferenceSchema>;
export type AnalysisUpdate = z.infer<typeof analysisUpdateSchema>;
export type CollectionRequest = z.infer<typeof collectionRequestSchema>;
export type AnalysisResultsRequest = z.infer<typeof analysisResultsRequestSchema>;
export type AnalysisResultsResponse = z.infer<typeof analysisResultsResponseSchema>;
export type AnalysisFailure = z.infer<typeof analysisFailureSchema>;
export type AnalysisFailureCode = z.infer<typeof analysisFailureCodeSchema>;
export type AnalysisQueueResponse = z.infer<typeof analysisQueueResponseSchema>;
export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>;
