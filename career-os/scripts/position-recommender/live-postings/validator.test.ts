import { expect, test } from "bun:test";
import type { Posting } from "./types.ts";
import { createPostingEligibilityPolicy, dedupe, filterEligiblePostings } from "./validator.ts";

function posting(overrides: Partial<Posting>): Posting {
  return {
    source: "wanted",
    discoveryMode: "target-keyword",
    company: "컬리",
    title: "핀테크 백엔드 개발자 (결제)",
    url: "https://www.wanted.co.kr/wd/334745",
    linkType: "direct_posting",
    postingStatus: "active",
    activeEvidence: "test",
    openedAt: "",
    closesAt: "no_deadline",
    daysUntilClose: "no_deadline",
    closeUrgency: "no_deadline",
    category: "기술",
    summary: "test",
    tags: ["backend-platform"],
    skills: ["Java"],
    dueTime: "",
    mainTasks: "test",
    requirements: "test",
    preferred: "",
    ...overrides,
  };
}

test("같은 회사와 역할의 공식 개별 공고가 있으면 Wanted 항목을 제외한다", () => {
  const official = posting({
    source: "kurly-careers",
    discoveryMode: "official-detail",
    url: "https://kurly.career.greetinghr.com/ko/o/198009",
    postingStatus: "open",
  });
  expect(dedupe([posting({}), official])).toEqual([official]);
});

test("공식 개별 공고가 없으면 Wanted 항목을 유지한다", () => {
  expect(dedupe([posting({})])).toHaveLength(1);
});

test("마감일이 지난 공고는 모델 입력 전에 제외한다", () => {
  const result = filterEligiblePostings(
    [posting({ closesAt: "2026-08-12", daysUntilClose: "-1" })],
    new Date("2026-08-13T00:00:00+09:00"),
  );

  expect(result.eligible).toHaveLength(0);
  expect(result.rejectedCounts.expired_deadline).toBe(1);
});

test("마감일이 오늘이면 당일까지 지원 가능한 후보로 유지한다", () => {
  const result = filterEligiblePostings(
    [posting({ closesAt: "2026-08-13", daysUntilClose: "0" })],
    new Date("2026-08-13T12:00:00+09:00"),
  );

  expect(result.eligible).toHaveLength(1);
});

test("상태 미확인과 비개별 링크를 결정적으로 제외한다", () => {
  const result = filterEligiblePostings([
    posting({ postingStatus: "unknown" }),
    posting({ linkType: "career_article", url: "https://example.com/careers/article" }),
  ]);

  expect(result.eligible).toHaveLength(0);
  expect(result.rejectedCounts).toEqual({ unverified_status: 1, not_direct_posting: 1 });
});

test("비대상 직무와 비정규 고용은 모든 소스의 공통 경계에서 제외한다", () => {
  const result = filterEligiblePostings([
    posting({ title: "Business Partnership Manager", mainTasks: "서버 조직과 협업" }),
    posting({ title: "백엔드 개발자 인턴" }),
    posting({ title: "AI Research Engineer", mainTasks: "모델 연구" }),
  ]);

  expect(result.eligible).toHaveLength(0);
  expect(result.rejectedCounts).toEqual({
    not_target_role: 2,
    ineligible_employment: 1,
  });
});
