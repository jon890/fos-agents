import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CareerError } from "./backend.ts";
import { createServer } from "./server.ts";
import connector from "../connector.json";

function expectManifestDescriptions(tools: Array<{ name: string; description?: string }>) {
  expect(tools).toHaveLength(19);
  expect(Object.fromEntries(tools.map(({ name, description }) => [name, description]))).toEqual(
    Object.fromEntries(
      Object.entries(connector.tools).map(([name, policy]) => [name, policy.description]),
    ),
  );
}

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

test("MCP 서버가 알리는 version 이 package.json 의 version 과 같다", async () => {
  const { version } = JSON.parse(
    readFileSync(join(import.meta.dir, "..", "package.json"), "utf8"),
  ) as { version: string };
  const server = createServer(env, async () => new Response(JSON.stringify({ documents: [] })));
  const client = new Client({ name: "version-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    expect(client.getServerVersion()?.version).toBe(version);
  } finally {
    await client.close();
    await server.close();
  }
});

test("MCP 로 도구 열아홉 개를 탐색하고 확인 도구가 structuredContent 와 텍스트에 같은 값을 낸다", async () => {
  const server = createServer(env, async (input) => {
    expect(String(input)).toBe("https://career.example.com/api/profile/v1/documents");
    return new Response(JSON.stringify({ documents: [] }));
  });
  const client = new Client({ name: "career-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    expectManifestDescriptions((await client.listTools()).tools);
    const result = await client.callTool({ name: "check_connection", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual({ backend: "ok", github: "not_configured" });
    expect(JSON.parse((result.content as Array<{ text: string }>)[0]!.text)).toEqual({
      backend: "ok",
      github: "not_configured",
    });
  } finally {
    await client.close();
    await server.close();
  }
});

async function backendHeaders(serverEnv: Record<string, string | undefined>): Promise<Headers> {
  let seen: Headers | undefined;
  const server = createServer(serverEnv, async (_input, init) => {
    seen = new Headers(init?.headers);
    return new Response(JSON.stringify({ documents: [] }));
  });
  const client = new Client({ name: "access-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await client.callTool({ name: "check_connection", arguments: {} });
  } finally {
    await client.close();
    await server.close();
  }
  if (!seen) throw new Error("Backend 요청이 없었다");
  return seen;
}

const access = {
  CAREER_BACKEND_ACCESS_CLIENT_ID: "example-client.access",
  CAREER_BACKEND_ACCESS_CLIENT_SECRET: "example-secret",
};

test("Access service token 이 있으면 Backend 요청에 Bearer 와 함께 CF-Access 머리말을 싣는다", async () => {
  const headers = await backendHeaders({ ...env, ...access });
  expect(headers.get("Authorization")).toBe(`Bearer ${env.CAREER_BACKEND_TOKEN}`);
  expect(headers.get("CF-Access-Client-Id")).toBe(access.CAREER_BACKEND_ACCESS_CLIENT_ID);
  expect(headers.get("CF-Access-Client-Secret")).toBe(access.CAREER_BACKEND_ACCESS_CLIENT_SECRET);
});

test("Access 값이 없거나 치환되지 않은 변수 참조면 CF-Access 머리말을 보내지 않는다", async () => {
  for (const serverEnv of [
    env,
    {
      ...env,
      CAREER_BACKEND_ACCESS_CLIENT_ID: "${CAREER_BACKEND_ACCESS_CLIENT_ID}",
      CAREER_BACKEND_ACCESS_CLIENT_SECRET: "",
    },
  ]) {
    const headers = await backendHeaders(serverEnv);
    expect(headers.has("CF-Access-Client-Id")).toBe(false);
    expect(headers.has("CF-Access-Client-Secret")).toBe(false);
  }
});

test("Access ID 와 secret 가운데 하나만 있으면 CAREER_CONFIG 로 시작하지 않는다", () => {
  expectConfigError(() => createServer({ ...env, CAREER_BACKEND_ACCESS_CLIENT_ID: "example-client.access" }));
  expectConfigError(() => createServer({ ...env, CAREER_BACKEND_ACCESS_CLIENT_SECRET: "example-secret" }));
});

test("필수 환경 변수가 치환되지 않았으면 CAREER_CONFIG 로 시작하지 않는다", () => {
  for (const key of ["CAREER_BACKEND_URL", "CAREER_BACKEND_TOKEN", "CAREER_GITHUB_PROFILE_REPO"])
    expectConfigError(() => createServer({ ...env, [key]: "${UNSET}" }));
});

test("GitHub token 이 치환되지 않은 변수 참조여도 서버가 만들어진다", () => {
  expect(createServer({ ...env, CAREER_GITHUB_TOKEN: "${CAREER_GITHUB_TOKEN}" })).toBeDefined();
});

test("Backend 주소에 path 가 있거나 token 이 짧거나 저장소 이름이 틀리면 CAREER_CONFIG 다", () => {
  expectConfigError(() =>
    createServer({ ...env, CAREER_BACKEND_URL: "https://career.example.com/api" }),
  );
  expectConfigError(() =>
    createServer({ ...env, CAREER_BACKEND_URL: "https://career.example.com/?a=1" }),
  );
  expectConfigError(() =>
    createServer({ ...env, CAREER_BACKEND_URL: "ftp://career.example.com/" }),
  );
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
    expectManifestDescriptions((await client.listTools()).tools);
    expect(stderr).toBe("");
  } finally {
    await client.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("save_interview_attempt 만 idempotentHint 가 false 이고 쓰기 표시는 그대로다", async () => {
  const server = createServer(env, async () => new Response("{}"));
  const client = new Client({ name: "annotation-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    for (const tool of tools)
      expect({ name: tool.name, idempotent: tool.annotations?.idempotentHint }).toEqual({
        name: tool.name,
        idempotent: tool.name !== "save_interview_attempt",
      });
    const save = tools.find((tool) => tool.name === "save_interview_attempt");
    expect(save?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
  } finally {
    await client.close();
    await server.close();
  }
});
