import { describe, expect, test } from "bun:test";
import { AccountbookClient } from "./client.ts";
import { AccountbookTools } from "./tools.ts";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const CATEGORY = "22222222-2222-4222-8222-222222222222";
const INCOME_CATEGORY = "44444444-4444-4444-8444-444444444444";
const RECORD = "33333333-3333-4333-8333-333333333333";
const TOKEN = `fab_${"x".repeat(43)}`;
const BASE = "https://accountbook.example.com/api/v1";
const json = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
const result = (r: Awaited<ReturnType<AccountbookTools["call"]>>) => JSON.parse(r.content[0].text);

function setup(families = [{ uuid: FAMILY, name: "예시 가족" }], defaultFamily?: string) {
  const requests: Array<{
    url: string;
    method: string;
    body: Record<string, unknown> | undefined;
  }> = [];
  const tools = new AccountbookTools(
    new AccountbookClient({ apiBaseUrl: BASE, apiToken: TOKEN }, async (input, init) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(init?.redirect).toBe("error");
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url, method, body });
      if (url.endsWith("/families")) return json(families);
      if (url.endsWith("/categories"))
        return json([
          { uuid: CATEGORY, name: "예시 분류", type: "EXPENSE" },
          { uuid: INCOME_CATEGORY, name: "예시 분류", type: "INCOME" },
          { uuid: RECORD, name: "수입 전용", type: "INCOME" },
          { uuid: FAMILY, name: "지출 전용", type: "EXPENSE" },
        ]);
      if (method === "DELETE") return json(null);
      if (url.includes("?"))
        return json({ items: [], totalPages: 0, currentPage: 0, totalElements: 0 });
      return json({
        uuid: RECORD,
        amount: 100,
        date: "2026-09-30T12:00:00",
        description: "예시 기록",
        ...body,
      });
    }),
    defaultFamily,
  );
  return { tools, requests };
}

describe("MCP 가계부 도구", () => {
  test("삭제는 승인 카드의 대상 필드를 모두 받고 한 건의 DELETE만 보낸다", async () => {
    const preview = {
      transactionUuid: RECORD,
      confirmed: true,
      date: "2026-09-30T12:00:00",
      amount: 100,
      description: "예시 기록",
      categoryName: "예시 분류",
    };
    for (const type of ["expense", "income"]) {
      const { tools, requests } = setup(undefined, FAMILY);
      for (const field of ["date", "amount", "description", "categoryName"]) {
        const args: Record<string, unknown> = { ...preview };
        delete args[field];
        expect(result(await tools.call(`delete_${type}`, args)).error.code).toBe(
          "ACCOUNTBOOK_INVALID_INPUT",
        );
      }
      expect(
        result(await tools.call(`delete_${type}`, { ...preview, transactionUuids: [RECORD] })).error
          .code,
      ).toBe("ACCOUNTBOOK_INVALID_INPUT");
      expect(requests).toHaveLength(0);
      expect(result(await tools.call(`delete_${type}`, preview)).deleted).toBe(true);
      expect(requests).toHaveLength(1);
      expect(requests[0].url).toEndWith(`/${type}s/${RECORD}`);
      expect(requests[0].method).toBe("DELETE");
      expect(requests[0].body).toBeUndefined();
    }
  });

  test("설명과 분류가 없는 삭제 대상은 null로 표시한다", async () => {
    const { tools } = setup(undefined, FAMILY);
    const response = await tools.call("delete_expense", {
      transactionUuid: RECORD,
      confirmed: true,
      date: "2026-09-30T12:00:00",
      amount: 100,
      description: null,
      categoryName: null,
      recurringExpenseUuid: null,
    });
    expect(result(response).deleted).toBe(true);
  });

  test("잘못된 성공 응답은 성공 내역으로 반환하지 않는다", async () => {
    for (const name of [
      "list_families",
      "list_categories",
      "list_expenses",
      "get_expense",
      "update_expense",
      "delete_expense",
    ]) {
      for (const data of [
        undefined,
        { data: { items: "invalid" } },
        { data: { items: [] } },
        { data: null },
      ]) {
        if (name === "delete_expense" && (data === undefined || data.data === null)) continue;
        const tools = new AccountbookTools(
          new AccountbookClient(
            { apiBaseUrl: BASE, apiToken: TOKEN },
            async () => new Response(JSON.stringify(data ?? {})),
          ),
          FAMILY,
        );
        const args =
          name === "get_expense"
            ? { transactionUuid: RECORD }
            : name === "update_expense"
              ? { transactionUuid: RECORD, confirmed: true, amount: 200 }
              : name === "delete_expense"
                ? {
                    transactionUuid: RECORD,
                    confirmed: true,
                    date: "2026-09-30T12:00:00",
                    amount: 100,
                    description: "예시 기록",
                    categoryName: "예시 분류",
                  }
                : {};
        // 변경 요청이 2xx 로 끝났는데 본문을 읽지 못하면 실패가 아니라 결과를 모르는 것이다.
        expect(result(await tools.call(name, args)).error.code).toBe(
          name === "update_expense" || name === "delete_expense"
            ? "ACCOUNTBOOK_OUTCOME_UNKNOWN"
            : "ACCOUNTBOOK_INVALID_RESPONSE",
        );
      }
    }
  });

  test("변경 요청을 보낸 뒤의 연결 실패와 5xx 는 결과를 모르는 오류다", async () => {
    for (const failure of ["network", 502] as const) {
      const methods: string[] = [];
      const tools = new AccountbookTools(
        new AccountbookClient({ apiBaseUrl: BASE, apiToken: TOKEN }, async (_input, init) => {
          const method = init?.method ?? "GET";
          methods.push(method);
          if (method === "GET") throw new Error("unexpected read");
          if (failure === "network") throw new Error("socket closed");
          return new Response("{}", { status: failure });
        }),
        FAMILY,
      );
      const response = await tools.call("update_expense", {
        transactionUuid: RECORD,
        confirmed: true,
        amount: 200,
      });
      expect(result(response).error.code).toBe("ACCOUNTBOOK_OUTCOME_UNKNOWN");
      expect(methods).toEqual(["PUT"]);
    }
    for (const failure of ["network", 502] as const) {
      const tools = new AccountbookTools(
        new AccountbookClient({ apiBaseUrl: BASE, apiToken: TOKEN }, async () => {
          if (failure === "network") throw new Error("socket closed");
          return new Response("{}", { status: failure });
        }),
        FAMILY,
      );
      // 쓰기 전 카테고리 조회가 실패하면 아무것도 보내지 않았으므로 다시 시도할 수 있는 오류다.
      const response = await tools.call("create_expense", {
        amount: 100,
        date: "2026-09-30T12:00:00",
        categoryName: "예시 분류",
      });
      expect(result(response).error.code).toBe(
        failure === "network" ? "ACCOUNTBOOK_NETWORK" : "ACCOUNTBOOK_UNAVAILABLE",
      );
    }
  });
  test("가족이 하나면 자동 선택하고 이름을 카테고리 UUID로 변환한다", async () => {
    const { tools, requests } = setup();
    expect(result(await tools.call("list_families", {})).defaultFamilyUuid).toBe(FAMILY);
    expect(result(await tools.call("list_categories", {}))[0].uuid).toBe(CATEGORY);
    for (const type of ["expense", "income"]) {
      const response = await tools.call(`create_${type}`, {
        amount: 100,
        date: "2026-09-30T12:00:00",
        categoryName: "예시 분류",
      });
      expect(response).not.toHaveProperty("isError");
      expect(requests.at(-1)?.method).toBe("POST");
      expect(requests.at(-1)?.url).toEndWith(`/${type}s`);
      expect(requests.at(-1)?.body).toEqual({
        amount: 100,
        date: "2026-09-30T12:00:00",
        categoryUuid: type === "expense" ? CATEGORY : INCOME_CATEGORY,
      });
    }
  });

  test("카테고리 목록은 종류를 보존한다", async () => {
    const { tools } = setup(undefined, FAMILY);
    expect(result(await tools.call("list_categories", {}))).toEqual([
      { uuid: CATEGORY, name: "예시 분류", type: "EXPENSE" },
      { uuid: INCOME_CATEGORY, name: "예시 분류", type: "INCOME" },
      { uuid: RECORD, name: "수입 전용", type: "INCOME" },
      { uuid: FAMILY, name: "지출 전용", type: "EXPENSE" },
    ]);
  });

  test("종류가 없거나 잘못된 카테고리 응답은 사용하지 않는다", async () => {
    for (const type of [undefined, "OTHER"]) {
      const tools = new AccountbookTools(
        new AccountbookClient({ apiBaseUrl: BASE, apiToken: TOKEN }, async () =>
          json([{ uuid: CATEGORY, name: "예시 분류", type }]),
        ),
        FAMILY,
      );
      const response = result(await tools.call("list_categories", {}));
      expect(response.error.code).toBe("ACCOUNTBOOK_INVALID_RESPONSE");
    }
  });

  test("등록과 수정은 같은 종류의 이름과 UUID만 선택한다", async () => {
    for (const type of ["expense", "income"]) {
      const expectedUuid = type === "expense" ? CATEGORY : INCOME_CATEGORY;
      const wrongUuid = type === "expense" ? INCOME_CATEGORY : CATEGORY;
      for (const action of ["create", "update"]) {
        for (const selector of [{ categoryName: "예시 분류" }, { categoryUuid: expectedUuid }]) {
          const { tools, requests } = setup(undefined, FAMILY);
          const response = await tools.call(`${action}_${type}`, {
            amount: 100,
            date: "2026-09-30T12:00:00",
            ...(action === "update" ? { transactionUuid: RECORD, confirmed: true } : {}),
            ...selector,
          });
          expect(response).not.toHaveProperty("isError");
          expect(requests.at(-1)?.body?.categoryUuid).toBe(expectedUuid);
        }
        for (const selector of [
          { categoryUuid: wrongUuid },
          { categoryName: type === "expense" ? "수입 전용" : "지출 전용" },
        ]) {
          const { tools, requests } = setup(undefined, FAMILY);
          const response = await tools.call(`${action}_${type}`, {
            amount: 100,
            date: "2026-09-30T12:00:00",
            ...(action === "update" ? { transactionUuid: RECORD, confirmed: true } : {}),
            ...selector,
          });
          expect(response).toHaveProperty("isError", true);
          expect(result(response).error.code).toBe("ACCOUNTBOOK_CATEGORY_SELECTION");
          expect(result(response).error.message).toContain("예시 분류");
          if (type === "expense") expect(result(response).error.message).not.toContain("수입 전용");
          expect(requests.every((request) => request.method === "GET")).toBe(true);
        }
      }
    }
  });

  test("카테고리 UUID와 이름을 함께 받으면 같은 카테고리일 때만 쓴다", async () => {
    for (const action of ["create", "update"]) {
      const base = {
        amount: 100,
        date: "2026-09-30T12:00:00",
        ...(action === "update" ? { transactionUuid: RECORD, confirmed: true } : {}),
      };
      const { tools, requests } = setup(undefined, FAMILY);
      const response = await tools.call(`${action}_expense`, {
        ...base,
        categoryUuid: CATEGORY,
        categoryName: "예시 분류",
      });
      expect(response).not.toHaveProperty("isError");
      expect(requests.at(-1)?.body?.categoryUuid).toBe(CATEGORY);

      const mismatch = setup(undefined, FAMILY);
      const rejected = await mismatch.tools.call(`${action}_expense`, {
        ...base,
        categoryUuid: CATEGORY,
        categoryName: "지출 전용",
      });
      expect(result(rejected).error.code).toBe("ACCOUNTBOOK_CATEGORY_SELECTION");
      expect(result(rejected).error.message).toContain("서로 다른 카테고리");
      expect(mismatch.requests.every((request) => request.method === "GET")).toBe(true);

      // 같은 카테고리를 가리켜도 종류가 다르면 불일치가 아니라 종류 안내다.
      const wrongType = setup(undefined, FAMILY);
      const typeRejected = await wrongType.tools.call(`${action}_expense`, {
        ...base,
        categoryUuid: INCOME_CATEGORY,
        categoryName: "수입 전용",
      });
      expect(result(typeRejected).error.code).toBe("ACCOUNTBOOK_CATEGORY_SELECTION");
      expect(result(typeRejected).error.message).not.toContain("서로 다른 카테고리");
    }
  });

  test("가족이 없거나 여럿이면 자동 변경하지 않고 선택 오류를 반환한다", async () => {
    for (const families of [
      [],
      [
        { uuid: FAMILY, name: "첫 가족" },
        { uuid: CATEGORY, name: "둘째 가족" },
      ],
    ]) {
      const { tools, requests } = setup(families);
      const response = result(await tools.call("list_expenses", {}));
      expect(response.error.code).toBe(
        families.length ? "ACCOUNTBOOK_FAMILY_SELECTION" : "ACCOUNTBOOK_NO_FAMILY",
      );
      expect(requests).toHaveLength(1);
    }
  });

  test("조회는 가족과 기간, 개수, 페이지를 전달하며 빈 목록을 반환한다", async () => {
    const { tools, requests } = setup(undefined, FAMILY);
    for (const collection of ["expenses", "incomes"]) {
      const r = result(
        await tools.call(`list_${collection}`, {
          startDate: "2026-09-01",
          endDate: "2026-09-30",
          limit: 5,
          page: 2,
        }),
      );
      expect(r.items).toEqual([]);
      const url = new URL(requests.at(-1)!.url);
      expect(url.searchParams.get("size")).toBe("5");
      expect(url.searchParams.get("page")).toBe("2");
      expect(url.searchParams.get("startDate")).toBe("2026-09-01");
      expect(url.searchParams.get("endDate")).toBe("2026-09-30");
    }
  });

  test("수정과 삭제는 confirmed 없이 API를 호출하지 않는다", async () => {
    const { tools, requests } = setup(undefined, FAMILY);
    for (const type of ["expense", "income"]) {
      for (const action of ["update", "delete"]) {
        const r = result(
          await tools.call(`${action}_${type}`, { transactionUuid: RECORD, amount: 200 }),
        );
        expect(r.error.code).toBe("ACCOUNTBOOK_INVALID_INPUT");
      }
      expect(requests).toHaveLength(0);
      expect(result(await tools.call(`get_${type}`, { transactionUuid: RECORD })).uuid).toBe(
        RECORD,
      );
      await tools.call(`update_${type}`, {
        transactionUuid: RECORD,
        confirmed: true,
        description: "예시 변경",
      });
      expect(requests.at(-1)?.method).toBe("PUT");
      expect(requests.at(-1)?.body).toEqual({ description: "예시 변경" });
      expect(
        result(
          await tools.call(`delete_${type}`, {
            transactionUuid: RECORD,
            confirmed: true,
            date: "2026-09-30T12:00:00",
            amount: 100,
            description: "예시 기록",
            categoryName: "예시 분류",
          }),
        ).deleted,
      ).toBe(true);
      expect(requests.at(-1)?.method).toBe("DELETE");
      requests.length = 0;
    }
  });

  test("잘못된 금액·날짜·가족·확인·기간을 호출 전에 차단한다", async () => {
    const { tools, requests } = setup(undefined, FAMILY);
    for (const patch of [
      { amount: 0 },
      { amount: 1.001 },
      { date: "2026-02-30T12:00:00" },
      { date: "2026-09-30T24:00:00" },
      { familyUuid: "../other" },
    ]) {
      expect(
        result(
          await tools.call("create_expense", {
            amount: 100,
            date: "2026-09-30T12:00:00",
            categoryName: "예시 분류",
            ...patch,
          }),
        ).error.code,
      ).toBe("ACCOUNTBOOK_INVALID_INPUT");
    }
    expect(
      result(await tools.call("list_expenses", { startDate: "2026-09-30", endDate: "2026-09-01" }))
        .error.code,
    ).toBe("ACCOUNTBOOK_INVALID_INPUT");
    expect(
      result(await tools.call("update_expense", { transactionUuid: RECORD, confirmed: true })).error
        .code,
    ).toBe("ACCOUNTBOOK_INVALID_INPUT");
    expect(result(await tools.call("list_expenses", { limit: 101 })).error.code).toBe(
      "ACCOUNTBOOK_INVALID_INPUT",
    );
    expect(requests).toHaveLength(0);
  });

  test("다른 profile의 토큰과 기본 가족이 섞이지 않는다", async () => {
    const seen: string[] = [];
    for (const [token, family] of [
      [TOKEN, FAMILY],
      [`fab_${"y".repeat(43)}`, CATEGORY],
    ]) {
      const tools = new AccountbookTools(
        new AccountbookClient({ apiBaseUrl: BASE, apiToken: token }, async (input, init) => {
          seen.push(`${String(input)} ${new Headers(init?.headers).get("Authorization")}`);
          return json({ items: [] });
        }),
        family,
      );
      await tools.call("list_expenses", {});
    }
    expect(seen[0]).toContain(FAMILY);
    expect(seen[0]).toContain(TOKEN);
    expect(seen[1]).toContain(CATEGORY);
    expect(seen[1]).not.toContain(TOKEN);
  });

  test("오류 응답 본문과 예외 대신 안정 코드를 반환한다", async () => {
    for (const [status, code] of [
      [401, "ACCOUNTBOOK_UNAUTHORIZED"],
      [403, "ACCOUNTBOOK_FORBIDDEN"],
      [404, "ACCOUNTBOOK_NOT_FOUND"],
      [422, "ACCOUNTBOOK_BAD_REQUEST"],
      [503, "ACCOUNTBOOK_UNAVAILABLE"],
    ] as const) {
      const tools = new AccountbookTools(
        new AccountbookClient(
          { apiBaseUrl: BASE, apiToken: TOKEN },
          async () => new Response(TOKEN, { status }),
        ),
        FAMILY,
      );
      const response = await tools.call("list_expenses", {});
      expect(result(response).error.code).toBe(code);
      expect(response.content[0].text).not.toContain(TOKEN);
    }
    const tools = new AccountbookTools(
      new AccountbookClient({ apiBaseUrl: BASE, apiToken: TOKEN }, async () => {
        throw new Error(TOKEN);
      }),
      FAMILY,
    );
    expect(result(await tools.call("list_incomes", {})).error.code).toBe("ACCOUNTBOOK_NETWORK");
  });
});
