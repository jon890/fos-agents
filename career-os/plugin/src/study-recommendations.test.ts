// list_study_recommendations: the only tool that reads back what save_study_recommendation stored.
// Candidates exclude everything already recommended, so titles of past picks come from here. All data is synthetic.
import { describe, expect, test } from "bun:test";
import { CareerBackend, type FetchLike } from "./backend.ts";
import { urlKey } from "./study-fixtures.ts";
import { CareerTools } from "./tools.ts";

const baseUrl = "https://career.example.com/";
const token = "x".repeat(40);

type Call = { method: string; path: string; body: unknown };

function harness(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(String(input));
    const call: Call = { method: String(init?.method), path: `${url.pathname}${url.search}`, body: init?.body };
    calls.push(call);
    return respond(call);
  };
  return { calls, tools: new CareerTools(new CareerBackend({ baseUrl, token }, fetchImpl)) };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const parse = (result: { content: [{ text: string }] }) => JSON.parse(result.content[0].text);

const run = (reportId: string, generatedAt: string, topicTitle: string) => ({
  reportId,
  generatedAt,
  topics: [
    {
      topicKey: `topic-${reportId}`,
      title: topicTitle,
      careerQuestion: "장애 전파를 어떻게 줄이는가",
      items: [
        { contentKey: urlKey(1), title: "재시도 예산으로 장애 전파를 막은 이야기", url: "https://blog.example.com/posts/retry-budget" },
      ],
    },
  ],
});

describe("list_study_recommendations", () => {
  test("저장된 추천을 GET 한 번으로 읽어 주제 제목과 자료 제목을 돌려주고 아무것도 쓰지 않는다", async () => {
    const { calls, tools } = harness(() =>
      json({
        runs: [
          run("morning-2026-10-05", "2026-10-05T13:00:00.000Z", "재시도 예산"),
          run("morning-2026-10-04", "2026-10-04T13:00:00.000Z", "아웃박스 패턴"),
        ],
      }),
    );
    const result = await tools.call("list_study_recommendations", {});
    expect(result.isError).toBeUndefined();
    expect(calls).toEqual([{ method: "GET", path: "/api/study/v1/recommendation-runs?limit=5", body: undefined }]);
    const value = parse(result);
    expect(value.status).toBe("ok");
    expect(value.runs.map((item: { reportId: string }) => item.reportId)).toEqual([
      "morning-2026-10-05",
      "morning-2026-10-04",
    ]);
    expect(value.runs[0].topics[0].title).toBe("재시도 예산");
    expect(value.runs[0].topics[0].items[0]).toEqual({
      contentKey: urlKey(1),
      title: "재시도 예산으로 장애 전파를 막은 이야기",
      url: "https://blog.example.com/posts/retry-budget",
    });
  });

  test("limit 을 query 에 싣고 범위 밖이나 모르는 칸은 요청을 보내기 전에 거절한다", async () => {
    const { calls, tools } = harness(() => json({ runs: [] }));
    await tools.call("list_study_recommendations", { limit: 10 });
    expect(calls.map((call) => call.path)).toEqual(["/api/study/v1/recommendation-runs?limit=10"]);
    for (const args of [{ limit: 0 }, { limit: 11 }, { limit: 1.5 }, { cursor: "x" }]) {
      const result = await tools.call("list_study_recommendations", args);
      expect({ args, error: parse(result).error.code }).toEqual({ args, error: "CAREER_INVALID_INPUT" });
    }
    expect(calls).toHaveLength(1);
  });

  test("기록이 없으면 empty 로 알려 일반 오류와 구분한다", async () => {
    const { tools } = harness(() => json({ runs: [] }));
    expect(parse(await tools.call("list_study_recommendations", {}))).toEqual({ status: "empty", runs: [] });
  });

  test("Backend 응답에 모르는 칸이 있어도 알려진 칸만 돌려주고, 모양이 틀리면 CAREER_INVALID_RESPONSE 다", async () => {
    const extra = { ...run("morning-2026-10-05", "2026-10-05T13:00:00.000Z", "재시도 예산"), internalNote: "비공개" };
    const ok = harness(() => json({ runs: [extra], debug: true }));
    expect(JSON.stringify(parse(await ok.tools.call("list_study_recommendations", {})))).not.toContain("비공개");

    const bad = harness(() => json({ runs: [{ reportId: "morning-2026-10-05" }] }));
    expect(parse(await bad.tools.call("list_study_recommendations", {})).error.code).toBe("CAREER_INVALID_RESPONSE");
  });

  test("인증 거절과 장애는 빈 결과가 아니라 오류 코드로 온다", async () => {
    expect(parse(await harness(() => json({}, 401)).tools.call("list_study_recommendations", {})).error.code).toBe(
      "CAREER_UNAUTHORIZED",
    );
    expect(parse(await harness(() => json({}, 503)).tools.call("list_study_recommendations", {})).error.code).toBe(
      "CAREER_UNAVAILABLE",
    );
  });
});
