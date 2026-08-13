import { describe, expect, test } from "bun:test";
import { currentTargetFile } from "./current_target_schema.ts";

const validTarget = {
  primary: {
    company: "예시 회사",
    team: "플랫폼팀",
    role: "백엔드 개발자",
    company_slug: "example-company",
    position_slug: "backend-engineer",
    data_root: "private/example-company/backend-engineer",
    interview: {
      first_round: { date: "2026-08-20", status: "scheduled" },
      final_round: null,
    },
  },
};

describe("현재 지원 대상 스키마", () => {
  test("현재 대상 하나를 허용한다", () => {
    expect(currentTargetFile.parse(validTarget)).toEqual(validTarget);
  });

  test("종료 이력을 같은 파일에 누적하지 않는다", () => {
    const result = currentTargetFile.safeParse({ ...validTarget, history: [] });
    expect(result.success).toBe(false);
  });

  test("비공개 준비 경로만 허용한다", () => {
    const result = currentTargetFile.safeParse({
      primary: { ...validTarget.primary, data_root: "/Users/example/private/target" },
    });
    expect(result.success).toBe(false);
  });
});
