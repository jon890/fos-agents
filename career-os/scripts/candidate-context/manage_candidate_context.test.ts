import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import { formatManageCandidateContextError, manageCandidateContext } from "./manage_candidate_context.ts";

const originalFetch = globalThis.fetch;
const originalEnv = { url: process.env.CAREER_BACKEND_URL, token: process.env.CAREER_BACKEND_TOKEN, tokenFile: process.env.CAREER_BACKEND_TOKEN_FILE };
const directories: string[] = [];
const cliPath = join(import.meta.dir, "manage_candidate_context.ts");
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
  const directory = mkdtempSync(join(tmpdir(), "candidate-context."));
  directories.push(directory);
  return directory;
}

/** 서브프로세스로 CLI 를 실행한다. 같은 프로세스의 fake server 가 응답해야 하므로 비동기로 기다린다. */
async function runCli(args: string[], port: number | undefined, cwd: string) {
  const env: Record<string, string | undefined> = { ...process.env, CAREER_BACKEND_URL: `http://127.0.0.1:${port}`, CAREER_BACKEND_TOKEN: "x".repeat(32) };
  // 연결값은 token 과 token 파일 중 하나만 받는다. 실행한 셸의 token 파일 설정이 섞이지 않게 뺀다.
  delete env.CAREER_BACKEND_TOKEN_FILE;
  const child = Bun.spawn([process.execPath, cliPath, ...args], { cwd, stdout: "pipe", stderr: "pipe", env });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, exitCode };
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

/** 문서 저장을 흉내 내고 요청한 경로를 기록한다. */
function fakeBackend(options: { savedVersion: number }) {
  const calls: string[] = [];
  const handle = async (url: URL, method: string): Promise<Response> => {
    calls.push(`${method} ${url.pathname}`);
    const documentKey = url.pathname.split("/").at(-1);
    if (method === "PUT") return json({ document: { documentKey, version: options.savedVersion, updatedAt: "2026-09-01T00:00:00.000Z" } });
    return json({ document: { documentKey, version: options.savedVersion, body: "예시 선호 문장", note: "n", updatedAt: "2026-09-01T00:00:00.000Z" } });
  };
  return { calls, handle };
}

function useBackend(backend: ReturnType<typeof fakeBackend>): void {
  useApi(() => new Response("{}"));
  globalThis.fetch = (async (input: URL, init: RequestInit) => backend.handle(input, String(init.method))) as unknown as typeof fetch;
}

describe("manage_candidate_context", () => {
  test("help 는 연결값 없이 사용법을 낸다", async () => {
    delete process.env.CAREER_BACKEND_URL;
    delete process.env.CAREER_BACKEND_TOKEN;
    globalThis.fetch = (() => { throw new Error("API를 호출하면 안 된다."); }) as unknown as typeof fetch;

    for (const args of [[], ["help"], ["--help"], ["-h"]]) {
      await expect(manageCandidateContext(args)).resolves.toContain("사용법:");
    }
  });

  test("없는 키와 --file 없는 put 은 요청 전에 거절한다", async () => {
    const urls = useApi(() => new Response("{}"));

    await expect(manageCandidateContext(["get", "--key", "unknown-key"])).rejects.toThrow("--key");
    await expect(manageCandidateContext(["put", "--key", "learning-interests", "--expected-version", "0", "--note", "메모"])).rejects.toThrow("--file");
    expect(urls).toHaveLength(0);
  });

  test("저장소 안 --out 은 요청 전에 거절한다", async () => {
    const urls = useApi(() => new Response("{}"));
    const inside = join(repositoryRoot, "career-os", "tmp-context.md");

    await expect(manageCandidateContext(["get", "--key", "learning-interests", "--out", inside])).rejects.toThrow("저장소 밖");
    expect(urls).toHaveLength(0);
  });

  test("이미 있는 symlink --out 은 가리키는 곳과 관계없이 거절한다", async () => {
    const urls = useApi(() => new Response("{}"));
    const directory = tempDir();
    const insideLink = join(directory, "inside-link.md");
    const outsideLink = join(directory, "outside-link.md");
    symlinkSync(join(repositoryRoot, "career-os", "tmp-context.md"), insideLink);
    symlinkSync(join(directory, "target.md"), outsideLink);

    await expect(manageCandidateContext(["get", "--key", "learning-interests", "--out", insideLink])).rejects.toThrow("저장소 밖");
    await expect(manageCandidateContext(["get", "--key", "learning-interests", "--out", outsideLink])).rejects.toThrow("저장소 밖");
    expect(urls).toHaveLength(0);
  });

  test("저장소의 .git 디렉터리 안 --out 은 거절한다", async () => {
    const urls = useApi(() => new Response("{}"));
    const repository = tempDir();
    Bun.spawnSync(["git", "init", "-q", repository]);

    await expect(manageCandidateContext(["get", "--key", "learning-interests", "--out", join(repository, ".git", "context.md")])).rejects.toThrow("저장소 밖");
    expect(urls).toHaveLength(0);
  });

  test("cwd 가 저장소 밖이어도 저장소 안 --out 은 거절하고 밖 --out 은 허용한다", async () => {
    const cwd = tempDir();
    const outside = join(tempDir(), "interests.md");
    const inside = join(repositoryRoot, "career-os", "tmp-context.md");
    const server = Bun.serve({ port: 0, fetch: () => Response.json({ document: { documentKey: "learning-interests", body: "본문\n", version: 2, note: "n", updatedAt: "2026-09-01T00:00:00.000Z" } }) });
    try {
      const run = (out: string) => runCli(["get", "--key", "learning-interests", "--out", out], server.port, cwd);

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
    const server = Bun.serve({ port: 0, fetch: () => Response.json({ document: { documentKey: "learning-interests", body: "본문\n", version: 2, note: "n", updatedAt: "2026-09-01T00:00:00.000Z" } }) });
    try {
      const result = await runCli(["get", "--key", "learning-interests"], server.port, tempDir());

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("본문\n");
    } finally {
      await server.stop(true);
    }
  });

  test("get 은 본문을 출력하고 저장소 밖 --out 에 쓴다", async () => {
    useApi(() => new Response(JSON.stringify({ document: { documentKey: "learning-interests", body: "예시 관심사 문장", version: 3, note: "메모", updatedAt: "2026-09-01T00:00:00.000Z" } }), { headers: { "Content-Type": "application/json" } }));
    const out = join(tempDir(), "interests.md");

    expect(await manageCandidateContext(["get", "--key", "learning-interests"])).toBe("예시 관심사 문장");
    expect(await manageCandidateContext(["get", "--key", "learning-interests", "--out", out])).toMatchObject({ documentKey: "learning-interests", version: 3 });
    expect(await Bun.file(out).text()).toBe("예시 관심사 문장");
  });

  test("get 404 는 put --expected-version 0 을 안내한다", async () => {
    useApi(() => new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "x" } }), { status: 404, headers: { "Content-Type": "application/json" } }));

    await expect(manageCandidateContext(["get", "--key", "learning-interests"])).rejects.toThrow("--expected-version 0");
  });

  test("put 은 파일 본문을 보내고 요약만 출력한다", async () => {
    const bodies: unknown[] = [];
    useApi((_url, init) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ document: { documentKey: "learning-interests", version: 1, updatedAt: "2026-09-01T00:00:00.000Z" } }), { headers: { "Content-Type": "application/json" } });
    });
    const file = join(tempDir(), "interests.md");
    writeFileSync(file, "예시 관심사 문장", "utf8");

    const result = await manageCandidateContext(["put", "--key", "learning-interests", "--file", file, "--expected-version", "0", "--note", "예시 메모"]);

    expect(bodies).toEqual([{ body: "예시 관심사 문장", note: "예시 메모", expectedVersion: 0 }]);
    expect(result).toEqual({ documentKey: "learning-interests", version: 1, updatedAt: "2026-09-01T00:00:00.000Z" });
  });

  test("put 409 는 다시 조회하라고 안내하고 오류 출력에 본문을 담지 않는다", async () => {
    useApi(() => new Response(JSON.stringify({ error: { code: "VERSION_CONFLICT", message: "x" } }), { status: 409, headers: { "Content-Type": "application/json" } }));
    const file = join(tempDir(), "interests.md");
    writeFileSync(file, "비공개 예시 문장", "utf8");

    const error = await manageCandidateContext(["put", "--key", "learning-interests", "--file", file, "--expected-version", "1", "--note", "메모"]).catch((e: unknown) => e);

    expect(formatManageCandidateContextError(error)).toContain("get");
    expect(formatManageCandidateContextError(error)).not.toContain("비공개 예시 문장");
    expect(formatManageCandidateContextError(new CareerBackendHttpError(503, "UNAVAILABLE", "실패", "req-1"))).toBe("실패 (status=503, code=UNAVAILABLE, requestId=req-1)");
  });

  test("help 출력에 sync-position-policy 가 없다", async () => {
    expect(await manageCandidateContext(["help"])).not.toContain("sync-position-policy");
  });

  test("sync-position-policy 는 사용법 오류로 거절된다", async () => {
    await expect(manageCandidateContext(["sync-position-policy"])).rejects.toThrow("사용법");
  });

  test("put --key position-preferences 는 문서 저장 요청 하나만 보내고 저장 요약만 돌려준다", async () => {
    const backend = fakeBackend({ savedVersion: 2 });
    useBackend(backend);
    const file = join(tempDir(), "preferences.md");
    writeFileSync(file, "예시 선호 문장", "utf8");

    const result = await manageCandidateContext(["put", "--key", "position-preferences", "--file", file, "--expected-version", "1", "--note", "메모"]);

    expect(result).toEqual({ documentKey: "position-preferences", version: 2, updatedAt: "2026-09-01T00:00:00.000Z" });
    expect(backend.calls).toEqual(["PUT /api/candidate-context/v1/documents/position-preferences"]);
  });

  test("다른 키의 put 은 분석 정책을 건드리지 않는다", async () => {
    const backend = fakeBackend({ savedVersion: 3 });
    useBackend(backend);
    const file = join(tempDir(), "state.md");
    writeFileSync(file, "예시 지원 상태 문장", "utf8");

    await manageCandidateContext(["put", "--key", "application-state", "--file", file, "--expected-version", "2", "--note", "메모"]);

    expect(backend.calls).toEqual(["PUT /api/candidate-context/v1/documents/application-state"]);
  });
});
