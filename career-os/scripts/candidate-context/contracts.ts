import { z } from "zod";

/** Backend `candidate-context/schema.ts` 와 같은 문서 키 넷이다. ADR-131 을 따른다. */
export const candidateContextDocumentKeys = [
  "learning-interests",
  "position-preferences",
  "application-state",
  "career-status",
] as const;
export const candidateContextDocumentKeySchema = z.enum(candidateContextDocumentKeys);
export type CandidateContextDocumentKey = z.infer<typeof candidateContextDocumentKeySchema>;

const maxBodyBytes = 65_536;

export const candidateContextPutPayloadSchema = z.object({
  body: z.string()
    .refine((value) => value.trim().length > 0, "본문이 비어 있다.")
    .refine((value) => Buffer.byteLength(value, "utf8") <= maxBodyBytes, "본문은 UTF-8 64 KiB 이하여야 한다."),
  note: z.string().trim().min(1).max(500),
  expectedVersion: z.number().int().nonnegative(),
});
export type CandidateContextPutPayload = z.infer<typeof candidateContextPutPayloadSchema>;

const documentSummarySchema = z.object({
  documentKey: candidateContextDocumentKeySchema,
  version: z.number().int().nonnegative(),
  updatedAt: z.string().min(1),
});

export const candidateContextDocumentSchema = documentSummarySchema.extend({
  body: z.string(),
  note: z.string(),
});

export const candidateContextListResponseSchema = z.object({ documents: z.array(documentSummarySchema) });
export const candidateContextGetResponseSchema = z.object({ document: candidateContextDocumentSchema });
/** `PUT` 응답에는 본문과 note 가 없다. 멱등 영수증에 개인 맥락이 남지 않게 하려는 Backend 결정이다. */
export const candidateContextPutResponseSchema = z.object({ document: documentSummarySchema });

export type CandidateContextDocument = z.infer<typeof candidateContextDocumentSchema>;
export type CandidateContextListResponse = z.infer<typeof candidateContextListResponseSchema>;
export type CandidateContextPutResponse = z.infer<typeof candidateContextPutResponseSchema>;
