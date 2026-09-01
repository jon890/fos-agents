import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveStudyRunRoot, StudyRunPathError } from "./runtime-paths.js";

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
});

test("CLI 경로 오류는 stack trace와 절대 경로를 출력하지 않는다", () => {
  const environment = { ...process.env };
  delete environment.CAREER_OS_ROOT;
  for (const script of ["build_morning_reading.ts", "validate_outputs.ts"]) {
    const result = Bun.spawnSync(["bun", resolve(import.meta.dir, script)], { env: environment });
    const stderr = result.stderr.toString();

    expect(result.exitCode).toBe(2);
    expect(stderr).toBe("CAREER_OS_ROOT에 시스템 임시 실행 경로를 지정해야 한다.\n");
    expect(stderr).not.toContain("StudyRunPathError");
    expect(stderr).not.toContain(import.meta.dir);
  }
});

test("CLI는 시스템 임시 디렉터리 밖 경로를 오류에 노출하지 않는다", () => {
  const rejectedPath = resolve(import.meta.dir, "..");
  const result = Bun.spawnSync([
    "bun",
    resolve(import.meta.dir, "build_morning_reading.ts"),
    "--collect-only",
  ], { env: { ...process.env, CAREER_OS_ROOT: rejectedPath } });
  const stderr = result.stderr.toString();

  expect(result.exitCode).toBe(2);
  expect(stderr).toContain("시스템 임시 디렉터리");
  expect(stderr).not.toContain("StudyRunPathError");
  expect(stderr).not.toContain(rejectedPath);
});
