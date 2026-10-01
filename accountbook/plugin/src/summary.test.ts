import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.ts";
import { type FetchLike } from "./client.ts";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const CATEGORY = "22222222-2222-4222-8222-222222222222";
const env = {
  ACCOUNTBOOK_API_BASE_URL: "https://accountbook.example.com/api/v1",
  ACCOUNTBOOK_API_TOKEN: `fab_${"x".repeat(43)}`,
  ACCOUNTBOOK_FAMILY_UUID: FAMILY,
};
const dates = { startDate: "2026-09-01", endDate: "2026-09-30" };
const json = (data: unknown) => new Response(JSON.stringify({ data }));
const item = (uuid: string, amount: string | number, excludeFromBudget = false) => ({
  uuid,
  amount,
  excludeFromBudget,
  categoryUuid: CATEGORY,
  description: null,
  date: "2026-09-15T12:00:00",
});

async function call(
  fetchImpl: FetchLike,
  name = "summarize_expenses",
  args: Record<string, unknown> = dates,
) {
  const server = createServer(env, fetchImpl);
  const client = new Client({ name: "summary-test", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(st);
    await client.connect(ct);
    const listed = await client.listTools();
    expect(listed.tools.find((t) => t.name === name)?.annotations?.readOnlyHint).toBe(true);
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
    return { isError: result.isError, data };
  } finally {
    await client.close();
    await server.close();
  }
}

test("로컬 MCP 합계는 모든 페이지와 카테고리를 한 번씩 읽고 소수 금액을 정확히 더한다", async () => {
  for (const type of ["expenses", "incomes"]) {
    const requests: string[] = [];
    const result = await call(async (input, init) => {
      expect(init?.method).toBe("GET");
      const url = new URL(String(input));
      requests.push(url.pathname);
      if (url.pathname.endsWith("/categories"))
        return json([{ uuid: CATEGORY, name: "예시 분류" }]);
      expect(url.pathname).toEndWith(`/families/${FAMILY}/${type}`);
      expect(url.searchParams.get("size")).toBe("100");
      expect(url.searchParams.get("startDate")).toBe(dates.startDate);
      expect(url.searchParams.get("endDate")).toBe(dates.endDate);
      const page = Number(url.searchParams.get("page"));
      return json({
        items: page === 0 ? [item("first", 0.1)] : [item("second", "0.20", true)],
        totalPages: 2,
        totalElements: 2,
        currentPage: page,
      });
    }, `summarize_${type}`);
    expect(result.isError).not.toBe(true);
    expect(result.data).toEqual({
      familyUuid: FAMILY,
      ...dates,
      count: 2,
      totalAmount: "0.30",
      excludedFromBudgetAmount: type === "expenses" ? "0.20" : "0.00",
      categories: [
        { categoryUuid: CATEGORY, categoryName: "예시 분류", count: 2, totalAmount: "0.30" },
      ],
    });
    expect(requests).toHaveLength(3);
  }
});

test("빈 기간은 0건과 0.00을 반환한다", async () => {
  const result = await call(async (input) =>
    String(input).endsWith("/categories")
      ? json([])
      : json({ items: [], totalPages: 0, totalElements: 0, currentPage: 0 }),
  );
  expect(result.data.count).toBe(0);
  expect(result.data.totalAmount).toBe("0.00");
  expect(result.data.categories).toEqual([]);
});

test("기본 가족이 없으면 단일 가족을 선택하고 수입을 카테고리별로 나눈다", async () => {
  const server = createServer({ ...env, ACCOUNTBOOK_FAMILY_UUID: "" }, async (input) => {
    const url = String(input);
    if (url.endsWith("/families")) return json([{ uuid: FAMILY, name: "예시 가족" }]);
    if (url.endsWith("/categories")) return json([{ uuid: CATEGORY, name: "예시 분류" }]);
    expect(url).toContain(`/families/${FAMILY}/incomes?`);
    const { excludeFromBudget: _ignored, ...income } = item("first", "1.01");
    return json({
      items: [income, { ...income, uuid: "second", categoryUuid: "missing", amount: "2.02" }],
      totalPages: 1,
      totalElements: 2,
      currentPage: 0,
    });
  });
  const client = new Client({ name: "family-summary-test", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(st);
    await client.connect(ct);
    const response = await client.callTool({ name: "summarize_incomes", arguments: dates });
    expect(response.isError).not.toBe(true);
    const data = JSON.parse((response.content as Array<{ text: string }>)[0]!.text);
    expect(data.totalAmount).toBe("3.03");
    expect(data.excludedFromBudgetAmount).toBe("0.00");
    expect(data.categories).toEqual([
      { categoryUuid: CATEGORY, categoryName: "예시 분류", count: 1, totalAmount: "1.01" },
      { categoryUuid: "missing", categoryName: null, count: 1, totalAmount: "2.02" },
    ]);
  } finally {
    await client.close();
    await server.close();
  }
});

test("100페이지까지 허용하고 큰 합계도 정밀도를 잃지 않는다", async () => {
  let pages = 0;
  const result = await call(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/categories")) return json([]);
    const page = Number(url.searchParams.get("page"));
    pages++;
    return json({
      items: Array.from({ length: 100 }, (_, i) => item(`${page}-${i}`, "9999999999.99")),
      totalPages: 100,
      totalElements: 10000,
      currentPage: page,
    });
  });
  expect(pages).toBe(100);
  expect(result.data.totalAmount).toBe("99999999999900.00");
  expect(result.data.categories[0].categoryName).toBe(null);
});

test("상한 초과와 페이지 오류, 조회 중 변경, 잘못된 금액은 부분 합계를 반환하지 않는다", async () => {
  for (const scenario of [
    "limit",
    "page",
    "count",
    "duplicate",
    "changed",
    "amount",
    "missing",
    "network",
  ]) {
    let pages = 0;
    const result = await call(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/categories")) return json([]);
      const page = Number(url.searchParams.get("page"));
      pages++;
      if (scenario === "network" && page === 1) throw new Error("fake network");
      const record = item(
        scenario === "duplicate" ? "same" : String(page),
        scenario === "amount" ? 0.001 : "1.01",
      );
      const records =
        scenario === "missing" ? [{ ...record, excludeFromBudget: undefined }] : [record];
      return json({
        items: records,
        totalPages: scenario === "limit" ? 101 : 2,
        totalElements: scenario === "count" ? 3 : scenario === "changed" && page === 1 ? 3 : 2,
        currentPage: scenario === "page" ? 9 : page,
      });
    });
    expect(result.isError).toBe(true);
    expect(result.data).not.toHaveProperty("totalAmount");
    expect(result.data.error.code).toBe(
      scenario === "limit"
        ? "ACCOUNTBOOK_SUMMARY_LIMIT"
        : scenario === "network"
          ? "ACCOUNTBOOK_NETWORK"
          : "ACCOUNTBOOK_INVALID_RESPONSE",
    );
    if (scenario === "limit") {
      expect(pages).toBe(1);
      expect(result.data.error.message).toContain("기간을 줄여");
    }
  }
});

test("필수 기간과 날짜 순서를 검증하고 API 호출을 차단한다", async () => {
  for (const args of [
    {},
    { startDate: "2026-09-30", endDate: "2026-09-01" },
    { startDate: "2026-02-30", endDate: "2026-09-30" },
  ]) {
    let calls = 0;
    const result = await call(
      async () => {
        calls++;
        return json([]);
      },
      "summarize_expenses",
      args,
    );
    expect(result.isError).toBe(true);
    expect(calls).toBe(0);
  }
});
