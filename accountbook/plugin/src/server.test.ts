import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtempSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "./server.ts";
import { AccountbookError } from "./client.ts";

const env = {
  ACCOUNTBOOK_API_BASE_URL: "https://accountbook.example.com/api/v1",
  ACCOUNTBOOK_API_TOKEN: `fab_${"x".repeat(43)}`,
  ACCOUNTBOOK_FAMILY_UUID: "11111111-1111-4111-8111-111111111111",
};

test("MCP 삭제는 data 생략과 null, 204를 모두 성공으로 반환한다", async () => {
  for (const name of ["delete_expense", "delete_income"]) {
    for (const body of [{ success: true, message: "삭제되었습니다" }, { data: null }, null]) {
      const server = createServer(env, async (_input, init) => {
        expect(init?.method).toBe("DELETE");
        return body === null
          ? new Response(null, { status: 204 })
          : new Response(JSON.stringify(body));
      });
      const client = new Client({ name: "delete-test", version: "1.0.0" });
      const [ct, st] = InMemoryTransport.createLinkedPair();
      try {
        await server.connect(st);
        await client.connect(ct);
        const result = await client.callTool({
          name,
          arguments: {
            transactionUuid: "33333333-3333-4333-8333-333333333333",
            confirmed: true,
          },
        });
        expect(result.isError).not.toBe(true);
        expect(JSON.parse((result.content as Array<{ text: string }>)[0]!.text).deleted).toBe(true);
      } finally {
        await client.close();
        await server.close();
      }
    }
  }
});

test("Hermes가 남긴 변수 참조를 선택 설정으로 쓰지 않는다", async () => {
  const server = createServer(
    { ...env, ACCOUNTBOOK_FAMILY_UUID: "${ACCOUNTBOOK_FAMILY_UUID}" },
    async (input) => {
      expect(String(input)).toEndWith("/families");
      return new Response(JSON.stringify({ data: [] }));
    },
  );
  const client = new Client({ name: "env-test", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(st);
    await client.connect(ct);
    const result = await client.callTool({ name: "list_families", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: JSON.stringify({ families: [], defaultFamilyUuid: null }) },
    ]);
    expect(result.structuredContent).toEqual({ families: [], defaultFamilyUuid: null });
  } finally {
    await client.close();
    await server.close();
  }
  for (const key of ["ACCOUNTBOOK_API_BASE_URL", "ACCOUNTBOOK_API_TOKEN"]) {
    try {
      createServer({ ...env, [key]: "${UNSET}" });
      throw new Error("expected config error");
    } catch (error) {
      expect(error).toBeInstanceOf(AccountbookError);
      expect((error as AccountbookError).code).toBe("ACCOUNTBOOK_CONFIG");
    }
  }
});

test("MCP 프로토콜로 도구를 탐색하고 조회하며 미확인 삭제를 차단한다", async () => {
  let calls = 0;
  const server = createServer(env, async () => {
    calls++;
    return new Response(
      JSON.stringify({ data: { items: [], totalPages: 0, totalElements: 0, currentPage: 0 } }),
    );
  });
  const client = new Client({ name: "test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(16);
    expect(listed.tools.map((tool) => tool.name)).not.toContain("summarize_expenses");
    expect(listed.tools.map((tool) => tool.name)).not.toContain("summarize_incomes");
    const response = await client.callTool({ name: "list_expenses", arguments: { limit: 3 } });
    expect(response.isError).not.toBe(true);
    expect(calls).toBe(1);
    const blocked = await client.callTool({
      name: "delete_expense",
      arguments: { transactionUuid: "33333333-3333-4333-8333-333333333333" },
    });
    expect(blocked.isError).toBe(true);
    expect(calls).toBe(1);
  } finally {
    await client.close();
    await server.close();
  }
});

test("MCP 입력 검증 실패도 도구 오류 코드가 담긴 JSON으로 답한다", async () => {
  let calls = 0;
  const server = createServer(env, async () => {
    calls++;
    return new Response(JSON.stringify({ data: [] }));
  });
  const client = new Client({ name: "invalid-input-test", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(st);
    await client.connect(ct);
    for (const [name, args, code] of [
      [
        "update_expense",
        { transactionUuid: "33333333-3333-4333-8333-333333333333", confirmed: true },
        "ACCOUNTBOOK_INVALID_INPUT",
      ],
      [
        "update_expense",
        { transactionUuid: "x", amount: "100", confirmed: true },
        "ACCOUNTBOOK_INVALID_INPUT",
      ],
      [
        "create_expense",
        { amount: 100, date: "2026-09-30T12:00:00", categoryName: "예시", extra: 1 },
        "ACCOUNTBOOK_INVALID_INPUT",
      ],
      ["unknown_tool", {}, "ACCOUNTBOOK_UNKNOWN_TOOL"],
    ] as const) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBe(true);
      const payload = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
      expect(payload.error.code).toBe(code);
    }
    expect(calls).toBe(0);
  } finally {
    await client.close();
    await server.close();
  }
});

test("plugin 실행 파일만 복사해도 의존성 설치 없이 stdio로 시작한다", async () => {
  const root = mkdtempSync(join(tmpdir(), "accountbook-standalone-"));
  const client = new Client({ name: "bundle-test", version: "1.0.0" });
  const entry = join(root, "accountbook-mcp.js");
  copyFileSync(join(import.meta.dir, "../dist/accountbook-mcp.js"), entry);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    cwd: root,
    env,
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(16);
    expect(stderr).toBe("");
  } finally {
    await client.close();
    rmSync(root, { recursive: true, force: true });
  }
});
