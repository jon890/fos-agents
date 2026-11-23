import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SUBPROCESS_TEST_TIMEOUT_MS } from "../lib/test-timeouts.ts";

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
function workspace(): string {
  const directory = mkdtempSync(join(tmpdir(), "drill-cli-"));
  directories.push(directory);
  return directory;
}
const recordArgs = [
  "record",
  "--drill-type",
  "tech",
  "--question-id",
  "question-1",
  "--topic",
  "transaction",
  "--question",
  "질문입니다.",
];

test("select 는 작업 폴더의 SQLite 를 만들고 JSON 을 출력한다", () => {
  const root = workspace();
  const result = invoke(["select", "behavioral"], { CAREER_WORKSPACE_ROOT: root });
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout).questions.length).toBeGreaterThan(0);
  expect(Bun.file(join(root, "state", "career.sqlite")).size).toBeGreaterThan(0);
}, SUBPROCESS_TEST_TIMEOUT_MS);

test("필수 값이 빠진 record 는 사용법 종료 코드로 끝난다", () => {
  const result = invoke(["record", "--drill-type", "tech"], { CAREER_WORKSPACE_ROOT: workspace() });
  expect(result.code).toBe(2);
  expect(result.stderr).toContain("Usage:");
}, SUBPROCESS_TEST_TIMEOUT_MS);

test("프로세스를 나눠 기록해도 다음 실행이 앞 연습의 복습 상태와 개인 질문을 본다", () => {
  const root = workspace();
  const environment = { CAREER_WORKSPACE_ROOT: root };
  const personal = {
    drillType: "tech",
    id: "personal-cli-1",
    topic: "cli-personal-topic",
    category: "database",
    difficulty: "basic",
    question: "개인 질문입니다.",
    intent: "의도를 확인합니다.",
    answerSignals: ["신호"],
  };
  const file = join(root, "personal.json");
  writeFileSync(file, JSON.stringify(personal));
  expect(invoke(["personal", "add", "--file", file], environment).code).toBe(0);
  const recorded = invoke([...recordArgs, "--score", "fail"], environment);
  expect(recorded.code).toBe(0);
  const attempt = JSON.parse(recorded.stdout) as { attemptId: string; progress: { nextReviewDate: string } };

  // 같은 attemptId 를 다시 보내면 처음 응답을 돌려주고 실패 횟수를 더 올리지 않는다.
  const replayed = invoke([...recordArgs, "--score", "fail", "--attempt-id", attempt.attemptId], environment);
  expect(JSON.parse(replayed.stdout)).toEqual(attempt);

  const progress = JSON.parse(invoke(["progress", "tech"], environment).stdout) as {
    items: Array<{ topic: string; failCount: number; nextReviewDate: string; dueForReview: boolean }>;
  };
  expect(progress.items).toEqual([
    expect.objectContaining({
      topic: "transaction",
      failCount: 1,
      nextReviewDate: attempt.progress.nextReviewDate,
      dueForReview: false,
    }),
  ]);
  const listed = JSON.parse(invoke(["personal", "list", "tech"], environment).stdout) as { items: Array<{ id: string }> };
  expect(listed.items.map((item) => item.id)).toEqual(["personal-cli-1"]);
  expect(invoke(["personal", "disable", "--question-id", "personal-cli-1"], environment).code).toBe(0);
  expect(JSON.parse(invoke(["personal", "list", "tech"], environment).stdout).items).toEqual([]);
}, SUBPROCESS_TEST_TIMEOUT_MS * 3);

test("깨진 커리어 데이터 파일은 덮어쓰지 않고 첫 줄에 CAREER_STORE_CORRUPT 를 낸다", () => {
  const root = workspace();
  mkdirSync(join(root, "state"), { recursive: true });
  writeFileSync(join(root, "state", "career.sqlite"), "SQLite 가 아니다\n".repeat(200));
  const result = invoke([...recordArgs, "--score", "pass"], { CAREER_WORKSPACE_ROOT: root });
  expect(result.code).toBe(1);
  expect(result.stderr.split("\n")[0]).toStartWith("CAREER_STORE_CORRUPT:");
}, SUBPROCESS_TEST_TIMEOUT_MS);

test("작업 폴더에 없는 후보자 맥락 문서는 memory 명령이 빠진 키를 담아 실패한다", () => {
  const root = workspace();
  mkdirSync(join(root, "context"), { recursive: true });
  writeFileSync(join(root, "context", "career-status.md"), "# 합성 경력 상태\n");
  const result = invoke(["memory"], { CAREER_WORKSPACE_ROOT: root, CAREER_MEMORY: "context" });
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("application-state");
  expect(result.stderr).not.toContain("career-status,");
}, SUBPROCESS_TEST_TIMEOUT_MS);

test("작업 폴더에 두 문서가 있으면 memory 명령이 본문과 기준 버전을 낸다", () => {
  const root = workspace();
  mkdirSync(join(root, "context"), { recursive: true });
  writeFileSync(join(root, "context", "career-status.md"), "# 합성 경력 상태\n");
  writeFileSync(join(root, "context", "application-state.md"), "# 합성 지원 상태\n");
  const result = invoke(["memory"], { CAREER_WORKSPACE_ROOT: root, CAREER_MEMORY: "context" });
  expect(result.code).toBe(0);
  const parsed = JSON.parse(result.stdout) as { provider: string; documents: Array<{ documentKey: string; version: string; body: string }> };
  expect(parsed.provider).toBe("context");
  expect(parsed.documents.map((document) => document.body)).toEqual(["# 합성 경력 상태", "# 합성 지원 상태"]);
  expect(parsed.documents[0]?.version).toStartWith("career-status:sha256:");
}, SUBPROCESS_TEST_TIMEOUT_MS);

test("후보자 맥락 설정이 없으면 doctor 명령은 실패 항목을 JSON으로 낸다", () => {
  const result = invoke(["doctor"], { CAREER_WORKSPACE_ROOT: workspace(), CAREER_MEMORY: "" });
  expect(result.code).toBe(1);
  const parsed = JSON.parse(result.stdout) as { passed: boolean; checks: Array<{ name: string; ok: boolean }> };
  expect(parsed.passed).toBeFalse();
  expect(parsed.checks.map(({ name, ok }) => ({ name, ok }))).toEqual([
    { name: "CAREER_WORKSPACE", ok: true },
    { name: "CAREER_MEMORY", ok: false },
  ]);
}, SUBPROCESS_TEST_TIMEOUT_MS);

test("유효한 file 설정의 doctor 명령은 성공한다", () => {
  const directory = workspace();
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
    CAREER_WORKSPACE_ROOT: directory,
    CAREER_MEMORY: "file",
    CAREER_MEMORY_FILE: memoryPath,
  });
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout).passed).toBeTrue();
}, SUBPROCESS_TEST_TIMEOUT_MS);
