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
  expect(tools.map(({ name }) => name).sort()).toEqual(Object.keys(connector.tools).sort());
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

test("MCP 로 manifest 에 선언한 도구를 모두 탐색하고 확인 도구가 structuredContent 와 텍스트에 같은 값을 낸다", async () => {
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

test("「내 브라우저」 주소 없이 서버가 뜨고 원티드 도구는 닿지 않음으로 답한다", async () => {
  const server = createServer(env, async () => new Response(JSON.stringify({ documents: [] })));
  const client = new Client({ name: "wanted-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const listed = await client.listTools();
    const wanted = listed.tools.filter(({ name }) => name.endsWith("_wanted_resume"));
    expect(wanted.map(({ name, annotations }) => [name, annotations?.readOnlyHint])).toEqual([
      ["get_wanted_resume", true],
      ["update_wanted_resume", false],
    ]);
    const result = await client.callTool({ name: "get_wanted_resume", arguments: {} });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(JSON.parse(text).error.code).toBe("CAREER_BROWSER_UNREACHABLE");
  } finally {
    await client.close();
    await server.close();
  }
});

// Fake values only: the channel address and both tokens are placeholders, never a real host or token.
const channelUrl = "http://channel.example.test/internal/connector-token/k1.example-marker";
const channelGithubToken = "c".repeat(40);
const pastedGithubToken = "p".repeat(40);

type Seen = { url: string; authorization: string | null };

async function callGithubTool(
  serverEnv: Record<string, string | undefined>,
  channel: () => Response | Promise<Response>,
  tool = "check_connection",
) {
  const seen: Seen[] = [];
  const server = createServer(serverEnv, async (input, init) => {
    const url = String(input);
    seen.push({ url, authorization: new Headers(init?.headers).get("Authorization") });
    if (url === channelUrl) return channel();
    if (url.startsWith("https://api.github.com/")) return new Response(JSON.stringify({ default_branch: "main" }));
    return new Response(JSON.stringify({ documents: [] }));
  });
  const client = new Client({ name: "github-token-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({ name: tool, arguments: {} });
    return { result, text: (result.content as Array<{ text: string }>)[0]!.text, seen };
  } finally {
    await client.close();
    await server.close();
  }
}

const tokenJson = () =>
  new Response(JSON.stringify({ access_token: channelGithubToken, expires_at: "2026-11-23T10:00:00Z" }));

test("통로 주소가 있으면 통로에서 받은 token 으로 GitHub 을 부르고 붙여 넣은 token 은 쓰지 않는다", async () => {
  const { result, text, seen } = await callGithubTool(
    { ...env, CAREER_GITHUB_TOKEN: pastedGithubToken, CAREER_GITHUB_TOKEN_URL: channelUrl },
    tokenJson,
  );
  expect(result.structuredContent).toEqual({ backend: "ok", github: "ok" });
  const github = seen.filter(({ url }) => url.startsWith("https://api.github.com/"));
  expect(github.length).toBeGreaterThan(0);
  for (const call of github) expect(call.authorization).toBe(`Bearer ${channelGithubToken}`);
  // The channel itself is asked without any credential: the marker in the address is the credential.
  expect(seen.find(({ url }) => url === channelUrl)?.authorization).toBeNull();
  expect(text).not.toContain(channelGithubToken);
  expect(text).not.toContain(channelUrl);
});

test("도구를 부를 때마다 통로에서 token 을 다시 받는다", async () => {
  let issued = 0;
  const server = createServer({ ...env, CAREER_GITHUB_TOKEN_URL: channelUrl }, async (input, init) => {
    const url = String(input);
    if (url === channelUrl) {
      issued += 1;
      return new Response(JSON.stringify({ access_token: `${issued}`.repeat(40) }));
    }
    if (url.startsWith("https://api.github.com/")) {
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${`${issued}`.repeat(40)}`);
      return new Response(JSON.stringify({ default_branch: "main" }));
    }
    return new Response(JSON.stringify({ documents: [] }));
  });
  const client = new Client({ name: "github-token-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    for (let call = 0; call < 2; call += 1) {
      const result = await client.callTool({ name: "check_connection", arguments: {} });
      expect(result.structuredContent).toEqual({ backend: "ok", github: "ok" });
    }
    expect(issued).toBe(2);
  } finally {
    await client.close();
    await server.close();
  }
});

test("통로 주소가 비었거나 치환되지 않은 참조면 붙여 넣은 token 을 쓴다", async () => {
  for (const tokenUrl of [undefined, "", "${CAREER_GITHUB_TOKEN_URL}"]) {
    const { result, seen } = await callGithubTool(
      { ...env, CAREER_GITHUB_TOKEN: pastedGithubToken, CAREER_GITHUB_TOKEN_URL: tokenUrl },
      () => {
        throw new Error("통로를 부르면 안 된다");
      },
    );
    expect(result.structuredContent).toEqual({ backend: "ok", github: "ok" });
    expect(seen.some(({ url }) => url === channelUrl)).toBe(false);
    for (const call of seen.filter(({ url }) => url.startsWith("https://api.github.com/")))
      expect(call.authorization).toBe(`Bearer ${pastedGithubToken}`);
  }
});

test("token 과 통로 주소가 모두 없으면 GitHub 은 not_configured 다", async () => {
  const { result } = await callGithubTool({ ...env, CAREER_GITHUB_TOKEN: "", CAREER_GITHUB_TOKEN_URL: "" }, tokenJson);
  expect(result.structuredContent).toEqual({ backend: "ok", github: "not_configured" });
});

test("통로 실패는 정한 CAREER 오류 코드로 나오고 결과에 통로 주소와 응답 원문이 없다", async () => {
  const leaked = "channel-body-should-not-leak";
  const cases: Array<[string, () => Response | Promise<Response>, string]> = [
    ["401", () => new Response(leaked, { status: 401 }), "CAREER_GITHUB_UNAUTHORIZED"],
    ["409", () => new Response(leaked, { status: 409 }), "CAREER_GITHUB_UNAUTHORIZED"],
    ["404", () => new Response(leaked, { status: 404 }), "CAREER_GITHUB_NOT_CONFIGURED"],
    ["503", () => new Response(leaked, { status: 503 }), "CAREER_GITHUB_UNAVAILABLE"],
    ["통신 실패", () => Promise.reject(new Error(leaked)), "CAREER_GITHUB_UNAVAILABLE"],
    ["token 없는 응답", () => new Response(JSON.stringify({ expires_at: leaked })), "CAREER_INVALID_RESPONSE"],
    ["공백 token", () => new Response(JSON.stringify({ access_token: "   ", expires_at: leaked })), "CAREER_INVALID_RESPONSE"],
    ["JSON 이 아닌 본문", () => new Response(leaked), "CAREER_INVALID_RESPONSE"],
    ["400", () => new Response(leaked, { status: 400 }), "CAREER_GITHUB_UNAVAILABLE"],
    ["500", () => new Response(leaked, { status: 500 }), "CAREER_GITHUB_UNAVAILABLE"],
  ];
  for (const [name, channel, code] of cases) {
    const { result, text, seen } = await callGithubTool(
      { ...env, CAREER_GITHUB_TOKEN_URL: channelUrl },
      channel,
      "get_github_profile",
    );
    expect({ name, isError: result.isError, code: JSON.parse(text).error.code }).toEqual({ name, isError: true, code });
    expect(text).not.toContain(leaked);
    expect(text).not.toContain(channelUrl);
    expect(seen.some(({ url }) => url.startsWith("https://api.github.com/"))).toBe(false);
  }
});

test("통로 주소 모양이 틀려도 서버는 뜨고 GitHub 도구만 CAREER_GITHUB_NOT_CONFIGURED 로 답한다", async () => {
  for (const tokenUrl of ["not a url", "file:///etc/token"]) {
    const { result, text, seen } = await callGithubTool(
      { ...env, CAREER_GITHUB_TOKEN: pastedGithubToken, CAREER_GITHUB_TOKEN_URL: tokenUrl },
      tokenJson,
      "get_github_profile",
    );
    expect(result.isError).toBe(true);
    expect(JSON.parse(text).error.code).toBe("CAREER_GITHUB_NOT_CONFIGURED");
    expect(text).not.toContain(tokenUrl);
    expect(seen.some(({ url }) => url.startsWith("https://api.github.com/"))).toBe(false);
  }
});

test("GitHub 도구 한 번에 통로를 한 번만 부르고 그 호출의 GitHub 요청이 모두 같은 token 을 쓴다", async () => {
  let issued = 0;
  const authorizations: Array<string | null> = [];
  const server = createServer({ ...env, CAREER_GITHUB_TOKEN_URL: channelUrl }, async (input, init) => {
    const url = String(input);
    if (url === channelUrl) {
      issued += 1;
      return new Response(JSON.stringify({ access_token: channelGithubToken }));
    }
    authorizations.push(new Headers(init?.headers).get("Authorization"));
    if (url === "https://api.github.com/repos/example-user/example-user")
      return new Response(JSON.stringify({ default_branch: "main" }));
    if (url.endsWith("/git/ref/heads/main")) return new Response(JSON.stringify({ object: { sha: "a".repeat(40) } }));
    if (url.includes("/contents/")) return new Response("{}", { status: 404 });
    throw new Error(`unexpected request ${url}`);
  });
  const client = new Client({ name: "github-token-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({ name: "get_github_profile", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(issued).toBe(1);
    expect(authorizations.length).toBe(4);
    for (const authorization of authorizations) expect(authorization).toBe(`Bearer ${channelGithubToken}`);
    expect(JSON.stringify(result)).not.toContain(channelGithubToken);
  } finally {
    await client.close();
    await server.close();
  }
});

test("통로가 거절하면 붙여 넣은 token 으로 넘어가지 않는다", async () => {
  const { text, seen } = await callGithubTool(
    { ...env, CAREER_GITHUB_TOKEN: pastedGithubToken, CAREER_GITHUB_TOKEN_URL: channelUrl },
    () => new Response("{}", { status: 401 }),
    "get_github_profile",
  );
  expect(JSON.parse(text).error.code).toBe("CAREER_GITHUB_UNAUTHORIZED");
  expect(seen.some(({ url }) => url.startsWith("https://api.github.com/"))).toBe(false);
  expect(seen.some(({ authorization }) => authorization === `Bearer ${pastedGithubToken}`)).toBe(false);
});
