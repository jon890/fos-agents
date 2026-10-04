import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

test("확인 도구는 승인 없는 READ 정책이고 서버가 확인 도구와 조사 도구 둘을 readOnlyHint 로 표시한다", async () => {
  expect(connector.tools[connector.verify.tool]).toMatchObject({ risk: "READ", approval: "none" });
  const server = createServer({
    CAREER_BACKEND_URL: "https://career.example.com/",
    CAREER_BACKEND_TOKEN: "x".repeat(40),
    CAREER_GITHUB_PROFILE_REPO: "example-user/example-user",
  });
  const client = new Client({ name: "connector-config-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    const verifyTool = tools.find((tool) => tool.name === connector.verify.tool);
    expect(verifyTool?.annotations?.readOnlyHint).toBe(true);
    // The research tools are read by an agent that picks its own topics, so they must never look writable.
    for (const name of ["list_study_candidates", "get_position_research_constraints"]) {
      const tool = tools.find((candidate) => candidate.name === name);
      expect({ name, readOnly: tool?.annotations?.readOnlyHint, destructive: tool?.annotations?.destructiveHint }).toEqual({
        name,
        readOnly: true,
        destructive: false,
      });
    }
  } finally {
    await client.close();
    await server.close();
  }
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

test("도구는 열여덟이고 WRITE 는 저장 도구 다섯과 GitHub 갱신 도구뿐이며 모두 승인이 필요하다", () => {
  expect(Object.keys(connector.tools)).toHaveLength(18);
  const writes = policies.filter(([, policy]) => policy.risk === "WRITE");
  expect(writes.map(([name]) => name).sort()).toEqual([
    "save_context_document",
    "save_interview_attempt",
    "save_personal_question",
    "save_profile_document",
    "save_study_recommendation",
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

const connectorSkillsDirectory = join(import.meta.dir, "..", "connector-skills");

function skillBodyOf(directory: string): string {
  for (const entry of readdirSync(directory, { recursive: true }))
    if (lstatSync(join(directory, String(entry))).isSymbolicLink()) throw new Error(`심볼릭 링크가 있다: ${entry}`);
  let body = "";
  for (const name of readdirSync(directory).sort()) {
    const text = readFileSync(join(directory, name, "SKILL.md"), "utf8");
    if (!text.startsWith("---\n")) throw new Error(`${name} 의 앞머리가 없다`);
    const end = text.indexOf("\n---\n", 4);
    if (end < 0) throw new Error(`${name} 의 앞머리가 닫히지 않는다`);
    body += text.slice(end + 5).trim() + "\n\n";
  }
  if (body.length > 8000) throw new Error(`스킬 본문이 ${body.length}자로 8000자를 넘는다`);
  return body;
}

test("스킬 본문은 설치하는 쪽의 지침 상한 안에 있고 링크가 없다", () => {
  const body = skillBodyOf(connectorSkillsDirectory);
  expect(body.length).toBeGreaterThan(0);
  for (const tool of Object.keys(connector.tools)) expect(body, tool).toContain(tool);
});

test("스킬을 노트북 에이전트의 스킬 폴더에 링크하지 않는다", () => {
  const repoSkills = join(import.meta.dir, "../../.claude/skills");
  expect(existsSync(join(repoSkills, "career-connector"))).toBe(false);
  expect(existsSync(join(repoSkills, "interview-practice"))).toBe(false);
  const stat = lstatSync(join(repoSkills, "study-topic-recommender"));
  expect(stat.isSymbolicLink(), "study-topic-recommender 가 심볼릭 링크다").toBe(false);
  expect(stat.isDirectory(), "study-topic-recommender 가 디렉터리가 아니다").toBe(true);
});

test("새 스킬은 셸과 저장소 경로를 쓰지 않고 앞머리가 디렉터리와 맞는다", () => {
  for (const name of ["interview-practice", "study-topic-recommender"]) {
    const text = readFileSync(join(connectorSkillsDirectory, name, "SKILL.md"), "utf8");
    const end = text.indexOf("\n---\n", 4);
    const front = text.slice(4, end);
    const body = text.slice(end + 5);
    for (const banned of ["career-os/", "bun ", "git "]) expect(body, `${name} 본문에 ${banned}`).not.toContain(banned);
    expect(front.match(/^name: (.+)$/m)?.[1], `${name} 의 name`).toBe(name);
    const description = front.match(/^description: (.+)$/m)?.[1] ?? "";
    expect(description.length, `${name} 의 description`).toBeGreaterThan(0);
    expect(description.length, `${name} 의 description 길이`).toBeLessThanOrEqual(1024);
  }
});

test("본문이 8001자인 스킬과 닫히지 않은 앞머리는 거절한다", () => {
  const root = mkdtempSync(join(tmpdir(), "career-skills-"));
  mkdirSync(join(root, "long"));
  const head = "---\nname: long\ndescription: x\n---\n";
  const fill = (size: number) => "가".repeat(size) + "\n";
  writeFileSync(join(root, "long", "SKILL.md"), head + fill(7998));
  expect(skillBodyOf(root).length).toBe(8000);
  writeFileSync(join(root, "long", "SKILL.md"), head + fill(7999));
  expect(() => skillBodyOf(root)).toThrow("8000자를 넘는다");
  writeFileSync(join(root, "long", "SKILL.md"), "---\nname: long\n");
  expect(() => skillBodyOf(root)).toThrow("닫히지 않는다");
});

test("plugin.json 의 skills 는 connector-skills 하나만 가리킨다", () => {
  expect(read(".claude-plugin/plugin.json").skills).toBe("./connector-skills");
});

test("Claude Code 전용 skills 와 대화용 connector-skills 에 같은 이름의 스킬이 없다", () => {
  const codeSkills = join(import.meta.dir, "..", "skills");
  const codeNames = existsSync(codeSkills) ? readdirSync(codeSkills) : [];
  const shared = codeNames.filter((name) => readdirSync(connectorSkillsDirectory).includes(name));
  expect(shared).toEqual([]);
});
