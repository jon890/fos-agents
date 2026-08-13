import { z } from "zod";

const positionCollectionConfigSchema = z.object({
  wanted: z.object({
    jobGroupId: z.number().int().positive(),
  }).strict(),
}).strict();

/**
 * 외부 채용 소스의 탐색 범위만 관리한다.
 * 후보자 경력, 선호 회사, 관심 기술은 추천 단계에서 판단한다.
 */
export const positionCollectionConfig = positionCollectionConfigSchema.parse({
  wanted: {
    jobGroupId: 518,
  },
});

export type PositionCollectionConfig = z.infer<typeof positionCollectionConfigSchema>;
