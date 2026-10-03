import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CareerError } from "./backend.ts";
import { createServer } from "./server.ts";

const env = {
  CAREER_BACKEND_URL: "https://career.example.com/",
  CAREER_BACKEND_TOKEN: "x".repeat(40),
  CAREER_GITHUB_PROFILE_REPO: "example-user/example-user",
};

function expectConfigError(build: () => unknown) {
  try {
    build();
  } catch (error) {
    expect(error).toBeInstanceOf(CareerError);
    expect((error as CareerError).code).toBe("CAREER_CONFIG");
    return;
  }
  throw new Error("expected CAREER_CONFIG");
}

test("MCP 로 도구 여섯을 탐색하고 확인 도구가 structuredContent 와 텍스트에 같은 값을 낸다", async () => {
  const server = createServer(env, async (input) => {
    expect(String(input)).toBe("https://career.example.com/api/profile/v1/documents");
    return new Response(JSON.stringify({ documents: [] }));
  });
  const client = new Client({ name: "career-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    expect((await client.listTools()).tools).toHaveLength(8);
    const result = await client.callTool({ name: "check_connection", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual({ backend: "ok" });
    expect(JSON.parse((result.content as Array<{ text: string }>)[0]!.text)).toEqual({ backend: "ok" });
  } finally {
    await client.close();
    await server.close();
  }
});

test("필수 환경 변수가 치환되지 않았으면 CAREER_CONFIG 로 시작하지 않는다", () => {
  for (const key of ["CAREER_BACKEND_URL", "CAREER_BACKEND_TOKEN", "CAREER_GITHUB_PROFILE_REPO"])
    expectConfigError(() => createServer({ ...env, [key]: "${UNSET}" }));
});

test("GitHub token 이 치환되지 않은 변수 참조여도 서버가 만들어진다", () => {
  expect(createServer({ ...env, CAREER_GITHUB_TOKEN: "${CAREER_GITHUB_TOKEN}" })).toBeDefined();
});

test("Backend 주소에 path 가 있거나 token 이 짧거나 저장소 이름이 틀리면 CAREER_CONFIG 다", () => {
  expectConfigError(() => createServer({ ...env, CAREER_BACKEND_URL: "https://career.example.com/api" }));
  expectConfigError(() => createServer({ ...env, CAREER_BACKEND_URL: "https://career.example.com/?a=1" }));
  expectConfigError(() => createServer({ ...env, CAREER_BACKEND_URL: "ftp://career.example.com/" }));
  expectConfigError(() => createServer({ ...env, CAREER_BACKEND_TOKEN: ` ${"x".repeat(31)} ` }));
  expectConfigError(() => createServer({ ...env, CAREER_GITHUB_PROFILE_REPO: "example-user" }));
  expect(createServer({ ...env, CAREER_BACKEND_TOKEN: ` ${"x".repeat(32)} ` })).toBeDefined();
});

test("plugin 실행 파일만 복사해도 의존성 설치 없이 stdio 로 시작한다", async () => {
  const root = mkdtempSync(join(tmpdir(), "career-standalone-"));
  const client = new Client({ name: "bundle-test", version: "1.0.0" });
  const entry = join(root, "career-mcp.js");
  copyFileSync(join(import.meta.dir, "../dist/career-mcp.js"), entry);
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
    expect((await client.listTools()).tools).toHaveLength(8);
    expect(stderr).toBe("");
  } finally {
    await client.close();
    rmSync(root, { recursive: true, force: true });
  }
});
