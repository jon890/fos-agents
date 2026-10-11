import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import connector from "../connector.json";
import { createServer } from "./server.ts";
import { toolDefinitions } from "./tools.ts";

// Python reader와 같은 Unicode 계약이다. 설명은 평문 표시용이며 정책이 아니다.
function readable(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(
      value,
    )
  )
    return false;
  // u 모드에서 정상 surrogate pair는 하나의 코드포인트이므로 이 식에 걸리지 않는다.
  if (/[\ud800-\udfff]/u.test(value)) return false;
  const text = value.replace(
    /^[\t\n\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\t\n\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$/gu,
    "",
  );
  return [...text].length >= 1 && [...text].length <= 2000 && Buffer.byteLength(text) <= 8192;
}

function matchesManifest(tools: Array<{ name: string; description?: string }>) {
  expect(tools.map((tool) => tool.name).sort()).toEqual(Object.keys(connector.tools).sort());
  for (const tool of tools) {
    const expected = connector.tools[tool.name as keyof typeof connector.tools].description;
    expect(readable(expected), tool.name).toBe(true);
    expect(tool.description, tool.name).toBe(expected);
    // 상세 안내 전체를 짧은 제목으로 바꾸는 회귀도 잡는다.
    expect([...expected].length, tool.name).toBeGreaterThan(100);
  }
}

test("16개 SDK 도구 설명이 manifest 정본과 같으며 API를 호출하지 않는다", async () => {
  const server = createServer(
    {
      ACCOUNTBOOK_API_BASE_URL: "https://example.invalid/api/v1",
      ACCOUNTBOOK_API_TOKEN: `fab_${"A".repeat(43)}`,
    },
    async () => {
      throw new Error("목록 탐색은 API를 호출하면 안 된다");
    },
  );
  const client = new Client({ name: "metadata-test", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(st);
    await client.connect(ct);
    const listed = (await client.listTools()).tools;
    expect(listed).toHaveLength(16);
    matchesManifest(listed);
    matchesManifest(
      Object.entries(toolDefinitions).map(([name, tool]) => ({
        name,
        description: tool.description,
      })),
    );
    for (const replacement of [undefined, "다른 설명"]) {
      const changed = listed.map((tool, index) =>
        index === 0 ? { ...tool, description: replacement } : tool,
      );
      expect(() => matchesManifest(changed)).toThrow();
    }
    expect(() => matchesManifest(listed.slice(1))).toThrow();
  } finally {
    await client.close();
    await server.close();
  }
});

test("설명 reader의 코드포인트·공백·제어문자·UTF-8 계약을 구분한다", () => {
  for (const value of [
    "가",
    "가".repeat(2000),
    "😀".repeat(2000),
    "\ufeff\u00a0 설명 \n",
    "첫 줄\t둘째 줄\n",
  ])
    expect(readable(value)).toBe(true);
  for (const value of [
    null,
    {},
    "",
    " \t\n",
    "가".repeat(2001),
    "😀".repeat(2001),
    "설명\0",
    "설명\u0085",
    "설명\u202e",
    "설명\u2066",
    "설명\ud800",
    "설명\udfff",
    "\u000b설명",
  ])
    expect(readable(value)).toBe(false);
});

test("공식 서비스와 main README 링크를 유지한다", () => {
  expect(connector.link).toBe("https://accountbook.fosworld.co.kr");
  expect(connector.link_kind).toBe("service");
  expect(connector.readme_url).toBe(
    "https://github.com/jon890/fos-agents/blob/main/accountbook/README.md",
  );
});
