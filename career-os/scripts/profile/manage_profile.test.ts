import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import { formatManageProfileError, manageProfile } from "./manage_profile.ts";

const originalFetch = globalThis.fetch;
const originalEnv = { url: process.env.CAREER_BACKEND_URL, token: process.env.CAREER_BACKEND_TOKEN, tokenFile: process.env.CAREER_BACKEND_TOKEN_FILE };
const directories: string[] = [];
const cliPath = join(import.meta.dir, "manage_profile.ts");
const repositoryRoot = dirname(dirname(dirname(import.meta.dir)));

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [name, saved] of [["CAREER_BACKEND_URL", originalEnv.url], ["CAREER_BACKEND_TOKEN", originalEnv.token], ["CAREER_BACKEND_TOKEN_FILE", originalEnv.tokenFile]] as const) {
    if (saved === undefined) delete process.env[name];
    else process.env[name] = saved;
  }
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function useApi(handler: (url: URL, init: RequestInit) => Response): URL[] {
  process.env.CAREER_BACKEND_URL = "https://career.example.com";
  process.env.CAREER_BACKEND_TOKEN = "x".repeat(32);
  delete process.env.CAREER_BACKEND_TOKEN_FILE;
  const urls: URL[] = [];
  globalThis.fetch = (async (input: URL, init: RequestInit) => { urls.push(input); return handler(input, init); }) as unknown as typeof fetch;
  return urls;
}

function tempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "profile."));
  directories.push(directory);
  return directory;
}

async function runCli(args: string[], port: number | undefined, cwd: string) {
  const env: Record<string, string | undefined> = { ...process.env, CAREER_BACKEND_URL: `http://127.0.0.1:${port}`, CAREER_BACKEND_TOKEN: "x".repeat(32) };
  delete env.CAREER_BACKEND_TOKEN_FILE;
  const child = Bun.spawn([process.execPath, cliPath, ...args], { cwd, stdout: "pipe", stderr: "pipe", env });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, exitCode };
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const documentBody = (body: string) => ({ document: { documentKey: "github", body, version: 2, note: "n", updatedAt: "2026-09-01T00:00:00.000Z" } });
const snapshot = {
  month: "2026-09", claudeTokens: 1200, codexTokens: 300, claudeCostUsd: null, codexCostUsd: null, sessions: null,
  unpricedTokens: 0, measuredOn: "2026-10-01", source: "MEASURED", note: null,
  createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
};
const usageArgs = ["usage", "put", "--month", "2026-09", "--claude-tokens", "1200", "--codex-tokens", "300", "--unpriced-tokens", "0", "--measured-on", "2026-10-01", "--source", "MEASURED"];

/** PUT 본문을 모으고 `created` 응답을 낸다. */
function usagePutApi(created = true): unknown[] {
  const bodies: unknown[] = [];
  useApi((_url, init) => { bodies.push(JSON.parse(String(init.body))); return json({ snapshot, created }); });
  return bodies;
}

describe("manage_profile 문서", () => {
  test("help 는 연결값 없이 사용법을 내고 fetch 를 부르지 않는다", async () => {
    delete process.env.CAREER_BACKEND_URL;
    delete process.env.CAREER_BACKEND_TOKEN;
    globalThis.fetch = (() => { throw new Error("API를 호출하면 안 된다."); }) as unknown as typeof fetch;

    for (const args of [[], ["help"], ["--help"], ["-h"]]) {
      await expect(manageProfile(args)).resolves.toContain("사용법:");
    }
  });

  test("없는 묶음과 없는 명령은 예외다", async () => {
    const urls = useApi(() => new Response("{}"));

    await expect(manageProfile(["policy", "list"])).rejects.toThrow("사용법:");
    await expect(manageProfile(["documents", "delete"])).rejects.toThrow("사용법:");
    await expect(manageProfile(["usage", "delete"])).rejects.toThrow("사용법:");
    expect(urls).toHaveLength(0);
  });

  test("없는 --key 와 --file 없는 put 은 요청 전에 거절한다", async () => {
    const urls = useApi(() => new Response("{}"));

    await expect(manageProfile(["documents", "get", "--key", "unknown"])).rejects.toThrow("wanted, linkedin, github");
    await expect(manageProfile(["documents", "put", "--key", "github", "--expected-version", "0", "--note", "메모"])).rejects.toThrow("--file");
    expect(urls).toHaveLength(0);
  });

  test("저장소 안 --out 은 요청 전에 거절한다", async () => {
    const urls = useApi(() => new Response("{}"));
    const inside = join(repositoryRoot, "career-os", "tmp-profile.md");

    await expect(manageProfile(["documents", "get", "--key", "github", "--out", inside])).rejects.toThrow("저장소 밖");
    expect(urls).toHaveLength(0);
  });

  test("이미 있는 symlink --out 은 가리키는 곳과 관계없이 거절한다", async () => {
    const urls = useApi(() => new Response("{}"));
    const directory = tempDir();
    const insideLink = join(directory, "inside-link.md");
    const outsideLink = join(directory, "outside-link.md");
    symlinkSync(join(repositoryRoot, "career-os", "tmp-profile.md"), insideLink);
    symlinkSync(join(directory, "target.md"), outsideLink);

    await expect(manageProfile(["documents", "get", "--key", "github", "--out", insideLink])).rejects.toThrow("저장소 밖");
    await expect(manageProfile(["documents", "get", "--key", "github", "--out", outsideLink])).rejects.toThrow("저장소 밖");
    expect(urls).toHaveLength(0);
  });

  test("cwd 가 저장소 밖이어도 저장소 안 --out 은 거절하고 밖 --out 은 허용한다", async () => {
    const cwd = tempDir();
    const outside = join(tempDir(), "github.md");
    const inside = join(repositoryRoot, "career-os", "tmp-profile.md");
    const server = Bun.serve({ port: 0, fetch: () => Response.json(documentBody("본문\n")) });
    try {
      const run = (out: string) => runCli(["documents", "get", "--key", "github", "--out", out], server.port, cwd);

      const rejected = await run(inside);
      expect(rejected.exitCode).toBe(1);
      expect(rejected.stderr).toContain("저장소 밖");
      const allowed = await run(outside);
      expect(allowed.exitCode).toBe(0);
      expect(await Bun.file(outside).text()).toBe("본문\n");
    } finally {
      await server.stop(true);
    }
  });

  test("get 을 --out 없이 실행하면 본문 끝 줄바꿈을 늘리지 않고 그대로 출력한다", async () => {
    const server = Bun.serve({ port: 0, fetch: () => Response.json(documentBody("본문\n")) });
    try {
      const result = await runCli(["documents", "get", "--key", "github"], server.port, tempDir());

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("본문\n");
    } finally {
      await server.stop(true);
    }
  });

  test("get 404 는 --expected-version 0 을 안내한다", async () => {
    useApi(() => json({ error: { code: "NOT_FOUND", message: "x" } }, 404));

    await expect(manageProfile(["documents", "get", "--key", "github"])).rejects.toThrow("--expected-version 0");
  });

  test("list 는 요약 배열을 돌려준다", async () => {
    const summary = { documentKey: "github", version: 2, updatedAt: "2026-09-01T00:00:00.000Z" };
    useApi(() => json({ documents: [summary] }));

    expect(await manageProfile(["documents", "list"])).toEqual([summary]);
  });

  test("put 은 파일 본문을 보내고 요약만 돌려준다", async () => {
    const bodies: unknown[] = [];
    useApi((_url, init) => {
      bodies.push(JSON.parse(String(init.body)));
      return json({ document: { documentKey: "github", version: 1, updatedAt: "2026-09-01T00:00:00.000Z" } });
    });
    const file = join(tempDir(), "github.md");
    writeFileSync(file, "예시 프로필 문장", "utf8");

    const result = await manageProfile(["documents", "put", "--key", "github", "--file", file, "--expected-version", "0", "--note", "예시 메모"]);

    expect(bodies).toEqual([{ body: "예시 프로필 문장", note: "예시 메모", expectedVersion: 0 }]);
    expect(result).toEqual({ documentKey: "github", version: 1, updatedAt: "2026-09-01T00:00:00.000Z" });
  });

  test("put 409 는 다시 조회하라고 안내하고 오류 출력에 본문을 담지 않는다", async () => {
    useApi(() => json({ error: { code: "VERSION_CONFLICT", message: "x" } }, 409));
    const file = join(tempDir(), "github.md");
    writeFileSync(file, "비공개 예시 문장", "utf8");

    const error = await manageProfile(["documents", "put", "--key", "github", "--file", file, "--expected-version", "1", "--note", "메모"]).catch((e: unknown) => e);

    expect(formatManageProfileError(error)).toContain("documents get");
    expect(formatManageProfileError(error)).not.toContain("비공개 예시 문장");
    expect(formatManageProfileError(new CareerBackendHttpError(503, "UNAVAILABLE", "실패", "req-1"))).toBe("실패 (status=503, code=UNAVAILABLE, requestId=req-1)");
    expect(formatManageProfileError(new CareerBackendHttpError(503, "UNAVAILABLE", "실패"))).toBe("실패 (status=503, code=UNAVAILABLE)");
  });
});

describe("manage_profile 사용량", () => {
  test("usage put 은 필수 옵션만 보내고 선택 옵션은 본문에 넣지 않는다", async () => {
    const bodies = usagePutApi();

    const result = await manageProfile(usageArgs);

    expect(bodies).toEqual([{ claudeTokens: 1200, codexTokens: 300, unpricedTokens: 0, measuredOn: "2026-10-01", source: "MEASURED" }]);
    expect(result).toEqual({ snapshot, created: true });
  });

  test("비용과 세션 수는 숫자로 들어간다", async () => {
    const bodies = usagePutApi();

    await manageProfile([...usageArgs, "--claude-cost-usd", "12.34", "--codex-cost-usd", "5.6", "--sessions", "7"]);

    expect(bodies[0]).toMatchObject({ claudeCostUsd: 12.34, codexCostUsd: 5.6, sessions: 7 });
  });

  test("비용 0.07 과 0.29 는 거절하지 않고 본문에 담긴다", async () => {
    const bodies = usagePutApi();

    await manageProfile([...usageArgs, "--claude-cost-usd", "0.07", "--codex-cost-usd", "0.29"]);

    expect(bodies[0]).toMatchObject({ claudeCostUsd: 0.07, codexCostUsd: 0.29 });
  });

  test("--replace 는 --note 없이 요청 전에 거절하고 사유가 있으면 본문에 담는다", async () => {
    const bodies = usagePutApi();

    await expect(manageProfile([...usageArgs, "--replace"])).rejects.toThrow("--note");
    expect(bodies).toHaveLength(0);
    await manageProfile([...usageArgs, "--replace", "--note", "측정 오류 정정"]);
    expect(bodies[0]).toMatchObject({ replace: true, note: "측정 오류 정정" });
  });

  test("created: false 응답도 종료 코드 0 이고 출력의 created 가 false 다", async () => {
    const server = Bun.serve({ port: 0, fetch: () => Response.json({ snapshot, created: false }) });
    try {
      const result = await runCli(usageArgs, server.port, tempDir());

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout).created).toBe(false);
    } finally {
      await server.stop(true);
    }
  });

  test("숫자가 아닌 토큰과 잘못된 달은 요청 전에 거절한다", async () => {
    const urls = useApi(() => new Response("{}"));
    const replace = (name: string, to: string) => usageArgs.map((arg, i) => (usageArgs[i - 1] === name ? to : arg));

    await expect(manageProfile(replace("--claude-tokens", "abc"))).rejects.toThrow("--claude-tokens");
    await expect(manageProfile(replace("--month", "2026-13"))).rejects.toThrow();
    expect(urls).toHaveLength(0);
  });

  test("usage list 는 기록 배열을 돌려준다", async () => {
    useApi(() => json({ snapshots: [snapshot] }));

    expect(await manageProfile(["usage", "list"])).toEqual([snapshot]);
  });
});
