import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

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
  expect(JSON.parse(result.stdout)).toMatchObject({ action: "paths", ok: true, root, mode: "local", evidenceDir: join(root, "evidence") });
});

test("workspace paths 는 CAREER_EVIDENCE_DIR 를 프로젝트 근거 위치로 낸다", async () => {
  const cwd = temporaryDirectory();
  const evidenceDir = join(cwd, "evidence-elsewhere");
  const result = await runBundle(cwd, ["workspace", "paths", "--json"], { CAREER_EVIDENCE_DIR: evidenceDir });
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ evidenceDir });
});

test("position --help 는 0 으로 끝나고 하위 명령을 보여 준다", async () => {
  const result = await runBundle(temporaryDirectory(), ["position", "--help"]);
  expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(result.stdout).toContain("commit-company-tiers");
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

/** 지어낸 주장 하나를 담은 검증 완료 주장 상태 파일이다. */
function verifiedClaimsFile(claimKey: string, proposedText: string) {
  return {
    schemaVersion: 1,
    groupKey: "other/example.json",
    claims: [
      {
        claimKey,
        claim: {
          id: "claim-1",
          text: proposedText,
          location: "profile",
          type: "implementation",
          implementation: { status: "user_attested", evidence: [] },
          ownership: { status: "user_attested", evidence: [] },
          outcome: { status: "not_claimed", evidence: [] },
          verdict: "safe",
          proposedText,
        },
        evidenceSnapshots: [],
        origins: [],
      },
    ],
  };
}

function writeJson(filePath: string, value: unknown) {
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value));
}

test("resume search-claims 는 --state-dir 가 없으면 작업본의 검증 완료 주장을 읽는다", async () => {
  const cwd = temporaryDirectory();
  const root = join(cwd, "workspace");
  const workspaceKey = "a".repeat(64);
  const repositoryKey = "b".repeat(64);
  writeJson(
    join(root, "state", "verified-claims", "other", "example.json"),
    verifiedClaimsFile(workspaceKey, "예시 검색 플랫폼을 작업본에서 만들었다"),
  );
  writeJson(
    join(cwd, "career-os", "state", "verified-claims", "other", "example.json"),
    verifiedClaimsFile(repositoryKey, "예시 검색 플랫폼을 저장소에서 만들었다"),
  );

  const result = await runBundle(cwd, ["resume", "search-claims", "예시 검색 플랫폼"], { CAREER_WORKSPACE_ROOT: root });
  expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({ exitCode: 0, stderr: "" });
  const keys = (JSON.parse(result.stdout) as { results: Array<{ claimKey: string }> }).results.map((item) => item.claimKey);
  expect(keys).toEqual([workspaceKey]);
});

// 지어낸 1×1 투명 PNG 다. 실제 로고 이미지를 테스트에 쓰지 않는다.
const ONE_PIXEL_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c6360000200000500017a5eab3f0000000049454e44ae426082",
  "hex",
);

test("resume export 는 --logo-dir 가 없으면 작업본의 로고를 붙인다", async () => {
  const cwd = temporaryDirectory();
  // CAREER_WORKSPACE_ROOT 를 주지 않으면 원본의 기본값은 <cwd>/career-os 라서, 실행기가 주입한 plugin 작업본 root 와 다르다.
  const root = join(cwd, ".fos-career", "workspace");
  const logoDir = join(root, "library", "resume-logos");
  mkdirSync(logoDir, { recursive: true });
  writeFileSync(join(logoDir, "example.png"), ONE_PIXEL_PNG);
  writeFileSync(join(logoDir, "index.json"), JSON.stringify({ map: { 예시회사: "example.png" } }));
  const applicationDir = join(cwd, "application");
  mkdirSync(join(applicationDir, "evidence"), { recursive: true });
  writeFileSync(
    join(applicationDir, "evidence", "resume-draft.md"),
    "# 김예시\n\n## 경력\n\n### 예시회사 · 백엔드 개발\n\n- 예시 서비스를 운영했다.\n",
  );

  // Chrome 이 없으므로 PDF 단계에서 실패하지만, 그 앞에서 HTML 을 쓴다.
  const result = await runBundle(
    cwd,
    ["resume", "export", "--application-dir", applicationDir, "--chrome-bin", "/not-used"],
  );
  expect(result.exitCode).toBe(1);
  const html = readFileSync(join(applicationDir, "review", "resume.html"), "utf8");
  expect(html).toContain(`data:image/png;base64,${ONE_PIXEL_PNG.toString("base64")}`);
});

/**
 * 실제 파이썬 실행 파일이 있는 디렉터리.
 * python3 가 mise shim 이면 shim 은 HOME 아래 설정과 설치 위치를 찾으므로, HOME 을 비우면 설치를 새로 내려받는다.
 * 실행 파일 디렉터리를 PATH 앞에 두어 shim 을 거치지 않게 한다.
 */
function pythonDirectory(): string {
  const result = Bun.spawnSync(["python3", "-c", "import sys; print(sys.executable)"], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`python3 를 찾지 못했다: ${result.stderr.toString()}`);
  return dirname(result.stdout.toString().trim());
}

/** UTC 로 가장 최근에 끝난 달(`YYYY-MM`). 기록이 없을 때 수집기가 대상으로 잡는 달이다. */
function lastEndedMonth(now: Date): string {
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

test("usage 는 번들에 든 측정 스크립트로 세션이 없는 달을 알리고 아무것도 올리지 않는다", async () => {
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      requests.push(`${request.method} ${url.pathname}`);
      if (request.method === "GET" && url.pathname === "/api/profile/v1/usage-snapshots") {
        return Response.json({ snapshots: [] });
      }
      return new Response("not found", { status: 404 });
    },
  });
  try {
    const home = temporaryDirectory();
    const before = lastEndedMonth(new Date());
    const result = await runBundle(home, ["usage"], {
      PATH: `${pythonDirectory()}:${process.env.PATH ?? ""}`,
      CAREER_BACKEND_URL: server.url.origin,
      CAREER_BACKEND_TOKEN: FAKE_TOKEN,
    });
    const after = lastEndedMonth(new Date());
    expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({ exitCode: 0, stderr: "" });
    // 실행 중에 달이 바뀌면 둘 중 하나다.
    expect([`${before} NO_SESSIONS\n`, `${after} NO_SESSIONS\n`]).toContain(result.stdout);
    expect(requests).toEqual(["GET /api/profile/v1/usage-snapshots"]);
    expect(requests.filter((request) => request.startsWith("PUT "))).toEqual([]);
  } finally {
    server.stop(true);
  }
});
