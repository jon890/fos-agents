import { expect, test } from "bun:test";
import { parseWoowahanRecruit } from "./adapters/woowahan-careers.ts";
import { buildPostingCandidatePool } from "./candidate_pool.ts";
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

for (const title of ["Server(배차시스템)", "Software Engineer, Search"]) {
  test(`본문에서 확인한 서버 개발 공고가 후보풀에 남는다: ${title}`, () => {
    const item = server(title);
    expect(policy.evaluate(item, now)).toEqual({ eligible: true });
    const result = buildPostingCandidatePool([item], {
      collectionRunId: "synthetic-run",
      collectedAt: now.toISOString(),
      requestedSource: "woowahan-careers",
      configuredSources: ["woowahan-careers"],
      wantedLimit: 1,
      includeTossArticles: false,
      sourceDiagnostics: [],
      errors: [],
    });
    expect(result.validationErrors).toEqual([]);
    expect(result.pool.candidates).toHaveLength(1);
  });
  test(`일반 개발 제목에도 본문 근거와 생명주기 검사가 필요하다: ${title}`, () => {
    const item = server(title);
    for (const mainTasks of ["프론트엔드 UI 개발", "frontend API client 개발", "상품 기획", ""]) {
      expect(
        policy.evaluate({ ...item, mainTasks, requirements: "", preferred: "" }, now).rejectionCode,
      ).toBe("not_target_role");
    }
    expect(policy.evaluate({ ...item, postingStatus: "unknown" }, now).rejectionCode).toBe(
      "unverified_status",
    );
    expect(policy.evaluate({ ...item, closesAt: "2026-10-06" }, now).rejectionCode).toBe(
      "expired_deadline",
    );
  });
}
for (const title of [
  "Category MD",
  "상담팀 리드",
  "Business Partnership Manager",
  "Platform Operations Director",
]) {
  test(`비개발 제목은 서버 조직 언급만으로 통과하지 않는다: ${title}`, () => {
    expect(
      policy.evaluate({ ...server(), title, mainTasks: "서버 플랫폼 조직과 협업" }, now)
        .rejectionCode,
    ).toBe("not_target_role");
  });
}
