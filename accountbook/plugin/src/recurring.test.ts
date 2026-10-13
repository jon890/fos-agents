import { describe, expect, test } from "bun:test";
import { AccountbookClient } from "./client.ts";
import { AccountbookTools } from "./tools.ts";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const CATEGORY = "22222222-2222-4222-8222-222222222222";
const INCOME_CATEGORY = "44444444-4444-4444-8444-444444444444";
const RECURRING = "55555555-5555-4555-8555-555555555555";
const TOKEN = `fab_${"x".repeat(43)}`;
const BASE = "https://accountbook.example.com/api/v1";
const json = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
const result = (r: Awaited<ReturnType<AccountbookTools["call"]>>) => JSON.parse(r.content[0].text);

const template = {
  uuid: RECURRING,
  familyUuid: FAMILY,
  userUuid: "66666666-6666-4666-8666-666666666666",
  categoryUuid: CATEGORY,
  name: "예시 고정지출",
  amount: 1000,
  dayOfMonth: 5,
  status: "ACTIVE",
  generatedThisMonth: true,
};

function setup(respond: (url: string, method: string) => Response | undefined = () => undefined) {
  const requests: Array<{ url: string; method: string; body: unknown }> = [];
  const tools = new AccountbookTools(
    new AccountbookClient({ apiBaseUrl: BASE, apiToken: TOKEN }, async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const custom = respond(url, method);
      if (custom) return custom;
      if (url.endsWith("/categories"))
        return json([
          { uuid: CATEGORY, name: "예시 분류", type: "EXPENSE" },
          { uuid: INCOME_CATEGORY, name: "수입 분류", type: "INCOME" },
        ]);
      if (method === "PUT") return json({ ...template, ...JSON.parse(String(init?.body)) });
      return json({ totalMonthlyAmount: 1000, items: [template] });
    }),
    FAMILY,
  );
  return { tools, requests };
}

describe("반복지출 도구", () => {
  test("목록은 반복지출 경로를 읽고 카테고리 이름을 붙이며 사용자 식별자를 내보내지 않는다", async () => {
    const { tools, requests } = setup();
    const response = result(await tools.call("list_recurring_expenses", { month: "2026-10" }));
    expect(requests.at(-1)?.url).toBe(`${BASE}/families/${FAMILY}/recurring-expenses?month=2026-10`);
    expect(response).toEqual({
      month: "2026-10",
      items: [
        {
          uuid: RECURRING,
          name: "예시 고정지출",
          amount: 1000,
          dayOfMonth: 5,
          categoryUuid: CATEGORY,
          categoryName: "예시 분류",
          generatedThisMonth: true,
        },
      ],
    });
    expect(JSON.stringify(response)).not.toContain("userUuid");
  });

  test("월을 생략하면 query 없이 이번 달을 읽고, 잘못된 월은 호출하지 않는다", async () => {
    const { tools, requests } = setup();
    await tools.call("list_recurring_expenses", {});
    expect(requests.at(-1)?.url).toEndWith("/recurring-expenses");
    requests.length = 0;
    for (const month of ["2026-13", "2026-1", "2026-10-01"])
      expect(
        result(await tools.call("list_recurring_expenses", { month })).error.code,
      ).toBe("ACCOUNTBOOK_INVALID_INPUT");
    expect(requests).toHaveLength(0);
  });

  test("수정은 바꾼 칸만 PUT 하고 카테고리 이름을 지출 카테고리 UUID로 바꾼다", async () => {
    const { tools, requests } = setup();
    const response = result(
      await tools.call("update_recurring_expense", {
        recurringExpenseUuid: RECURRING,
        name: "새 이름",
        amount: 2000,
        categoryName: "예시 분류",
        confirmed: true,
      }),
    );
    expect(requests.at(-1)?.method).toBe("PUT");
    expect(requests.at(-1)?.url).toBe(`${BASE}/families/${FAMILY}/recurring-expenses/${RECURRING}`);
    expect(requests.at(-1)?.body).toEqual({ name: "새 이름", amount: 2000, categoryUuid: CATEGORY });
    expect(response).toMatchObject({ uuid: RECURRING, name: "새 이름", amount: 2000 });
    expect(requests.filter((request) => request.url.endsWith("/categories"))).toHaveLength(1);
  });

  const update = { recurringExpenseUuid: RECURRING, amount: 2000, confirmed: true };

  test("PUT 의 2xx 응답을 해석할 수 없으면 결과 불명으로 답한다", async () => {
    const bodies: Array<() => Response> = [
      () => json({}),
      () => json(null),
      () => new Response(JSON.stringify({}), { status: 200 }),
      () => json({ uuid: RECURRING }),
      () => new Response(null, { status: 204 }),
      () => new Response("not json", { status: 200 }),
    ];
    for (const respond of bodies) {
      const { tools, requests } = setup((_url, method) => (method === "PUT" ? respond() : undefined));
      expect(result(await tools.call("update_recurring_expense", update)).error.code).toBe(
        "ACCOUNTBOOK_OUTCOME_UNKNOWN",
      );
      expect(requests.filter((request) => request.method === "PUT")).toHaveLength(1);
    }
  });

  test("PUT 의 5xx 는 결과 불명, 확정 거절은 해당 오류를 유지한다", async () => {
    const expected: Array<[number, string]> = [
      [500, "ACCOUNTBOOK_OUTCOME_UNKNOWN"],
      [503, "ACCOUNTBOOK_OUTCOME_UNKNOWN"],
      [401, "ACCOUNTBOOK_UNAUTHORIZED"],
      [403, "ACCOUNTBOOK_FORBIDDEN"],
      [404, "ACCOUNTBOOK_NOT_FOUND"],
      [422, "ACCOUNTBOOK_BAD_REQUEST"],
    ];
    for (const [status, code] of expected) {
      const { tools } = setup((_url, method) =>
        method === "PUT" ? new Response("{}", { status }) : undefined,
      );
      expect(result(await tools.call("update_recurring_expense", update)).error.code).toBe(code);
    }
  });

  test("PUT 전에 카테고리 조회가 실패하면 PUT 을 보내지 않고 조회 오류를 유지한다", async () => {
    const { tools, requests } = setup((url) =>
      url.endsWith("/categories") ? new Response("{}", { status: 503 }) : undefined,
    );
    expect(result(await tools.call("update_recurring_expense", update)).error.code).toBe(
      "ACCOUNTBOOK_UNAVAILABLE",
    );
    expect(requests.every((request) => request.method === "GET")).toBe(true);
  });

  test("목록 응답 구조가 잘못되면 INVALID_RESPONSE 를 유지한다", async () => {
    const { tools } = setup((url, method) =>
      method === "GET" && url.includes("/recurring-expenses") ? json({}) : undefined,
    );
    expect(result(await tools.call("list_recurring_expenses", {})).error.code).toBe(
      "ACCOUNTBOOK_INVALID_RESPONSE",
    );
  });

  test("수입 카테고리는 반복지출에 쓰지 않는다", async () => {
    const { tools, requests } = setup();
    const response = result(
      await tools.call("update_recurring_expense", {
        recurringExpenseUuid: RECURRING,
        categoryUuid: INCOME_CATEGORY,
        confirmed: true,
      }),
    );
    expect(response.error.code).toBe("ACCOUNTBOOK_CATEGORY_SELECTION");
    expect(requests.every((request) => request.method === "GET")).toBe(true);
  });

  test("확인, 바꿀 칸, 결제일 범위가 없으면 호출하지 않는다", async () => {
    const { tools, requests } = setup();
    for (const args of [
      { recurringExpenseUuid: RECURRING, amount: 2000 },
      { recurringExpenseUuid: RECURRING, confirmed: true },
      { recurringExpenseUuid: RECURRING, dayOfMonth: 29, confirmed: true },
      { recurringExpenseUuid: RECURRING, name: " ", confirmed: true },
      { recurringExpenseUuid: "../x", amount: 2000, confirmed: true },
    ])
      expect(result(await tools.call("update_recurring_expense", args)).error.code).toBe(
        "ACCOUNTBOOK_INVALID_INPUT",
      );
    expect(requests).toHaveLength(0);
  });

  test("연동 토큰이 반복지출 경로를 허용받지 못하면 권한 오류로 답한다", async () => {
    const { tools } = setup((url) =>
      url.includes("/recurring-expenses") ? new Response("{}", { status: 403 }) : undefined,
    );
    expect(result(await tools.call("list_recurring_expenses", {})).error.code).toBe(
      "ACCOUNTBOOK_FORBIDDEN",
    );
  });
});
