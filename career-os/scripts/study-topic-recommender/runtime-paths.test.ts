import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveStudyRunRoot, StudyRunPathError, validateStudyCleanupDirectory } from "./runtime-paths.js";
import { SUBPROCESS_TEST_TIMEOUT_MS } from "../lib/test-timeouts.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("아침 읽을거리 실행 경로", () => {
  test("시스템 임시 디렉터리의 지정 접두사 경로를 허용한다", () => {
    const directory = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
    temporaryDirectories.push(directory);

    expect(resolveStudyRunRoot({ CAREER_OS_ROOT: directory })).toBe(realpathSync(directory));
    expect(resolveStudyRunRoot({}, directory)).toBe(realpathSync(directory));
    expect(resolveStudyRunRoot({ CAREER_OS_ROOT: directory }, directory)).toBe(realpathSync(directory));
  });

  test("명시적 실행 경로가 없으면 중단한다", () => {
    expect(() => resolveStudyRunRoot({})).toThrow(StudyRunPathError);
  });

  test("시스템 임시 디렉터리 밖 경로와 다른 접두사를 거부한다", () => {
    const wrongPrefix = mkdtempSync(join(tmpdir(), "morning-reading."));
    temporaryDirectories.push(wrongPrefix);

    expect(() => resolveStudyRunRoot({ CAREER_OS_ROOT: wrongPrefix })).toThrow(StudyRunPathError);
    expect(() => resolveStudyRunRoot({ CAREER_OS_ROOT: resolve(import.meta.dir, "..") }))
      .toThrow(StudyRunPathError);
  });

  test("--run-dir와 CAREER_OS_ROOT가 다르면 사용법 오류로 실패한다", () => {
    const first = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
    const second = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
    temporaryDirectories.push(first, second);

    expect(() => resolveStudyRunRoot({ CAREER_OS_ROOT: first }, second)).toThrow(StudyRunPathError);
  });
});

test("CLI 경로 오류는 stack trace와 절대 경로를 출력하지 않는다", () => {
  const environment = { ...process.env };
  delete environment.CAREER_OS_ROOT;
  const expectedErrors = {
    "build_morning_reading.ts": "하위 동작 플래그 하나가 필요하다: --doctor, --collect-only, --prepare-candidates, --reading-selection, --commit-recommendation, --record-publication, --list-recommendations, --cleanup, --render-only",
    "validate_outputs.ts": "CAREER_OS_ROOT 또는 --run-dir에 실행 경로를 지정해야 한다.",
  } as const;
  for (const [script, expectedError] of Object.entries(expectedErrors)) {
    const result = Bun.spawnSync([process.execPath, resolve(import.meta.dir, script)], { env: environment });
    const stderr = result.stderr.toString();

    expect(result.exitCode).toBe(2);
    expect(stderr).toBe(`${expectedError}\n`);
    expect(stderr).not.toContain("StudyRunPathError");
    expect(stderr).not.toContain(import.meta.dir);
  }
}, SUBPROCESS_TEST_TIMEOUT_MS);

test("CLI는 시스템 임시 디렉터리 밖 경로를 오류에 노출하지 않는다", () => {
  const rejectedPath = resolve(import.meta.dir, "..");
  const result = Bun.spawnSync([
    process.execPath,
    resolve(import.meta.dir, "build_morning_reading.ts"),
    "--collect-only",
  ], { env: { ...process.env, CAREER_OS_ROOT: rejectedPath } });
  const stderr = result.stderr.toString();

  expect(result.exitCode).toBe(2);
  expect(stderr).toContain("작업 폴더 runs/ 나 시스템 임시 디렉터리");
  expect(stderr).not.toContain("StudyRunPathError");
  expect(stderr).not.toContain(rejectedPath);
}, SUBPROCESS_TEST_TIMEOUT_MS);

test("validate_outputs.ts --run-dir는 같은 실행 경로를 읽는다", () => {
  const directory = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
  temporaryDirectories.push(directory);

  const result = Bun.spawnSync([
    process.execPath,
    resolve(import.meta.dir, "validate_outputs.ts"),
    "--run-dir",
    directory,
  ], { env: { ...process.env, CAREER_OS_ROOT: directory } });

  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("산출물이 없거나 비어 있다");
}, SUBPROCESS_TEST_TIMEOUT_MS);

test("작업 폴더 runs/ 아래의 실행 폴더를 받고 정리할 수 있다", () => {
  const workspace = mkdtempSync(join(tmpdir(), "career-workspace-"));
  try {
    const runs = join(workspace, "runs");
    mkdirSync(runs);
    const directory = mkdtempSync(join(runs, "study-topic-recommender."));
    const environment = { CAREER_WORKSPACE_ROOT: workspace };
    expect(resolveStudyRunRoot(environment, directory)).toBe(realpathSync(directory));
    expect(validateStudyCleanupDirectory(directory, environment)).toBe(realpathSync(directory));
    // 접두사가 다르거나 작업 폴더의 다른 자리면 거부한다.
    const other = join(runs, "other-run");
    mkdirSync(other);
    expect(() => resolveStudyRunRoot(environment, other)).toThrow(StudyRunPathError);
    mkdirSync(join(workspace, "state", "study-topic-recommender.x"), { recursive: true });
    expect(() => validateStudyCleanupDirectory(join(workspace, "state", "study-topic-recommender.x"), environment)).toThrow(StudyRunPathError);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
