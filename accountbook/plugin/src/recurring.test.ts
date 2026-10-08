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
