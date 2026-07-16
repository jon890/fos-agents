import { expect, test } from "bun:test";
import type { Posting } from "./types.ts";
import { dedupe } from "./validator.ts";

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
