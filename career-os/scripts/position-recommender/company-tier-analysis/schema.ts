import { z } from "zod";
import {
  companyTierFailureSchema,
  companyTierQueueResponseSchema,
  companyTierResultSchema,
} from "../../../services/recommendation-api/src/positions/schema.ts";

/** API가 돌려준 `company-tier-queue.json` 계약이다. Backend 응답을 그대로 저장한다. */
export const companyTierQueueFileSchema = companyTierQueueResponseSchema;

export type CompanyTierQueueFile = z.infer<typeof companyTierQueueFileSchema>;

/** 모델이 만드는 `company-tier-updates.json` 계약이다. */
export const companyTierUpdatesInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    collectionRunId: z.string().min(1),
    companyTierRunId: z.string().min(1),
    results: z.array(companyTierResultSchema).default([]),
    failures: z.array(companyTierFailureSchema).default([]),
  })
  .strict();

export type CompanyTierUpdatesInput = z.infer<typeof companyTierUpdatesInputSchema>;
