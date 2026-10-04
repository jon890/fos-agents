import { z } from "zod";

/** 지원서 공통 프로필이 있는 fos-assistant Memory 의 collection 과 문서 키다. ADR-136 을 따른다. */
export const APPLICATION_PROFILE_COLLECTION = "identity" as const;
export const APPLICATION_PROFILE_DOCUMENT_KEY = "career-application-profile" as const;
/** 지원서 양식이 공통 프로필의 출처를 적을 때 쓰는 값이다. */
export const APPLICATION_PROFILE_SOURCE = "fos-assistant-memory:identity/career-application-profile" as const;

/** fos-assistant 서비스 읽기 API 의 200 본문이다. 모르는 칸은 버린다. */
export const applicationProfileResponseSchema = z.object({
  collection: z.literal(APPLICATION_PROFILE_COLLECTION),
  documentKey: z.literal(APPLICATION_PROFILE_DOCUMENT_KEY),
  title: z.string(),
  content: z.string(),
  revision: z.number().int().positive(),
  updatedAt: z.string().min(1),
});

export type ApplicationProfileDocument = z.infer<typeof applicationProfileResponseSchema>;
