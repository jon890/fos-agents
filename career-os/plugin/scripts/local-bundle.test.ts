import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bundle = join(import.meta.dir, "../dist/career-local.js");
const temporaryDirectories: string[] = [];
const FAKE_TOKEN = "fake-token-0123456789abcdefghijklmnopqrs";

function temporaryDirectory(): string {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "career-local-")));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** 저장소 밖 cwd 에서, 개발자 셸의 CAREER_* 값을 이어받지 않고 번들을 실행한다. */
async function runBundle(cwd: string, args: string[], extra: Record<string, string> = {}) {
  const proc = Bun.spawn(["bun", "--no-env-file", bundle, ...args], {
    cwd,
    env: { PATH: process.env.PATH ?? "", HOME: cwd, ...extra },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

test("help 는 0 으로 끝난다", async () => {
  const result = await runBundle(temporaryDirectory(), ["help"]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("interview");
});

test("workspace paths 는 설정한 작업본 위치와 로컬 모드를 낸다", async () => {
  const cwd = temporaryDirectory();
  const root = join(cwd, "workspace");
  const result = await runBundle(cwd, ["workspace", "paths", "--json"], { CAREER_WORKSPACE_ROOT: root });
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ action: "paths", ok: true, root, mode: "local" });
});

test("cwd 의 .env 는 작업본 위치와 모드를 바꾸지 않는다", async () => {
  const cwd = temporaryDirectory();
  writeFileSync(join(cwd, ".env"), "CAREER_WORKSPACE_ROOT=/elsewhere\nCAREER_WORKSPACE_SSH_TARGET=example\n");
  const result = await runBundle(cwd, ["workspace", "paths", "--json"]);
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ root: join(cwd, ".fos-career", "workspace"), mode: "local" });
});

test("interview select 는 번들에 든 공개 질문 은행에서 고른다", async () => {
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      requests.push(`${request.method} ${url.pathname}${url.search}`);
      if (request.method === "GET" && url.searchParams.get("drillType") === "tech" && (
        url.pathname === "/api/interview/v1/progress" || url.pathname === "/api/interview/v1/personal-questions"
      )) {
        return Response.json({ items: [] });
      }
      return new Response("not found", { status: 404 });
    },
  });
  try {
    const result = await runBundle(temporaryDirectory(), ["interview", "select", "tech", "--count", "3"], {
      CAREER_BACKEND_URL: server.url.origin,
      CAREER_BACKEND_TOKEN: FAKE_TOKEN,
    });
    expect({ exitCode: result.exitCode, stderr: result.stderr, requests }).toMatchObject({ exitCode: 0, stderr: "" });
    const output = JSON.parse(result.stdout) as { questions: Array<{ sourceScope?: string }> };
    expect(output.questions).toHaveLength(3);
    for (const question of output.questions) expect([undefined, "public"]).toContain(question.sourceScope);
  } finally {
    server.stop(true);
  }
});

test("Backend 주소가 없으면 1 로 끝나고 token 을 출력하지 않는다", async () => {
  const result = await runBundle(temporaryDirectory(), ["interview", "select", "tech", "--count", "3"], {
    CAREER_BACKEND_TOKEN: FAKE_TOKEN,
  });
  expect(result.exitCode).toBe(1);
  expect(result.stdout).not.toContain(FAKE_TOKEN);
  expect(result.stderr).not.toContain(FAKE_TOKEN);
});
