import { z } from "zod";
import {
  companyTierProvenanceShape,
  refineCompanyTierProvenance,
} from "../../../services/recommendation-api/position/schema.ts";

const nonEmpty = z.string().trim().min(1);
const postingUrl = z.string().url().startsWith("https://");

export const RecommendationDetail = z
  .object({
    title: nonEmpty.optional(),
    content: nonEmpty,
    evidenceUrls: z.array(postingUrl).default([]),
    assumptions: z.array(nonEmpty).default([]),
  })
  .strict();

const CandidateIdentity = z
  .object({
    candidateId: nonEmpty,
    company: nonEmpty,
    title: nonEmpty,
    postingUrl,
    companyTier: z.number().int().min(1).max(3),
    ...companyTierProvenanceShape,
  })
  .strict();

const RankedCandidateShape = CandidateIdentity.extend({
  decision: z.enum(["recommend", "consider", "hold"]),
  fitScore: z.number().int().min(0).max(100),
  reason: nonEmpty,
  details: z.array(RecommendationDetail).default([]),
  nextActions: z.array(nonEmpty).default([]),
  note: nonEmpty.optional(),
}).strict();

export const RankedCandidate = RankedCandidateShape.superRefine(refineCompanyTierProvenance);

const RecommendationItemShape = RankedCandidateShape.extend({
  label: nonEmpty.optional(),
}).strict();

export const RecommendationItem = RecommendationItemShape.superRefine(refineCompanyTierProvenance);

const PendingCandidateShape = CandidateIdentity.extend({
  analysisStatus: z.enum(["new", "changed", "stale"]),
}).strict();

export const PendingCandidate = PendingCandidateShape.superRefine(refineCompanyTierProvenance);

export const WarningSource = z
  .object({
    source: nonEmpty,
    status: z.enum(["partial", "failed"]),
    failedCount: z.number().int().nonnegative(),
    reason: nonEmpty,
  })
  .strict();

export const CompanyTierSummary = z
  .object({
    manualCount: z.number().int().nonnegative(),
    modelCount: z.number().int().nonnegative(),
    defaultCount: z.number().int().nonnegative(),
    assessmentFailedCount: z.number().int().nonnegative(),
  })
  .strict();

export const RecommendationRun = z
  .object({
    schemaVersion: z.literal(11),
    reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    generatedAt: z.string().min(1),
    summary: z.array(nonEmpty).default([]),
    recommendations: z.array(RecommendationItem),
    ranking: z.array(RankedCandidate),
    pendingCandidates: z.array(PendingCandidate),
    analysisSummary: z
      .object({
        activeCount: z.number().int().nonnegative(),
        analyzedNowCount: z.number().int().nonnegative(),
        reusedCount: z.number().int().nonnegative(),
        pendingCount: z.number().int().nonnegative(),
        personalExcludedCount: z.number().int().nonnegative(),
      })
      .strict(),
    companyTierSummary: CompanyTierSummary,
    collectionHealth: z
      .object({
        candidateCount: z.number().int().nonnegative(),
        configuredSourceCount: z.number().int().nonnegative(),
        warningSources: z.array(WarningSource),
      })
      .strict(),
    nextActions: z.array(nonEmpty).default([]),
    sourceSnapshot: z.object({ collectionRunId: nonEmpty }).strict(),
  })
  .strict()
  .superRefine((run, context) => {
    const rankedIds = run.ranking.map((item) => item.candidateId);
    const pendingIds = run.pendingCandidates.map((item) => item.candidateId);
    const allIds = [...rankedIds, ...pendingIds];
    if (new Set(allIds).size !== allIds.length) {
      context.addIssue({
        code: "custom",
        path: ["ranking"],
        message: "분석 순위와 대기 목록에 중복 공고가 있습니다.",
      });
    }
    if (allIds.length !== run.analysisSummary.activeCount) {
      context.addIssue({
        code: "custom",
        path: ["analysisSummary", "activeCount"],
        message: "활성 공고 집계가 순위와 대기 목록 합계와 다릅니다.",
      });
    }
    if (pendingIds.length !== run.analysisSummary.pendingCount) {
      context.addIssue({
        code: "custom",
        path: ["analysisSummary", "pendingCount"],
        message: "대기 공고 집계가 목록과 다릅니다.",
      });
    }
    if (
      rankedIds.length !==
      run.analysisSummary.analyzedNowCount + run.analysisSummary.reusedCount
    ) {
      context.addIssue({
        code: "custom",
        path: ["analysisSummary", "reusedCount"],
        message: "분석 집계가 순위 공고 수와 다릅니다.",
      });
    }
    const recommendationIds = run.recommendations.map((item) => item.candidateId);
    if (new Set(recommendationIds).size !== recommendationIds.length) {
      context.addIssue({
        code: "custom",
        path: ["recommendations"],
        message: "추천 공고가 중복됐습니다.",
      });
    }
    recommendationIds.forEach((id, index) => {
      if (rankedIds[index] !== id) {
        context.addIssue({
          code: "custom",
          path: ["recommendations", index],
          message: "상세 추천이 분석 순위 앞부분과 다릅니다.",
        });
      }
    });
  });

export type RecommendationRunType = z.infer<typeof RecommendationRun>;
export type RecommendationItemType = z.infer<typeof RecommendationItem>;
export type RankedCandidateType = z.infer<typeof RankedCandidate>;
export type PendingCandidateType = z.infer<typeof PendingCandidate>;
