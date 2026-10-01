import { expect, test } from "bun:test";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "../src/server.ts";

const read = (name: string) => JSON.parse(readFileSync(join(import.meta.dir, "..", name), "utf8"));
const connector = read("connector.json");
const mcp = read(".mcp.json");

test("connector.json 의 .mcp.json 서버 env 는 fields[].env 와 operator_env 의 합과 같다", () => {
  const expected = [
    ...connector.fields.map((f: { env: string }) => f.env),
    ...connector.operator_env,
  ].sort();
  const server = mcp.mcpServers.accountbook.env;
  expect(Object.keys(server).sort()).toEqual(expected);
  for (const [name, value] of Object.entries(server))
    expect(String(value)).toMatch(new RegExp(`^\\$\\{${name}(:-)?\\}$`));
});

test("options.tool 과 verify.tool 은 readOnlyHint 가 true 인 도구다", () => {
  const registered = (
    createServer({
      ACCOUNTBOOK_API_BASE_URL: "https://example.invalid/api/v1",
      ACCOUNTBOOK_API_TOKEN: `fab_${"A".repeat(43)}`,
    }) as any
  )._registeredTools as Record<string, { annotations?: { readOnlyHint?: boolean } }>;
  const tools = [
    connector.verify.tool,
    ...connector.fields.flatMap((f: { options?: { tool: string } }) =>
      f.options ? [f.options.tool] : [],
    ),
  ];
  for (const tool of tools) expect(registered[tool]?.annotations?.readOnlyHint).toBe(true);
});

test("errors 표의 값은 공통 어휘만 쓴다", () => {
  const vocabulary = ["credential_rejected", "forbidden", "invalid_input", "unavailable"];
  for (const value of Object.values(connector.errors) as string[])
    expect(vocabulary).toContain(value);
});

test("사진을 받는 커넥터는 이미지를 보는 도구 묶음만 요청한다", () => {
  expect(connector.toolsets).toEqual(["vision"]);
  expect(connector.attachments).toBe(true);
});

test("스킬 본문은 설치하는 쪽의 지침 상한 안에 있고 링크가 없다", () => {
  const skills = join(import.meta.dir, "..", "skills");
  let body = "";
  for (const name of readdirSync(skills)) {
    const skill = join(skills, name);
    expect(lstatSync(skill).isSymbolicLink()).toBe(false);
    const file = join(skill, "SKILL.md");
    expect(lstatSync(file).isSymbolicLink()).toBe(false);
    const text = readFileSync(file, "utf8");
    expect(text.startsWith("---\n")).toBe(true);
    const end = text.indexOf("\n---\n", 4);
    expect(end).toBeGreaterThan(0);
    body += text.slice(end + 5).trim() + "\n\n";
  }
  expect(body.length).toBeLessThanOrEqual(8000);
});
