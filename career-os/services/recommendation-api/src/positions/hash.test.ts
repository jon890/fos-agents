import { expect, test } from "vitest";
import type { PostingCandidate } from "../contracts/posting-candidate.js";
import { companyKey, positionContentHash, stableUuid } from "./hash.js";

const posting: PostingCandidate = {
  id: "wanted:1",
  source: "wanted",
  company: "테스트 회사",
  title: "Backend Engineer",
  url: "https://example.com/jobs/1",
  identityHash: "wanted:1",
  linkType: "direct_posting",
  postingStatus: "active",
  activeEvidence: "2026-09-17 확인",
  openedAt: "",
  closesAt: "",
  daysUntilClose: "14",
  closeUrgency: "normal",
  category: "개발",
  summary: "서버 개발",
  tags: ["backend", "java"],
  skills: ["Spring", "Java"],
  dueTime: "",
  mainTasks: "서버 개발",
  requirements: "Java",
  preferred: "",
};

test("수집 시각 성격의 필드와 배열 순서는 공고 본문 hash를 바꾸지 않는다", () => {
  const changedVolatile = {
    ...posting,
    activeEvidence: "2026-09-18 확인",
    daysUntilClose: "13",
    closeUrgency: "soon" as const,
    skills: [...posting.skills].reverse(),
    tags: [...posting.tags].reverse(),
  };
  expect(positionContentHash(changedVolatile)).toBe(positionContentHash(posting));
  expect(positionContentHash({ ...posting, requirements: "Java와 Kotlin" })).not.toBe(
    positionContentHash(posting),
  );
});

test("실행 식별자는 같은 입력에 안정적인 UUID를 만든다", () => {
  expect(stableUuid("analysis:collection-1")).toBe(stableUuid("analysis:collection-1"));
  expect(stableUuid("analysis:collection-1")).not.toBe(stableUuid("analysis:collection-2"));
  expect(stableUuid("analysis:collection-1")).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test("회사 식별자는 Backend 기준으로 공백과 대소문자를 정규화한다", () => {
  expect(companyKey("  Acme   Labs  ")).toBe("acme labs");
  expect(companyKey("테스트  회사")).toBe("테스트 회사");
});
