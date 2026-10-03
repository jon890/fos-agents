import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "../src/server.ts";
import { toolDefinitions } from "../src/tools.ts";

const read = (name: string) => JSON.parse(readFileSync(join(import.meta.dir, "..", name), "utf8"));
const connector = read("connector.json");
const mcp = read(".mcp.json");

type ToolPolicy = { risk: string; approval: string; title?: string };
const policies = Object.entries(connector.tools as Record<string, ToolPolicy>);

test("schema 2 정책은 실제 MCP 도구를 빠짐없이 선언하고 미선언 도구를 거절한다", () => {
  expect(connector.schema).toBe(2);
  expect(connector.default_tool_policy).toBe("deny");
  expect(Object.keys(connector.tools).sort()).toEqual(Object.keys(toolDefinitions).sort());
});

test("확인 도구는 승인 없는 READ 정책이고 서버가 readOnlyHint 로 표시한다", () => {
  expect(connector.tools[connector.verify.tool]).toMatchObject({ risk: "READ", approval: "none" });
  const registered = (
    createServer({
      CAREER_BACKEND_URL: "https://career.example.com/",
      CAREER_BACKEND_TOKEN: "x".repeat(40),
      CAREER_GITHUB_PROFILE_REPO: "example-user/example-user",
    }) as any
  )._registeredTools as Record<string, { annotations?: { readOnlyHint?: boolean } }>;
  expect(registered[connector.verify.tool]?.annotations?.readOnlyHint).toBe(true);
});

test("조회 도구는 READ 와 none, 저장과 갱신 도구는 WRITE 와 required 다", () => {
  for (const [name, policy] of policies) {
    if (/^(check|list|get)_/.test(name))
      expect({ name, ...policy }).toMatchObject({ name, risk: "READ", approval: "none" });
    if (/^(save|update)_/.test(name))
      expect({ name, ...policy }).toMatchObject({ name, risk: "WRITE", approval: "required" });
  }
});

test("모든 도구에 승인 카드에 보일 80자 이하의 title 이 있다", () => {
  for (const [name, policy] of policies) {
    expect({ name, hasTitle: typeof policy.title === "string" && policy.title.length > 0 }).toEqual({
      name,
      hasTitle: true,
    });
    expect(policy.title!.length).toBeLessThanOrEqual(80);
  }
});

test(".mcp.json 서버 env 는 fields[].env 와 operator_env 의 합과 같다", () => {
  const expected = [
    ...connector.fields.map((f: { env: string }) => f.env),
    ...connector.operator_env,
  ].sort();
  const server = mcp.mcpServers.career.env;
  expect(Object.keys(server).sort()).toEqual(expected);
  for (const [name, value] of Object.entries(server))
    expect(String(value)).toMatch(new RegExp(`^\\$\\{${name}(:-)?\\}$`));
});

test("errors 표의 값은 공통 어휘만 쓴다", () => {
  const vocabulary = ["credential_rejected", "forbidden", "invalid_input", "unavailable"];
  for (const value of Object.values(connector.errors) as string[]) expect(vocabulary).toContain(value);
});

test("운영자 비밀값과 사진 도구 묶음을 선언하지 않는다", () => {
  for (const key of ["operator_secrets", "toolsets", "attachments"])
    expect(Object.hasOwn(connector, key)).toBe(false);
});

test("plugin.json 과 package.json 의 version 이 같다", () => {
  expect(read(".claude-plugin/plugin.json").version).toBe(read("package.json").version);
});

test("도구는 열이고 WRITE 는 저장 도구 둘과 GitHub 갱신 도구뿐이며 모두 승인이 필요하다", () => {
  expect(Object.keys(connector.tools)).toHaveLength(10);
  const writes = policies.filter(([, policy]) => policy.risk === "WRITE");
  expect(writes.map(([name]) => name).sort()).toEqual([
    "save_context_document",
    "save_profile_document",
    "update_github_profile",
  ]);
  for (const [name, policy] of writes) expect({ name, approval: policy.approval }).toEqual({ name, approval: "required" });
});

test("errors 는 data-schema.md 의 커넥터 오류 코드 표에서 공통 어휘가 있는 줄과 같다", () => {
  const doc = readFileSync(join(import.meta.dir, "../../docs/data-schema.md"), "utf8");
  const section = doc.split("### 커넥터 오류 코드")[1]?.split(/\n#{2,3} /)[0];
  expect(section).toBeDefined();
  const expected: Record<string, string> = {};
  for (const line of section!.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    // A table row is "| code | condition | vocabulary |": empty first and last cells around three.
    if (cells.length !== 5) continue;
    const code = cells[1]!.match(/^`([A-Z_]+)`$/)?.[1];
    const vocabulary = cells[3]!.match(/^`([a-z_]+)`$/)?.[1];
    if (code && vocabulary) expected[code] = vocabulary;
  }
  expect(Object.keys(expected).length).toBeGreaterThan(0);
  expect(connector.errors).toEqual(expected);
});
