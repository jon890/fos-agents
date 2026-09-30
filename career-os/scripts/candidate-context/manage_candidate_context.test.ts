import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import { formatManageCandidateContextError, manageCandidateContext } from "./manage_candidate_context.ts";

const originalFetch = globalThis.fetch;
const originalEnv = { url: process.env.CAREER_BACKEND_URL, token: process.env.CAREER_BACKEND_TOKEN, tokenFile: process.env.CAREER_BACKEND_TOKEN_FILE };
const directories: string[] = [];

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

    await expect(manageCandidateContext(["get", "--key", "learning-interests", "--out", "career-os/tmp-context.md"])).rejects.toThrow("저장소 밖");
    expect(urls).toHaveLength(0);
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
});
