import { z } from "zod";
import { CareerStoreError } from "../lib/career-store/errors.ts";
import { indexExclusions, judgePosting, type PostingVerdict } from "./feedback/exclusion-match.ts";
import { sourceIdSchema } from "./live-postings/contracts.ts";
import type { PositionStore } from "./position-store.ts";

const postingToCheck = z.strictObject({
  url: z.string().min(1).max(2000),
  company: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  // 수집기나 공고 목록이 준 값만 받는다. 주소나 제목에서 만들어 내지 않는다.
  source: sourceIdSchema.optional(),
  identityHash: z.string().trim().min(1).max(300).optional(),
});
export const checkExclusionsInputSchema = z
  .strictObject({ postings: z.array(postingToCheck).min(1).max(10) })
  // 식별값은 그 출처 안에서만 뜻이 있다.
  .refine((input) => input.postings.every((posting) => !posting.identityHash || posting.source));

export type CheckExclusionsResult = {
  results: Array<{ position: number; url: string } & PostingVerdict>;
};

/**
 * 대화에서 찾은 공고가 개인 제외 규칙에 걸리는지 판정한다. 판정은 모델이 아니라 수집기와 같은 코드가 한다(ADR-142).
 * `clear` 는 그 공고에 적용되는 규칙을 모두 비교했다는 뜻이다. 규칙이 식별값을 요구하는데 호출자가 주지 못한
 * 공고는 `undeterminable` 이고 추천하지 않는다. 규칙의 사유와 근거 주소는 결과에 넣지 않는다.
 */
export async function checkExclusions(
  store: Pick<PositionStore, "getExclusions" | "listCompanyPreferences">,
  input: unknown,
  now: Date,
): Promise<CheckExclusionsResult> {
  const parsed = checkExclusionsInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new CareerStoreError(
      400,
      "BAD_REQUEST",
      "postings 는 1개에서 10개이고 공고마다 url, company, title 이 필요합니다. identityHash 는 source 와 함께만 넘깁니다.",
    );
  }
  const index = indexExclusions(await store.getExclusions(), now);
  const excludedCompanies = new Set(
    (await store.listCompanyPreferences())
      .filter((preference) => preference.disposition === "exclude")
      .map((preference) => preference.companyKey),
  );
  return {
    results: parsed.data.postings.map((posting, position) => ({
      position,
      url: posting.url,
      ...judgePosting(index, posting, excludedCompanies),
    })),
  };
}
