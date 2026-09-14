// 추천 판단을 HTML로 전달하기 위한 최소 데이터 계약이다.
// 후보의 진위와 원문 일치 여부만 코드가 검사하고, 추천 분류와 근거 구성은 모델이 정한다.
import { z } from "zod";

export const RecommendationDetail = z
  .object({
    title: z.string().trim().min(1).optional(),
    content: z.string().trim().min(1),
    evidenceUrls: z.array(z.string().url().startsWith("https://")).default([]),
    assumptions: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

export const RecommendationItem = z
  .object({
    candidateId: z.string().trim().min(1),
    company: z.string().trim().min(1),
    title: z.string().trim().min(1),
    postingUrl: z.string().url().startsWith("https://"),
    label: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(1),
    details: z.array(RecommendationDetail).default([]),
    nextActions: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

export const RecommendationRun = z
  .object({
    schemaVersion: z.literal(8),
    reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    generatedAt: z.string().min(1),
    summary: z.array(z.string().trim().min(1)).default([]),
    recommendations: z.array(RecommendationItem),
    nextActions: z.array(z.string().trim().min(1)).default([]),
    sourceSnapshot: z
      .object({
        collectionRunId: z.string().min(1),
      })
      .strict(),
  })
  .strict()
  .superRefine((run, ctx) => {
    const selectedIds = new Set<string>();
    run.recommendations.forEach((item, index) => {
      if (selectedIds.has(item.candidateId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recommendations", index, "candidateId"],
          message: `추천 공고 ID가 중복됐다: ${item.candidateId}`,
        });
      }
      selectedIds.add(item.candidateId);
    });
  });

export type RecommendationRunType = z.infer<typeof RecommendationRun>;
export type RecommendationItemType = z.infer<typeof RecommendationItem>;
