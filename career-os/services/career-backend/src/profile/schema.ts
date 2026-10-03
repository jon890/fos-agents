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
