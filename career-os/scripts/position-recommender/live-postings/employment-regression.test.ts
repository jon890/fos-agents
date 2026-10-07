import { expect, test } from "bun:test";
import { postingFromTossApiJob } from "./adapters/toss.ts";
import { parseWoowahanRecruit } from "./adapters/woowahan-careers.ts";
import { isContractRole } from "./policy.ts";
import { createPostingEligibilityPolicy } from "./validator.ts";

const policy = createPostingEligibilityPolicy();
const now = new Date("2026-10-07T00:00:00Z");
function server(title = "Backend Engineer", body = "서버 API 개발 및 운영") {
  const parsed = parseWoowahanRecruit(
    { recruitSeq: 1, recruitNumber: "synthetic-1", recruitName: title },
    body,
  );
  expect(parsed).not.toBeNull();
  return {
    ...parsed!,
    company: "가상서비스",
    url: "https://example.com/jobs/1",
    activeEvidence: "합성 응답",
    summary: "합성 공고",
  };
}

for (const term of [
  "internal tools",
  "templates",
  "contract testing",
  "인턴과 협업",
  "인턴 공통 채용 안내",
]) {
  test(`기술 설명과 공통 안내는 고용형태를 바꾸지 않는다: ${term}`, () => {
    const parsed = postingFromTossApiJob(
      {},
      {
        id: 1,
        title: "Backend Engineer",
        company_name: "가상서비스",
        content: `서버 API 개발 ${term}`,
        metadata: [{ name: "Employment_Type", value: "정규직" }],
      },
      true,
    ).posting;
    expect(parsed).toBeDefined();
    expect(policy.evaluate(parsed!, now)).toEqual({ eligible: true });
  });
}

for (const employment of ["Intern", "Contractor", "Temporary", "계약직", "Freelance"]) {
  test(`명시적 비정규 고용은 제외한다: ${employment}`, () => {
    expect(isContractRole(employment)).toBe(true);
    expect(policy.evaluate({ ...server(), employmentType: employment }, now).rejectionCode).toBe(
      "ineligible_employment",
    );
    expect(
      policy.evaluate({ ...server(), title: `Backend Engineer (${employment})` }, now)
        .rejectionCode,
    ).toBe("ineligible_employment");
    expect(
      postingFromTossApiJob(
        {},
        {
          id: 1,
          title: "Backend Engineer",
          company_name: "가상서비스",
          content: "서버 개발",
          metadata: [{ name: "Employment_Type", value: employment }],
        },
        true,
      ).posting,
    ).toBeUndefined();
  });
}

test("고용형태가 없으면 미확인을 보존하고 JD로 추정하지 않는다", () => {
  const item = server(
    "Backend Engineer",
    "서버 개발 internal tools templates contract testing 인턴과 협업",
  );
  expect(item.employmentType).toBeUndefined();
  expect(policy.evaluate(item, now).eligible).toBe(true);
});
