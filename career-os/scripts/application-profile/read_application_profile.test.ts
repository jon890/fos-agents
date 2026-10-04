import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ApplicationProfileHttpError, type ApplicationProfileFetch } from "./client.ts";
import { formatReadApplicationProfileError, readApplicationProfileCli } from "./read_application_profile.ts";

const token = "test-service-token-0001";
const connection = { baseUrl: "https://assistant.example.com", token };
const content = "이름: 예시 사람\n연락처: 010-0000-0000";
const profile = {
  collection: "identity",
  documentKey: "career-application-profile",
  title: "예시 지원서 프로필",
  content,
  revision: 3,
  updatedAt: "2026-09-01T00:00:00Z",
};
const cliPath = join(import.meta.dir, "read_application_profile.ts");
const repositoryRoot = dirname(dirname(dirname(import.meta.dir)));
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function tempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "application-profile."));
  directories.push(directory);
  return directory;
}

/** 같은 응답을 돌려주고 호출 수를 세는 fetch 대역이다. */
function fake(respond: () => Response) {
  const state = { count: 0 };
  const fetchImpl: ApplicationProfileFetch = async () => {
    state.count += 1;
    return respond();
  };
  return { state, fetchImpl };
}

const ok = () =>
  new Response(JSON.stringify(profile), {
    status: 200,
    headers: { "Content-Type": "application/json", "X-Service-Token-Expires-At": "2027-01-01T00:00:00Z" },
  });

const mode = (path: string) => statSync(path).mode & 0o777;

describe("readApplicationProfileCli", () => {
  test("help 는 연결값 없이 사용법을 낸다", async () => {
    const saved = { url: process.env.FOS_ASSISTANT_URL, token: process.env.FOS_ASSISTANT_SERVICE_TOKEN };
    delete process.env.FOS_ASSISTANT_URL;
    delete process.env.FOS_ASSISTANT_SERVICE_TOKEN;
    try {
      const { state, fetchImpl } = fake(ok);
      for (const args of [[], ["help"], ["--help"], ["-h"]]) {
        await expect(readApplicationProfileCli(args, { fetchImpl })).resolves.toContain("사용법: read_application_profile.ts <get>");
      }
      expect(state.count).toBe(0);
    } finally {
      if (saved.url !== undefined) process.env.FOS_ASSISTANT_URL = saved.url;
      if (saved.token !== undefined) process.env.FOS_ASSISTANT_SERVICE_TOKEN = saved.token;
    }
  });

  test("--out 이 없거나 옵션 모양이면 요청 전에 거절한다", async () => {
    const { state, fetchImpl } = fake(ok);

    for (const args of [["get"], ["get", "--out"], ["get", "--out", "  "], ["get", "--out", "--other"]]) {
      await expect(readApplicationProfileCli(args, { connection, fetchImpl })).rejects.toThrow("--out 값이 필요하다");
    }
    expect(state.count).toBe(0);
  });

  test("저장소 안 --out 은 요청 전에 거절한다", async () => {
    const { state, fetchImpl } = fake(ok);
    const inside = join(repositoryRoot, "career-os", "profile-should-not-exist.md");

    await expect(readApplicationProfileCli(["get", "--out", inside], { connection, fetchImpl })).rejects.toThrow("저장소 밖 경로여야 한다");
    expect(state.count).toBe(0);
    expect(existsSync(inside)).toBe(false);
  });

  test("get 은 본문을 0600 파일에 쓰고 메타데이터만 돌려준다", async () => {
    const { fetchImpl } = fake(ok);
    const out = join(tempDir(), "profile.md");

    const result = (await readApplicationProfileCli(["get", "--out", out], { connection, fetchImpl })) as Record<string, unknown>;

    expect(readFileSync(out, "utf8")).toBe(content);
    expect(mode(out)).toBe(0o600);
    expect(result).not.toHaveProperty("content");
    expect(result).not.toHaveProperty("title");
    expect(result).toMatchObject({
      collection: "identity",
      documentKey: "career-application-profile",
      revision: 3,
      updatedAt: "2026-09-01T00:00:00Z",
      tokenExpiresAt: "2027-01-01T00:00:00Z",
    });
    expect(String(result.out)).toEndWith("profile.md");
    expect(JSON.stringify(result)).not.toContain("010-0000-0000");
  });

  test("이미 있던 0644 파일도 쓴 뒤 0600 이 된다", async () => {
    const { fetchImpl } = fake(ok);
    const out = join(tempDir(), "profile.md");
    writeFileSync(out, "예전 내용", { mode: 0o644 });
    expect(mode(out)).toBe(0o644);

    await readApplicationProfileCli(["get", "--out", out], { connection, fetchImpl });

    expect(readFileSync(out, "utf8")).toBe(content);
    expect(mode(out)).toBe(0o600);
  });

  test("404 면 오류를 던지고 파일을 만들지 않는다", async () => {
    const { fetchImpl } = fake(() => Response.json({ code: "MEMORY_NOT_FOUND", message: "지어낸 서버 문구" }, { status: 404 }));
    const out = join(tempDir(), "profile.md");

    const failure = readApplicationProfileCli(["get", "--out", out], { connection, fetchImpl, maxRetries: 0 });

    await expect(failure).rejects.toBeInstanceOf(ApplicationProfileHttpError);
    await expect(failure).rejects.toMatchObject({ status: 404, code: "MEMORY_NOT_FOUND" });
    expect(existsSync(out)).toBe(false);
  });

  test("모르는 명령은 사용법을 메시지로 던진다", async () => {
    await expect(readApplicationProfileCli(["unknown"], { connection })).rejects.toThrow("사용법: read_application_profile.ts <get>");
  });

  test("오류 형식은 상태와 code 를 붙인다", () => {
    expect(formatReadApplicationProfileError(new ApplicationProfileHttpError(null, "NETWORK_ERROR", "fos-assistant 에 연결하지 못했다."))).toBe(
      "fos-assistant 에 연결하지 못했다. (status=none, code=NETWORK_ERROR)",
    );
    expect(formatReadApplicationProfileError(new Error("일반 오류"))).toBe("일반 오류");
  });
});

describe("read_application_profile 서브프로세스", () => {
  /** 대역 서버로 CLI 를 실행한다. cwd 를 임시 디렉터리로 두어 bun 이 저장소의 .env 를 읽지 않게 한다. */
  async function run(status: 200 | 401) {
    const origins: Array<string | null> = [];
    const authorizations: Array<string | null> = [];
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        origins.push(request.headers.get("origin"));
        authorizations.push(request.headers.get("authorization"));
        return status === 200 ? ok() : new Response(null, { status: 401 });
      },
    });
    const cwd = tempDir();
    const out = join(cwd, "profile.md");
    try {
      const child = Bun.spawn([process.execPath, cliPath, "get", "--out", out], {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, FOS_ASSISTANT_URL: `http://127.0.0.1:${server.port}`, FOS_ASSISTANT_SERVICE_TOKEN: token },
      });
      const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      return { stdout, stderr, exitCode, out, origins, authorizations };
    } finally {
      await server.stop(true);
    }
  }

  test("200 이면 종료 코드 0 이고 출력에 본문과 토큰이 없다", async () => {
    const result = await run(200);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout).documentKey).toBe("career-application-profile");
    expect(readFileSync(result.out, "utf8")).toBe(content);
    for (const output of [result.stdout, result.stderr]) {
      expect(output).not.toContain("010-0000-0000");
      expect(output).not.toContain("예시 사람");
      expect(output).not.toContain(token);
    }
    expect(result.origins).toEqual([null]);
    expect(result.authorizations).toEqual([`Bearer ${token}`]);
  });

  test("401 이면 종료 코드 1 이고 stderr 에 상태만 있고 토큰이 없다", async () => {
    const result = await run(401);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("status=401");
    expect(result.stderr).toContain("code=UNAUTHORIZED");
    expect(result.stderr).not.toContain(token);
    expect(result.stdout).not.toContain(token);
    expect(result.origins.every((origin) => origin === null)).toBe(true);
    expect(existsSync(result.out)).toBe(false);
  });
});
