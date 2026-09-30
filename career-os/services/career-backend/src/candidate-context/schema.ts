import { z } from "zod";

/** 문서 키는 넷으로 고정한다. migration 의 `CHECK` 제약과 같은 목록이다. ADR-131 을 따른다. */
export const candidateContextDocumentKeys = [
  "learning-interests",
  "position-preferences",
  "application-state",
  "career-status",
] as const;
export const candidateContextDocumentKeySchema = z.enum(candidateContextDocumentKeys);
export type CandidateContextDocumentKey = z.infer<typeof candidateContextDocumentKeySchema>;

/** 본문 상한. DB 칸은 `MEDIUMTEXT` 지만 서버는 UTF-8 64 KiB 까지만 받는다. */
const maxBodyBytes = 65_536;

export const candidateContextDocumentPutSchema = z.object({
  body: z.string()
    .refine((value) => value.trim().length > 0, "본문이 비어 있습니다.")
    .refine((value) => Buffer.byteLength(value, "utf8") <= maxBodyBytes, "본문은 UTF-8 64 KiB 이하여야 합니다."),
  note: z.string().trim().min(1).max(500),
  expectedVersion: z.number().int().nonnegative(),
}).strict();
export type CandidateContextDocumentPut = z.infer<typeof candidateContextDocumentPutSchema>;

export type CandidateContextDocument = {
  documentKey: CandidateContextDocumentKey;
  body: string;
  version: number;
  note: string;
  /** UTC ISO 문자열. */
  updatedAt: string;
};
export type CandidateContextDocumentSummary = Omit<CandidateContextDocument, "body" | "note">;

/**
 * `PUT` 응답. 본문과 note 를 담지 않는다.
 *
 * 전역 멱등 인터셉터가 응답 본문을 `request_receipts` 에 저장하므로,
 * 본문을 담으면 개인 맥락의 사본이 그 table 에 남는다. 본문은 `GET` 으로만 읽는다.
 */
export type CandidateContextDocumentPutResponse = { document: CandidateContextDocumentSummary };
