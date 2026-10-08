import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  utimesSync,
  statSync,
  symlinkSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "./server.ts";
import { type FetchLike } from "./client.ts";
import { AccountbookTools } from "./tools.ts";
import { AccountbookClient } from "./client.ts";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const CATEGORY = "22222222-2222-4222-8222-222222222222";
const env = {
  ACCOUNTBOOK_API_BASE_URL: "https://accountbook.example.com/api/v1",
  ACCOUNTBOOK_API_TOKEN: `fab_${"x".repeat(43)}`,
  ACCOUNTBOOK_FAMILY_UUID: FAMILY,
};
const dates = { startDate: "2026-09-01", endDate: "2026-09-30", output: "file" };
const json = (data: unknown) => new Response(JSON.stringify({ data }));
const item = (uuid: string) => ({
  uuid,
  amount: "100.00",
  excludeFromBudget: false,
  categoryUuid: CATEGORY,
  userUuid: "example-user",
  description: "예시 거래",
  date: "2026-09-15T12:00:00",
  recurringExpenseUuid: null,
  secret: "must-not-export",
});
const pageData = (
  items: unknown[],
  totalPages = 1,
  totalElements = items.length,
  currentPage = 0,
) => ({ items, totalPages, totalElements, currentPage });
const directory = () => mkdtempSync(join(tmpdir(), "accountbook-output-"));

async function call(
  fetchImpl: FetchLike,
  outputDirectory: string | undefined,
  name = "list_expenses",
  args = dates,
) {
  const server = createServer({ ...env, ACCOUNTBOOK_OUTPUT_DIR: outputDirectory }, fetchImpl);
  const client = new Client({ name: "output-test", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(st);
    await client.connect(ct);
    const listed = await client.listTools();
    expect(listed.tools.find((t) => t.name === name)?.annotations?.readOnlyHint).toBe(true);
    const result = await client.callTool({ name, arguments: args });
    return {
      isError: result.isError,
      data: JSON.parse((result.content as Array<{ text: string }>)[0]!.text),
    };
  } finally {
    await client.close();
    await server.close();
  }
}

test("파일 출력은 전체 페이지를 합쳐 지정한 칸만 저장하고 내용 없는 메타데이터로 답한다", async () => {
  const root = directory();
  try {
    for (const type of ["expenses", "incomes"]) {
      const requests: string[] = [];
      const result = await call(
        async (input, init) => {
          expect(init?.method).toBe("GET");
          const url = new URL(String(input));
          requests.push(url.pathname);
          if (url.pathname.endsWith("/categories"))
            return json([{ uuid: CATEGORY, name: "예시 분류", type: "EXPENSE" }]);
          expect(url.pathname).toEndWith(`/families/${FAMILY}/${type}`);
          expect(url.searchParams.get("size")).toBe("100");
          expect(url.searchParams.get("startDate")).toBe(dates.startDate);
          expect(url.searchParams.get("endDate")).toBe(dates.endDate);
          const page = Number(url.searchParams.get("page"));
          const record = item(String(page));
          if (type === "incomes") delete (record as Partial<typeof record>).excludeFromBudget;
          return json(pageData([record], 2, 2, page));
        },
        root,
        `list_${type}`,
        { ...dates, limit: 1, page: 9 } as typeof dates,
      );
      expect(result.isError).not.toBe(true);
      expect(Object.keys(result.data).sort()).toEqual(
        ["file", "count", "from", "to", "columns"].sort(),
      );
      expect(result.data).toMatchObject({ count: 2, from: dates.startDate, to: dates.endDate });
      expect(result.data.file).toStartWith(join(root, `list_${type}-`));
      const rows = readFileSync(result.data.file, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        amount: 100,
        categoryName: "예시 분류",
        userUuid: "example-user",
        excludeFromBudget: false,
      });
      expect(Object.keys(rows[0])).toEqual(result.data.columns);
      expect(rows[0]).not.toHaveProperty("secret");
      expect(statSync(result.data.file).mode & 0o777).toBe(0o600);
      expect(requests).toHaveLength(3);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("빈 기간은 빈 JSONL 파일을 만들고 새 조회는 기존 파일을 덮지 않는다", async () => {
  const root = directory();
  try {
    const fetchImpl: FetchLike = async (input) =>
      String(input).endsWith("/categories") ? json([]) : json(pageData([], 0));
    const first = await call(fetchImpl, root);
    const second = await call(fetchImpl, root);
    expect(first.data.count).toBe(0);
    expect(readFileSync(first.data.file, "utf8")).toBe("");
    expect(second.data.file).not.toBe(first.data.file);
    expect(readdirSync(root)).toHaveLength(2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("빈 출력 설정과 치환 안 된 변수는 API 호출 전에 unavailable 로 거절한다", async () => {
  for (const setting of [undefined, "", "  ", "${ACCOUNTBOOK_OUTPUT_DIR}"]) {
    let requests = 0;
    const result = await call(async () => {
      requests++;
      return json([]);
    }, setting);
    expect(result.data.error.code).toBe("ACCOUNTBOOK_OUTPUT_UNAVAILABLE");
    expect(requests).toBe(0);
  }
});

test("파일 모드는 유효한 전체 기간을 요구하고 이름과 경로 인자를 받지 않는다", async () => {
  for (const args of [
    { output: "file" },
    { ...dates, startDate: "2026-09-30", endDate: "2026-09-01" },
    { ...dates, startDate: "2026-02-30" },
    { ...dates, file: "other.jsonl" },
    { ...dates, path: "../outside" },
    { ...dates, outputDirectory: "/tmp" },
    { ...dates, output: "other" },
  ]) {
    let requests = 0;
    const result = await call(
      async () => {
        requests++;
        return json([]);
      },
      "/tmp",
      "list_expenses",
      args as typeof dates,
    );
    expect(result.data.error.code).toBe("ACCOUNTBOOK_INVALID_INPUT");
    expect(requests).toBe(0);
  }
});

test("24시간 지난 자기 파일만 지우고 다른 파일·디렉터리·심볼릭 링크는 남긴다", async () => {
  const root = directory();
  const now = new Date("2026-10-08T12:00:00Z");
  const old = "list_expenses-2026-10-01T00-00-00-000Z-11111111-1111-4111-8111-111111111111.jsonl";
  const recent = old.replace("expenses", "incomes");
  const link = old.replace("11111111", "22222222");
  const dir = old.replace("11111111", "33333333");
  try {
    for (const name of [old, recent, "other.jsonl", "list_expenses-unrelated.jsonl"]) {
      writeFileSync(join(root, name), "keep");
      const mtime = new Date(now.getTime() - (name === recent ? 24 : 25) * 3600000);
      utimesSync(join(root, name), mtime, mtime);
    }
    symlinkSync(join(root, "other.jsonl"), join(root, link));
    mkdirSync(join(root, dir));
    const tools = new AccountbookTools(
      new AccountbookClient(
        { apiBaseUrl: env.ACCOUNTBOOK_API_BASE_URL, apiToken: env.ACCOUNTBOOK_API_TOKEN },
        async (input) => (String(input).endsWith("/categories") ? json([]) : json(pageData([], 0))),
      ),
      FAMILY,
      () => now,
      root,
    );
    const result = await tools.call("list_expenses", dates);
    expect("isError" in result && result.isError).not.toBe(true);
    const files = readdirSync(root);
    expect(files).not.toContain(old);
    for (const name of [recent, link, dir, "other.jsonl", "list_expenses-unrelated.jsonl"])
      expect(files).toContain(name);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("상한·페이지 누락·중복·건수 변경·비정수 금액·조회 실패는 파일 없이 끝난다", async () => {
  const root = directory();
  try {
    for (const scenario of [
      "limit",
      "countLimit",
      "page",
      "count",
      "duplicate",
      "changed",
      "pagesChanged",
      "amount",
      "missing",
      "emptyPage",
      "outside",
      "oversizedPage",
      "network",
    ]) {
      const result = await call(async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/categories")) return json([]);
        const page = Number(url.searchParams.get("page"));
        if (scenario === "network" && page === 1) throw new Error(env.ACCOUNTBOOK_API_TOKEN);
        const record = item(scenario === "duplicate" ? "same" : String(page));
        if (scenario === "amount") record.amount = "1.01";
        if (scenario === "missing") delete (record as Partial<typeof record>).userUuid;
        if (scenario === "outside") record.date = "2026-08-31T12:00:00";
        return json(
          pageData(
            scenario === "emptyPage"
              ? []
              : scenario === "oversizedPage"
                ? Array.from({ length: 101 }, (_, i) => item(String(i)))
                : [record],
            scenario === "limit" ? 101 : scenario === "pagesChanged" && page === 1 ? 3 : 2,
            scenario === "countLimit"
              ? 10001
              : scenario === "count" || (scenario === "changed" && page === 1)
                ? 3
                : 2,
            scenario === "page" ? 9 : page,
          ),
        );
      }, root);
      expect(result.isError).toBe(true);
      expect(result.data.error.code).toBe(
        ["limit", "countLimit"].includes(scenario)
          ? "ACCOUNTBOOK_OUTPUT_LIMIT"
          : scenario === "network"
            ? "ACCOUNTBOOK_NETWORK"
            : "ACCOUNTBOOK_INVALID_RESPONSE",
      );
      expect(JSON.stringify(result.data)).not.toContain(env.ACCOUNTBOOK_API_TOKEN);
      expect(readdirSync(root)).toEqual([]);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("상한인 10,000건을 100페이지에서 내보낸다", async () => {
  const root = directory();
  try {
    const result = await call(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/categories")) return json([]);
      const page = Number(url.searchParams.get("page"));
      return json(
        pageData(
          Array.from({ length: 100 }, (_, i) => item(`${page}-${i}`)),
          100,
          10000,
          page,
        ),
      );
    }, root);
    expect(result.data.count).toBe(10000);
    expect(readFileSync(result.data.file, "utf8").split("\n")).toHaveLength(10001);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("존재하지 않는 출력 디렉터리의 오류에 시스템 오류 원문을 넣지 않는다", async () => {
  const result = await call(
    async (input) => (String(input).endsWith("/categories") ? json([]) : json(pageData([], 0))),
    "/nonexistent-accountbook-output",
  );
  expect(result.isError).toBe(true);
  expect(result.data.error.code).toBe("ACCOUNTBOOK_OUTPUT_UNAVAILABLE");
  expect(JSON.stringify(result.data)).not.toContain("ENOENT");
});
