import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directories: string[] = [];
afterEach(() =>
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })),
);
const script = join(import.meta.dir, "drill-engine.ts");
function invoke(
  args: string[],
  environment: Record<string, string>,
): { code: number | null; stdout: string; stderr: string } {
  const result = Bun.spawnSync([process.execPath, script, ...args], {
    cwd: join(import.meta.dir, "..", ".."),
    env: { ...process.env, ...environment },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}
async function invokeAsync(
  args: string[],
  environment: Record<string, string>,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const result = Bun.spawn([process.execPath, script, ...args], {
    cwd: join(import.meta.dir, "..", ".."),
    env: { ...process.env, ...environment },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    result.exited,
    new Response(result.stdout).text(),
    new Response(result.stderr).text(),
  ]);
  return { code, stdout, stderr };
}

test("file select은 JSON과 file 저장소를 출력한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "drill-cli-"));
  directories.push(directory);
  const result = invoke(["select", "behavioral"], {
    CAREER_STORE: "file",
    CAREER_STORE_DIR: directory,
  });
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout).store).toBe("file");
});
test("attemptId 없는 record는 사용법 종료 코드로 끝난다", () => {
  const result = invoke(["record", "--drill-type", "tech"], { CAREER_STORE: "file" });
  expect(result.code).toBe(2);
  expect(result.stderr).toContain("Usage:");
});
test("닿지 않는 Backend 기록은 파일 저장으로 바꾸지 않는다", () => {
  const directory = mkdtempSync(join(tmpdir(), "drill-cli-"));
  directories.push(directory);
  const result = invoke(
    [
      "record",
      "--attempt-id",
      "33333333-3333-4333-8333-333333333333",
      "--drill-type",
      "tech",
      "--question-id",
      "question-1",
      "--topic",
      "transaction",
      "--question",
      "질문입니다.",
      "--score",
      "pass",
    ],
    {
      CAREER_STORE: "backend",
      CAREER_BACKEND_URL: "http://127.0.0.1:9",
      CAREER_BACKEND_TOKEN: "a".repeat(32),
      CAREER_STORE_DIR: directory,
    },
  );
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("연습 결과는 기록되지 않았습니다.");
  expect(existsSync(join(directory, "attempts.jsonl"))).toBeFalse();
});
test("잘못된 Backend 응답은 기록 여부를 단정하지 않는다", async () => {
  const server = Bun.serve({ port: 0, fetch: () => new Response("not-json") });
  try {
    const result = await invokeAsync(
      [
        "record",
        "--attempt-id",
        "44444444-4444-4444-8444-444444444444",
        "--drill-type",
        "tech",
        "--question-id",
        "question-1",
        "--topic",
        "transaction",
        "--question",
        "질문입니다.",
        "--score",
        "pass",
      ],
      {
        CAREER_STORE: "backend",
        CAREER_BACKEND_URL: `http://127.0.0.1:${server.port}`,
        CAREER_BACKEND_TOKEN: "a".repeat(32),
      },
    );
    expect(result.code).toBe(1);
    expect(result.stderr).not.toContain("연습 결과는 기록되지 않았습니다.");
  } finally {
    server.stop(true);
  }
});

test("저장소 설정이 없어도 brain 후보자 맥락 memory 명령은 성공한다", () => {
  const result = invoke(["memory"], { CAREER_STORE: "", CAREER_MEMORY: "brain" });
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout).provider).toBe("brain");
});

test("두 설정이 없으면 doctor 명령은 실패 항목을 JSON으로 낸다", () => {
  const result = invoke(["doctor"], { CAREER_STORE: "", CAREER_MEMORY: "" });
  expect(result.code).toBe(1);
  const parsed = JSON.parse(result.stdout) as { passed: boolean; checks: Array<{ name: string; ok: boolean }> };
  expect(parsed.passed).toBeFalse();
  expect(parsed.checks.map(({ name, ok }) => ({ name, ok }))).toEqual([
    { name: "CAREER_STORE", ok: false },
    { name: "CAREER_MEMORY", ok: false },
  ]);
});

test("유효한 file 설정의 doctor 명령은 성공한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "drill-cli-doctor-"));
  directories.push(directory);
  const memoryPath = join(directory, "candidate-memory.json");
  writeFileSync(
    memoryPath,
    JSON.stringify({
      schemaVersion: 1,
      currentRole: { title: "Backend Engineer", yearsOfExperience: 3, bar: "production" },
      experience: { direct: [], adjacent: [], studyOnly: [] },
      targets: [],
    }),
  );
  const result = invoke(["doctor"], {
    CAREER_STORE: "file",
    CAREER_STORE_DIR: join(directory, "store"),
    CAREER_MEMORY: "file",
    CAREER_MEMORY_FILE: memoryPath,
  });
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout).passed).toBeTrue();
});
