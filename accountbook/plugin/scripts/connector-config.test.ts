import { expect, test } from "bun:test";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "../src/server.ts";
import { toolDefinitions } from "../src/tools.ts";

const read = (name: string) => JSON.parse(readFileSync(join(import.meta.dir, "..", name), "utf8"));
const connector = read("connector.json");
const mcp = read(".mcp.json");

test("schema 2 정책은 실제 MCP 도구를 빠짐없이 선언하고 미선언 도구를 거절한다", () => {
  expect(connector.schema).toBe(2);
  expect(connector.default_tool_policy).toBe("deny");
  expect(Object.keys(connector.tools).sort()).toEqual(Object.keys(toolDefinitions).sort());
});

test("확인 도구와 선택지 도구는 승인 없는 READ 정책이다", () => {
  const tools = [
    connector.verify.tool,
    ...connector.fields.flatMap((field: { options?: { tool: string } }) =>
      field.options ? [field.options.tool] : [],
    ),
  ];
  for (const name of tools) {
    expect(connector.tools[name]).toMatchObject({ risk: "READ", approval: "none" });
  }
});

test("조회와 미리보기는 READ, 등록과 수정은 승인이 필요한 WRITE다", () => {
  const readTools = [
    "list_families",
    "list_categories",
    "list_expenses",
    "list_incomes",
    "get_expense",
    "get_income",
    "preview_screenshot_import",
    "list_recurring_expenses",
  ];
  const writeTools = [
    "create_expense",
    "create_income",
    "update_expense",
    "update_income",
    "submit_screenshot_import",
    "update_recurring_expense",
  ];

  for (const name of readTools) {
    expect(connector.tools[name]).toMatchObject({ risk: "READ", approval: "none" });
  }

  for (const name of writeTools) {
    expect(connector.tools[name]).toMatchObject({ risk: "WRITE", approval: "required" });
  }
});

test("삭제는 호출을 닫는 DESTRUCTIVE 정책이며 상시 허락을 받지 않는다", () => {
  for (const name of ["delete_expense", "delete_income"]) {
    expect(connector.tools[name]).toMatchObject({ risk: "DESTRUCTIVE", approval: "always" });
  }
});

test("서버 env 는 입력 칸과 운영자 설정, 사용자별 출력 디렉터리의 합과 같다", () => {
  const expected = [
    ...connector.fields.map((f: { env: string }) => f.env),
    ...connector.operator_env,
    connector.owner_output_env,
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

test("errors 표의 값은 공통 어휘와 복구 계약만 쓴다", () => {
  const vocabulary = ["credential_rejected", "forbidden", "invalid_input", "unavailable"];
  const recovery = ["recheck", "reconnect", "fix_input", "retry_later"];
  for (const value of Object.values(connector.errors) as Array<
    string | { category: string; recovery?: string }
  >) {
    if (typeof value === "string") {
      expect([...vocabulary, "outcome_unknown"]).toContain(value);
      continue;
    }
    expect(vocabulary).toContain(value.category);
    if (value.recovery !== undefined) expect(recovery).toContain(value.recovery);
  }
});

test("승인한 실행의 입력 오류는 unavailable 로 묻히지 않는다", () => {
  // 표에 없는 코드는 fos-assistant 가 unavailable 로 기록한다. 인자를 고치면 되는 오류는 표에 둔다.
  for (const code of [
    "ACCOUNTBOOK_INVALID_INPUT",
    "ACCOUNTBOOK_CATEGORY_SELECTION",
    "ACCOUNTBOOK_FAMILY_SELECTION",
    "ACCOUNTBOOK_NOT_FOUND",
    "ACCOUNTBOOK_IMPORT_CONFIRMATION_MISMATCH",
    "ACCOUNTBOOK_IMPORT_NOT_SUBMITTABLE",
  ])
    expect(connector.errors[code]).toMatchObject({ category: "invalid_input" });
  // 일부만 등록된 묶음은 미리보기를 다시 만들면 등록된 거래를 건너뛴다.
  expect(connector.errors.ACCOUNTBOOK_IMPORT_PARTIAL).toMatchObject({ recovery: "recheck" });
  // 변경 요청을 보낸 뒤 결과를 읽지 못한 것만 결과를 모르는 것이다. 쓰기 전 조회 실패는 다시 시도한다.
  expect(connector.errors.ACCOUNTBOOK_OUTCOME_UNKNOWN).toBe("outcome_unknown");
  for (const code of ["ACCOUNTBOOK_NETWORK", "ACCOUNTBOOK_UNAVAILABLE"])
    expect(connector.errors[code]).toMatchObject({ recovery: "retry_later" });
});

test("모든 도구는 승인 카드에 보일 한국어 제목을 가진다", () => {
  for (const [name, policy] of Object.entries(connector.tools) as Array<
    [string, { title?: string }]
  >) {
    expect(typeof policy.title, name).toBe("string");
    expect(policy.title!.length).toBeGreaterThan(0);
    expect(policy.title!.length).toBeLessThanOrEqual(80);
  }
});

test("사진을 받는 커넥터는 이미지를 보는 도구 묶음만 요청한다", () => {
  expect(connector.toolsets).toEqual(["vision"]);
  expect(connector.attachments).toBe(true);
});

test("스킬 본문은 설치하는 쪽의 지침 상한 안에 있고 링크가 없다", () => {
  const skills = join(import.meta.dir, "..", "skills");
  for (const entry of readdirSync(skills, { recursive: true }))
    expect(lstatSync(join(skills, String(entry))).isSymbolicLink()).toBe(false);
  let body = "";
  for (const name of readdirSync(skills)) {
    const text = readFileSync(join(skills, name, "SKILL.md"), "utf8");
    expect(text.startsWith("---\n")).toBe(true);
    const end = text.indexOf("\n---\n", 4);
    expect(end).toBeGreaterThan(0);
    body += text.slice(end + 5).trim() + "\n\n";
  }
  expect(body.length).toBeLessThanOrEqual(8000);
});
