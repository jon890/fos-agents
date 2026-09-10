import { describe, expect, test } from "bun:test";
import { existsSync, rmSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { parseArgs } from "./collect_live_postings.ts";
import { SOURCE_ALIASES, SOURCE_IDS } from "./live-postings/contracts.ts";
import { DEFAULT_MAX_FAILED_SOURCES } from "./live-postings/collection_health.ts";

describe("collect_live_postings 인자", () => {
  test("JSON 후보풀 출력 경로를 받는다", () => {
    const args = parseArgs([
      "--output",
      "/tmp/posting-candidates.json",
      "--source",
      "wanted",
    ]);

    expect(args.jsonOut).toBe("/tmp/posting-candidates.json");
    expect(args.source).toBe("wanted");
    expect(args.targetRoleOnly).toBe(true);
  });

  test("개발 전체 직무 수집 인자와 기존 별칭을 지원한다", () => {
    const currentArgs = parseArgs([
      "--output",
      "/tmp/posting-candidates.json",
      "--all-development-roles",
    ]);
    const args = parseArgs([
      "--output",
      "/tmp/posting-candidates.json",
      "--no-server-only",
    ]);

    expect(currentArgs.targetRoleOnly).toBe(false);
    expect(args.targetRoleOnly).toBe(false);
  });

  test("어댑터에 등록된 모든 소스 이름과 별칭을 받는다", () => {
    for (const name of [...SOURCE_IDS, ...SOURCE_ALIASES]) {
      const args = parseArgs(["--output", "/tmp/posting-candidates.json", "--source", name]);
      expect(args.source).toBe(name);
    }
  });

  test("모르는 소스 이름은 전체 수집으로 떨어지지 않고 중단한다", () => {
    expect(() =>
      parseArgs(["--output", "/tmp/posting-candidates.json", "--source", "woowahaan"])
    ).toThrow("is not a known source");
  });

  test("출력 경로가 없으면 저장소 state에 쓰지 않고 중단한다", () => {
    expect(() => parseArgs([])).toThrow("--output <output-json> is required");
  });

  test("전체 수집은 실패 소스 허용 개수를 기본값으로 받는다", () => {
    const args = parseArgs(["--output", "/tmp/posting-candidates.json"]);

    expect(args.source).toBe("all");
    expect(args.maxFailedSources).toBe(DEFAULT_MAX_FAILED_SOURCES);
  });

  test("단일 소스 수집은 실패 하나에도 중단하도록 허용 개수가 0이다", () => {
    const args = parseArgs(["--output", "/tmp/posting-candidates.json", "--source", "coupang"]);

    expect(args.maxFailedSources).toBe(0);
  });

  test("실패 소스 허용 개수를 인자로 덮어쓴다", () => {
    const args = parseArgs([
      "--output",
      "/tmp/posting-candidates.json",
      "--max-failed-sources",
      "5",
    ]);

    expect(args.maxFailedSources).toBe(5);
  });

  test("전체 수집에서 명시한 0이 기본값으로 되돌아가지 않는다", () => {
    const args = parseArgs([
      "--output",
      "/tmp/posting-candidates.json",
      "--max-failed-sources",
      "0",
    ]);

    expect(args.source).toBe("all");
    expect(args.maxFailedSources).toBe(0);
  });

  test("실패 소스 허용 개수가 음수, 소수, 공백, 16진수, 문자열이면 중단한다", () => {
    for (const raw of ["-1", "2.5", " ", "", "0x10", "1e2", "many"]) {
      expect(() =>
        parseArgs(["--output", "/tmp/posting-candidates.json", "--max-failed-sources", raw])
      ).toThrow("must be a non-negative integer");
    }
  });

  test("실패 소스 허용 개수에 값을 주지 않으면 기본값으로 흐르지 않고 중단한다", () => {
    expect(() =>
      parseArgs(["--output", "/tmp/posting-candidates.json", "--max-failed-sources"])
    ).toThrow("must be a non-negative integer");
  });

  test("모르는 옵션 이름은 기본 동작으로 흐르지 않고 중단한다", () => {
    expect(() =>
      parseArgs(["--output", "/tmp/posting-candidates.json", "--max-failed-source", "5"])
    ).toThrow("--max-failed-source is not a known option");
  });

  test("값을 받는 옵션에 값이 없으면 중단한다", () => {
    expect(() => parseArgs(["--output"])).toThrow("--output requires a value");
    expect(() => parseArgs(["--output", "/tmp/o.json", "--source"])).toThrow(
      "--source requires a value"
    );
  });

  test("공고 수 상한도 같은 규칙으로 검증한다", () => {
    expect(() =>
      parseArgs(["--output", "/tmp/posting-candidates.json", "--max-wanted", "many"])
    ).toThrow("must be a non-negative integer");
    expect(
      parseArgs(["--output", "/tmp/posting-candidates.json", "--max-wanted", "30"]).wantedLimit
    ).toBe(30);
  });

  // 아래 검사는 판정을 붙인 이유 자체를 지킨다.
  // 종료 코드 계산을 후보풀 쓰기보다 앞으로 옮기거나 실패 반환을 되돌리면 여기서 잡힌다.
  test("소스가 실패하면 후보풀을 남기고 종료 코드 1로 끝낸다", async () => {
    const dir = mkdtempSync(`${tmpdir()}/posting-candidates-`);
    const out = `${dir}/pool.json`;
    const exclusions = `${dir}/exclusions.json`;
    writeFileSync(exclusions, JSON.stringify({ schemaVersion: 1, exclusions: [] }));
    // 닫힌 포트를 프록시로 지정해 네트워크 없이 연결 실패를 만든다.
    const blocked = { HTTPS_PROXY: "http://127.0.0.1:1", HTTP_PROXY: "http://127.0.0.1:1" };
    const child = Bun.spawn(
      ["bun", `${import.meta.dir}/collect_live_postings.ts`, "--source", "woowahan", "--output", out, "--exclusions-config", exclusions],
      { stdout: "pipe", stderr: "pipe", env: { ...process.env, ...blocked } },
    );
    const [stderr, exitCode] = await Promise.all([
      new Response(child.stderr).text(),
      child.exited,
    ]);

    try {
      expect(exitCode).toBe(1);
      expect(stderr).toContain("FAIL collection health");
      expect(stderr).toContain("woowahan-careers");
      expect(existsSync(out)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  test("출력 경로 누락 오류는 절대 경로나 stack trace를 노출하지 않는다", async () => {
    const process = Bun.spawn(["bun", `${import.meta.dir}/collect_live_postings.ts`], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);

    expect(exitCode).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toBe("--output <output-json> is required\n");
    expect(stderr).not.toContain(import.meta.dir);
  });
});
