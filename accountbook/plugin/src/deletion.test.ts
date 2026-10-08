import { describe, expect, test } from "bun:test";
import { AccountbookClient } from "./client.ts";
import { AccountbookTools } from "./tools.ts";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const CATEGORY = "22222222-2222-4222-8222-222222222222";
const RECORD = "33333333-3333-4333-8333-333333333333";
const RECURRING = "44444444-4444-4444-8444-444444444444";
const preview = {
  transactionUuid: RECORD,
  confirmed: true,
  date: "2026-09-30T12:00:00",
  amount: 100,
  description: "예시 기록",
  categoryName: "예시 분류",
};
const current = {
  uuid: RECORD,
  date: preview.date,
  amount: preview.amount,
  description: preview.description,
  categoryUuid: CATEGORY,
  recurringExpenseUuid: null,
};
const json = (data: unknown) => new Response(JSON.stringify({ data }));
const result = (r: Awaited<ReturnType<AccountbookTools["call"]>>) => JSON.parse(r.content[0].text);

function setup(
  record: Record<string, unknown> = current,
  options: {
    read?: () => Response;
    categories?: unknown;
    remove?: () => Response;
  } = {},
) {
  const requests: { url: string; method: string; body: unknown }[] = [];
  const tools = new AccountbookTools(
    new AccountbookClient(
      { apiBaseUrl: "https://accountbook.example.com/api/v1", apiToken: `fab_${"x".repeat(43)}` },
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        requests.push({ url, method, body: init?.body });
        if (method === "DELETE") return options.remove?.() ?? json(null);
        if (url.endsWith("/categories"))
          return json(
            options.categories ?? [{ uuid: CATEGORY, name: "예시 분류", type: "EXPENSE" }],
          );
        return options.read?.() ?? json(record);
      },
    ),
    FAMILY,
  );
  return { tools, requests };
}

describe("삭제 전 승인 대상 대조", () => {
  for (const type of ["expense", "income"]) {
    const args = { ...preview, ...(type === "expense" ? { recurringExpenseUuid: null } : {}) };

    test(`${type}: 문자열·숫자 금액이 같으면 재조회 뒤 본문 없이 한 건 삭제한다`, async () => {
      for (const value of [100, "100.00", 0.1, "0.10"]) {
        const { tools, requests } = setup({ ...current, amount: value });
        expect(
          result(await tools.call(`delete_${type}`, { ...args, amount: Number(value) })),
        ).toEqual({
          deleted: true,
          familyUuid: FAMILY,
          transactionUuid: RECORD,
        });
        expect(requests.map(({ method }) => method)).toEqual(["GET", "GET", "DELETE"]);
        expect(requests[0].url).toEndWith(`/families/${FAMILY}/${type}s/${RECORD}`);
        expect(requests[1].url).toEndWith(`/families/${FAMILY}/categories`);
        expect(requests[2].url).toBe(requests[0].url);
        expect(requests[2].body).toBeUndefined();
      }
    });

    test(`${type}: 승인 카드의 날짜·금액·내용·카테고리와 다르면 DELETE를 보내지 않는다`, async () => {
      for (const change of [
        { date: "2026-09-29T12:00:00" },
        { amount: 101 },
        { description: "바뀐 기록" },
        { description: null },
        { categoryUuid: null },
        { uuid: RECURRING },
      ]) {
        const { tools, requests } = setup({ ...current, ...change });
        expect(result(await tools.call(`delete_${type}`, args)).error.code).toBe(
          "ACCOUNTBOOK_DELETE_CONFIRMATION_MISMATCH",
        );
        expect(requests.every(({ method }) => method === "GET")).toBe(true);
      }
      const { tools, requests } = setup(current, {
        categories: [{ uuid: CATEGORY, name: "바뀐 분류", type: "EXPENSE" }],
      });
      expect(result(await tools.call(`delete_${type}`, args)).error.code).toBe(
        "ACCOUNTBOOK_DELETE_CONFIRMATION_MISMATCH",
      );
      expect(requests.map(({ method }) => method)).toEqual(["GET", "GET"]);
    });

    test(`${type}: 없는 설명·카테고리는 null로 대조하고 카테고리 조회를 생략한다`, async () => {
      const { tools, requests } = setup({ ...current, description: null, categoryUuid: null });
      expect(
        result(
          await tools.call(`delete_${type}`, { ...args, description: null, categoryName: null }),
        ).deleted,
      ).toBe(true);
      expect(requests.map(({ method }) => method)).toEqual(["GET", "DELETE"]);
    });

    test(`${type}: 잘못된 상세·카테고리 응답은 삭제 전에 거절한다`, async () => {
      for (const change of [
        { amount: 0 },
        { amount: "100.001" },
        { categoryUuid: undefined },
        { description: undefined },
        ...(type === "expense" ? [{ recurringExpenseUuid: undefined }] : []),
      ]) {
        const { tools, requests } = setup({ ...current, ...change });
        expect(result(await tools.call(`delete_${type}`, args)).error.code).toBe(
          "ACCOUNTBOOK_INVALID_RESPONSE",
        );
        expect(requests.map(({ method }) => method)).toEqual(["GET"]);
      }
      for (const categories of [[], { invalid: true }]) {
        const { tools, requests } = setup(current, { categories });
        expect(result(await tools.call(`delete_${type}`, args)).error.code).toBe(
          "ACCOUNTBOOK_INVALID_RESPONSE",
        );
        expect(requests.map(({ method }) => method)).toEqual(["GET", "GET"]);
      }
    });

    test(`${type}: 재조회 실패는 조회 오류로 반환하고 DELETE를 보내지 않는다`, async () => {
      for (const [failure, code] of [
        ["network", "ACCOUNTBOOK_NETWORK"],
        [404, "ACCOUNTBOOK_NOT_FOUND"],
        [502, "ACCOUNTBOOK_UNAVAILABLE"],
      ] as const) {
        const { tools, requests } = setup(current, {
          read: () => {
            if (failure === "network") throw new Error("socket closed");
            return new Response("{}", { status: failure });
          },
        });
        expect(result(await tools.call(`delete_${type}`, args)).error.code).toBe(code);
        expect(requests.map(({ method }) => method)).toEqual(["GET"]);
      }
    });

    test(`${type}: 대조 후 DELETE 실패·읽을 수 없는 성공 응답은 결과 불명이다`, async () => {
      for (const failure of ["network", 502, "invalid-json", "invalid-data"] as const) {
        const { tools, requests } = setup(current, {
          remove: () => {
            if (failure === "network") throw new Error("socket closed");
            if (failure === "invalid-json") return new Response("not json");
            if (failure === "invalid-data") return json({ deleted: true });
            return new Response("{}", { status: failure });
          },
        });
        expect(result(await tools.call(`delete_${type}`, args)).error.code).toBe(
          "ACCOUNTBOOK_OUTCOME_UNKNOWN",
        );
        expect(requests.map(({ method }) => method)).toEqual(["GET", "GET", "DELETE"]);
      }
    });
  }

  test("지출은 반복지출 UUID의 유무와 값을 대조하며 누락 입력을 거절한다", async () => {
    for (const [actual, approved] of [
      [RECURRING, null],
      [null, RECURRING],
      [RECORD, RECURRING],
    ]) {
      const { tools, requests } = setup({ ...current, recurringExpenseUuid: actual });
      expect(
        result(await tools.call("delete_expense", { ...preview, recurringExpenseUuid: approved }))
          .error.code,
      ).toBe("ACCOUNTBOOK_DELETE_CONFIRMATION_MISMATCH");
      expect(requests.map(({ method }) => method)).toEqual(["GET", "GET"]);
    }
    const { tools, requests } = setup({ ...current, recurringExpenseUuid: RECURRING });
    expect(result(await tools.call("delete_expense", preview)).error.code).toBe(
      "ACCOUNTBOOK_INVALID_INPUT",
    );
    expect(requests).toHaveLength(0);
    expect(
      result(await tools.call("delete_expense", { ...preview, recurringExpenseUuid: RECURRING }))
        .deleted,
    ).toBe(true);
  });
});
