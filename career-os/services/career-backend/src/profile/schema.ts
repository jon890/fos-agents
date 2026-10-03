import { z } from "zod";

/** 문서 키는 셋으로 고정한다. migration 의 `CHECK` 제약과 같은 목록이다. ADR-133 을 따른다. */
export const profileDocumentKeys = ["wanted", "linkedin", "github"] as const;
export const profileDocumentKeySchema = z.enum(profileDocumentKeys);
export type ProfileDocumentKey = z.infer<typeof profileDocumentKeySchema>;

/** 본문 상한. DB 칸은 `MEDIUMTEXT` 지만 서버는 UTF-8 64 KiB 까지만 받는다. */
const maxBodyBytes = 65_536;

export const profileDocumentPutSchema = z.object({
  body: z.string()
    .refine((value) => value.trim().length > 0, "본문이 비어 있습니다.")
    .refine((value) => Buffer.byteLength(value, "utf8") <= maxBodyBytes, "본문은 UTF-8 64 KiB 이하여야 합니다."),
  note: z.string().trim().min(1).max(500),
  expectedVersion: z.number().int().nonnegative(),
}).strict();
export type ProfileDocumentPut = z.infer<typeof profileDocumentPutSchema>;

export type ProfileDocument = {
  documentKey: ProfileDocumentKey;
  body: string;
  version: number;
  note: string;
  /** UTC ISO 문자열. */
  updatedAt: string;
};
export type ProfileDocumentSummary = Omit<ProfileDocument, "body" | "note">;

/**
 * `PUT` 응답. 본문과 note 를 담지 않는다.
 *
 * 전역 멱등 인터셉터가 응답 본문을 `request_receipts` 에 저장하므로,
 * 본문을 담으면 프로필 원고의 사본이 그 table 에 남는다. 본문은 `GET` 으로만 읽는다.
 */
export type ProfileDocumentPutResponse = { document: ProfileDocumentSummary };

export const usageSnapshotSources = ["MEASURED", "BACKFILLED"] as const;

const tokenCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
/**
 * 환산 비용. DB 칸은 `DECIMAL(12,2)` 다.
 *
 * 소수 둘째 자리 검사를 `v * 100` 이 정수인지로 하면 `0.07 * 100` 이 `7.000000000000001` 이라
 * 정상 값을 거절한다. zod 의 `multipleOf` 는 이 오차를 감안해 판정한다.
 */
const costUsd = z.number().nonnegative().max(9_999_999_999.99).multipleOf(0.01).nullable().optional();

export const usageSnapshotPutSchema = z.object({
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
}).strict().refine((value) => value.replace !== true || value.note !== undefined, {
  message: "기록을 바꿀 때는 note 에 사유를 적어야 합니다.",
  path: ["note"],
});
export type UsageSnapshotPut = z.infer<typeof usageSnapshotPutSchema>;

export type UsageSnapshot = {
  month: string;
  claudeTokens: number;
  codexTokens: number;
  claudeCostUsd: number | null;
  codexCostUsd: number | null;
  sessions: number | null;
  unpricedTokens: number;
  /** `YYYY-MM-DD`. */
  measuredOn: string;
  source: (typeof usageSnapshotSources)[number];
  note: string | null;
  /** UTC ISO 문자열. */
  createdAt: string;
  /** UTC ISO 문자열. */
  updatedAt: string;
};

/** `created` 가 거짓이면 `snapshot` 은 요청 값이 아니라 저장돼 있던 값이다. */
export type UsageSnapshotPutResponse = { snapshot: UsageSnapshot; created: boolean };
