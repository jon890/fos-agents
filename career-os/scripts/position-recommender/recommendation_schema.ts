// position-recommender 추천 결과의 기준 스키마.
// 에이전트가 이 스키마에 맞는 recommendation.json을 생성하면,
// 렌더러가 여기서 HTML / Markdown / Discord 카드용 데이터를 파생한다.
// SKILL self-check는 이 스키마 검증으로 대체한다.
import { z } from "zod";
import { sourceIdSchema } from "./live-postings/contracts.ts";

/** 회사/규모 업사이드 신호. HTML 배지와 요약 필드로 직접 매핑된다. */
export const UpsideLevel = z.enum(["강함", "중간", "약함"]);

/** 링크 근거 수준. 추천 티어에는 active/open 확인만 허용한다(SKILL self-check 9). */
export const LinkEvidenceLevel = z.enum([
  "개별 공고 active 확인",
  "개별 공고 open 확인",
]);

export const CompanyUpside = z.object({
  level: UpsideLevel,
  reason: z.string().min(1),
});

/** 강력/도전 추천 포지션 1건. SKILL 14개 라벨을 손실 없이 담는다. */
export const PositionItem = z.object({
  candidateId: z.string().min(1),
  rank: z.number().int().positive(),
  company: z.string().min(1),
  title: z.string().min(1),
  postingUrl: z.string().url(), // 개별 공고 URL 필수 (탐색 링크 불가)
  exploreLink: z.string().default("-"), // 추천 티어에서는 항상 "-"
  linkEvidenceLevel: LinkEvidenceLevel,
  postingPeriod: z.string().min(1), // closes_at / days_until_close / urgency
  source: sourceIdSchema,
  closeDate: z.string().nullable(), // 기계 적재용 마감일 문자열 또는 null (사람용 자유문자열 postingPeriod와 별도)
  searchKeywords: z.array(z.string().min(1)).min(1),
  whyFit: z.string().min(1),
  candidateEvidence: z.array(z.string().min(1)).min(1),
  jdKeywords: z.array(z.string().min(1)).min(1),
  companyUpside: CompanyUpside,
  welfareLearning: z.string().min(1),
  techBlogSignal: z.string().min(1),
  businessRisk: z.string().min(1),
  ambiguity: z.string().min(1),
  prepAction: z.string().min(1),
  stretchGap: z.string().optional(), // 도전 추천만 채운다
});

/** 보류·주의 포지션. 사유만 담는 경량 항목. */
export const HoldItem = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  link: z.string().default("-"),
  reason: z.string().min(1),
});

/** 추가 수집 대상. 개별 active URL 미확보 회사 — 다음 수집 범위 결정용. */
export const AdditionalTarget = z.object({
  company: z.string().min(1),
  exploreLink: z.string().min(1),
  reason: z.string().min(1),
  nextCollectionPoint: z.string().min(1),
});

export const WeeklyActions = z.object({
  apply: z.string().min(1),
  resume: z.string().min(1),
  study: z.string().min(1),
});

export const CandidateRankingItem = z.object({
  candidateId: z.string().min(1),
  rank: z.number().int().positive(),
  oneLineReason: z.string().trim().min(1).max(160).refine((value) => !/[\r\n]/.test(value), {
    message: "한 줄 판단에는 줄바꿈을 넣지 않는다",
  }),
});

export const RecommendationRun = z
  .object({
    schemaVersion: z.literal(4),
    reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Asia/Seoul 기준
    generatedAt: z.string().min(1),
    conclusion: z.array(z.string().min(1)).min(1), // 한 줄 결론 (첫 10줄 결론 보장)
    background: z.array(z.string().min(1)).min(1), // 추천 배경 요약
    tiers: z.object({
      strong: z.array(PositionItem).max(3),
      stretch: z.array(PositionItem).max(2),
      hold: z.array(HoldItem).max(3),
    }),
    candidateRanking: z.array(CandidateRankingItem).min(1),
    additionalTargets: z.array(AdditionalTarget).max(3),
    recentCheck: z.array(z.string().min(1)).min(1), // 최근 반복 점검
    weeklyActions: WeeklyActions,
    sourceSnapshot: z.object({
      collectionRunId: z.string().min(1),
      candidatePoolPath: z.string().min(1),
    }),
  })
  .superRefine((run, ctx) => {
    const rankedIds = new Set<string>();
    const ranks = new Set<number>();
    run.candidateRanking.forEach((item, index) => {
      if (rankedIds.has(item.candidateId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["candidateRanking", index, "candidateId"],
          message: `전체 후보 순위에 중복 공고 ID가 있다: ${item.candidateId}`,
        });
      }
      if (ranks.has(item.rank)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["candidateRanking", index, "rank"],
          message: `전체 후보 순위에 중복 순위가 있다: ${item.rank}`,
        });
      }
      rankedIds.add(item.candidateId);
      ranks.add(item.rank);
    });
    // 강력 추천에는 stretchGap을 쓰지 않는다 (도전 전용 필드).
    run.tiers.strong.forEach((item, i) => {
      if (item.stretchGap !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tiers", "strong", i, "stretchGap"],
          message: "강력 추천 항목에는 stretchGap을 두지 않는다",
        });
      }
    });
    // 도전 추천에는 stretchGap이 반드시 있어야 한다 (준비 격차를 분명히 하기 위함).
    run.tiers.stretch.forEach((item, i) => {
      if (!item.stretchGap || !item.stretchGap.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tiers", "stretch", i, "stretchGap"],
          message: "도전 추천 항목에는 stretchGap이 필수다",
        });
      }
    });
    // 추천 티어 항목의 exploreLink는 "-"여야 한다 (개별 공고 URL만 허용).
    [...run.tiers.strong, ...run.tiers.stretch].forEach((item) => {
      if (item.exploreLink !== "-") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tiers"],
          message: `추천 티어(${item.company})는 탐색 링크가 아닌 개별 공고 URL만 허용한다`,
        });
      }
    });
  });

export type RecommendationRunType = z.infer<typeof RecommendationRun>;
export type PositionItemType = z.infer<typeof PositionItem>;
export type CandidateRankingItemType = z.infer<typeof CandidateRankingItem>;
