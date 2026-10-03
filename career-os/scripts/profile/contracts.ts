import { z } from "zod";

/** Backend `profile/schema.ts` 와 같은 문서 키 셋이다. ADR-133 을 따른다. */
export const profileDocumentKeys = ["wanted", "linkedin", "github"] as const;
export const profileDocumentKeySchema = z.enum(profileDocumentKeys);
export type ProfileDocumentKey = z.infer<typeof profileDocumentKeySchema>;

const maxBodyBytes = 65_536;

export const profileDocumentPutPayloadSchema = z.object({
  body: z.string()
    .refine((value) => value.trim().length > 0, "본문이 비어 있다.")
    .refine((value) => Buffer.byteLength(value, "utf8") <= maxBodyBytes, "본문은 UTF-8 64 KiB 이하여야 한다."),
  note: z.string().trim().min(1).max(500),
  expectedVersion: z.number().int().nonnegative(),
});
export type ProfileDocumentPutPayload = z.infer<typeof profileDocumentPutPayloadSchema>;

const documentSummarySchema = z.object({
  documentKey: profileDocumentKeySchema,
  version: z.number().int().nonnegative(),
  updatedAt: z.string().min(1),
});

export const profileDocumentSchema = documentSummarySchema.extend({
  body: z.string(),
  note: z.string(),
});
export const profileDocumentListResponseSchema = z.object({ documents: z.array(documentSummarySchema) });
export const profileDocumentGetResponseSchema = z.object({ document: profileDocumentSchema });
/** `PUT` 응답에는 본문과 note 가 없다. 멱등 영수증에 원고 사본이 남지 않게 하려는 Backend 결정이다. */
export const profileDocumentPutResponseSchema = z.object({ document: documentSummarySchema });

export type ProfileDocument = z.infer<typeof profileDocumentSchema>;
export type ProfileDocumentListResponse = z.infer<typeof profileDocumentListResponseSchema>;
export type ProfileDocumentPutResponse = z.infer<typeof profileDocumentPutResponseSchema>;

export const usageSnapshotSources = ["MEASURED", "BACKFILLED"] as const;
export const usageMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "달은 YYYY-MM 이어야 한다.");

const tokenCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
/** 소수 둘째 자리 검사를 곱셈으로 하면 `0.07 * 100` 이 `7.000000000000001` 이라 정상 값을 거절한다. `multipleOf` 는 이 오차를 감안한다. */
const costUsd = z.number().nonnegative().max(9_999_999_999.99).multipleOf(0.01).nullable().optional();

export const usageSnapshotPutPayloadSchema = z.object({
  claudeTokens: tokenCount,
  codexTokens: tokenCount,
  claudeCostUsd: costUsd,
  codexCostUsd: costUsd,
  sessions: z.number().int().nonnegative().max(4_294_967_295).nullable().optional(),
  unpricedTokens: tokenCount,
  measuredOn: z.iso.date(),
  source: z.enum(usageSnapshotSources),
  note: z.string().trim().min(1).max(500).optional(),
  replace: z.boolean().optional(),
}).refine((value) => value.replace !== true || value.note !== undefined, {
  message: "기록을 바꿀 때는 note 에 사유를 적어야 한다.",
  path: ["note"],
});
export type UsageSnapshotPutPayload = z.infer<typeof usageSnapshotPutPayloadSchema>;

export const usageSnapshotSchema = z.object({
  month: usageMonthSchema,
  claudeTokens: z.number(),
  codexTokens: z.number(),
  claudeCostUsd: z.number().nullable(),
  codexCostUsd: z.number().nullable(),
  sessions: z.number().nullable(),
  unpricedTokens: z.number(),
  measuredOn: z.string(),
  source: z.enum(usageSnapshotSources),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UsageSnapshot = z.infer<typeof usageSnapshotSchema>;

export const usageSnapshotListResponseSchema = z.object({ snapshots: z.array(usageSnapshotSchema) });
/** `created` 가 거짓이면 `snapshot` 은 요청 값이 아니라 저장돼 있던 값이다. */
export const usageSnapshotPutResponseSchema = z.object({ snapshot: usageSnapshotSchema, created: z.boolean() });
export type UsageSnapshotPutResponse = z.infer<typeof usageSnapshotPutResponseSchema>;
