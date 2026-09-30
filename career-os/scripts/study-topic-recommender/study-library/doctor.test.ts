import { describe, expect, test } from "bun:test";
import { checkStudyBackend } from "./doctor.ts";

const token = "t".repeat(40);
const environment = { CAREER_BACKEND_URL: "https://backend.example", CAREER_BACKEND_TOKEN: token };

function fetchWith(statuses: Record<string, number>, seen: string[] = []) {
  return async (input: URL) => {
    seen.push(input.pathname);
    const status = statuses[input.pathname];
    if (status === undefined) throw new Error("연결 실패");
    return new Response(status === 204 ? null : "{}", { status });
  };
}

describe("checkStudyBackend", () => {
  test("연결값이 없으면 요청하지 않고 설정 위치를 알린다", async () => {
    const seen: string[] = [];
    const result = await checkStudyBackend({}, fetchWith({}, seen));
    expect(result.passed).toBe(false);
    expect(seen).toEqual([]);
    expect(result.checks[0].message).toContain("CAREER_BACKEND_URL");
    expect(result.checks[0].message).toContain("career-os/.env");
  });

  test("출력에 토큰 값이 들어가지 않는다", async () => {
    const result = await checkStudyBackend(environment, fetchWith({ "/api/v1/auth/check": 401 }));
    expect(result.passed).toBe(false);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(result.checks.at(-1)?.message).toContain("토큰이 거절됐다");
  });

  test("Backend 에 닿지 못하면 멈춘다", async () => {
    const result = await checkStudyBackend(environment, fetchWith({}));
    expect(result.passed).toBe(false);
    expect(result.checks.at(-1)?.message).toContain("닿지 못했다");
  });

  test("learning-interests 문서가 없으면 저장 명령을 알린다", async () => {
    const result = await checkStudyBackend(
      environment,
      fetchWith({ "/api/v1/auth/check": 204, "/api/candidate-context/v1/documents/learning-interests": 404 }),
    );
    expect(result.passed).toBe(false);
    expect(result.checks.at(-1)?.message).toContain("manage_candidate_context.ts put");
  });

  test("인증과 문서가 모두 있으면 통과한다", async () => {
    const result = await checkStudyBackend(
      environment,
      fetchWith({ "/api/v1/auth/check": 204, "/api/candidate-context/v1/documents/learning-interests": 200 }),
    );
    expect(result).toEqual({
      passed: true,
      checks: [
        { name: "connection", ok: true, message: "연결값이 있다" },
        { name: "auth", ok: true, message: "Backend 에 닿고 토큰이 유효하다" },
        { name: "learning-interests", ok: true, message: "learning-interests 문서가 있다" },
      ],
    });
  });
});
