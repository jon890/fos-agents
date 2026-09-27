import { describe, expect, it } from "vitest";

import { nextTopicProgress, seoulDate, type TopicProgressState } from "./review-schedule.js";

const empty: TopicProgressState = {
  passCount: 0,
  failCount: 0,
  nextReviewDate: null,
  lastPassedDate: null,
};

describe("면접 주제 복습 일정", () => {
  it("연속 통과에 따라 간격을 늘리고 이후에는 60일로 둔다", () => {
    let progress = empty;
    const dates: string[] = [];
    for (let index = 0; index < 7; index += 1) {
      progress = nextTopicProgress(progress, "pass", "2026-09-28");
      dates.push(progress.nextReviewDate!);
    }
    expect(dates).toEqual([
      "2026-09-29", "2026-10-01", "2026-10-05", "2026-10-12", "2026-10-28", "2026-11-27", "2026-11-27",
    ]);
  });

  it.each(["shallow", "fail", "unknown"] as const)("%s는 실패 횟수와 다음 날 복습을 남긴다", (score) => {
    expect(nextTopicProgress(empty, score, "2026-09-28")).toEqual({
      passCount: 0,
      failCount: 1,
      nextReviewDate: "2026-09-29",
      lastPassedDate: null,
    });
  });

  it("UTC 프로세스에서도 서울 날짜를 쓴다", () => {
    expect(seoulDate(new Date("2026-09-27T15:30:00Z"))).toBe("2026-09-28");
  });
});
