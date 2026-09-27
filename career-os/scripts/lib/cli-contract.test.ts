import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { runInterviewQuestionSources } from "../interview-question-sources/cli.ts";
import { validateMorningReadingOutputs } from "../study-topic-recommender/validate_outputs.ts";
import { firstOptionValue } from "./cli.ts";

const scripts = resolve(import.meta.dir, "..");
let directory: string;

function invoke(script: string, args: string[] = [], imported = false, environment: NodeJS.ProcessEnv = {}) {
  const path = resolve(scripts, script);
  const command = imported
    ? ["-e", `await import(${JSON.stringify(path)})`, ...args]
    : [path, ...args];
  const result = Bun.spawnSync([process.execPath, ...command], {
    cwd: directory,
    env: { ...process.env, CAREER_OS_ROOT: "", TMPDIR: tmpdir(), ...environment },
    stdout: "pipe",
    stderr: "pipe",
  });
  return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
}

beforeAll(() => {
  directory = mkdtempSync("/tmp/career-cli-contract.");
});

afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("CLI 밖에서 호출하는 핵심 함수", () => {
  test("질문 소스 함수는 stdout 대신 데이터를 반환한다", async () => {
    expect(await runInterviewQuestionSources("validate", [])).toMatchObject({ status: "ok" });
    expect(Array.isArray(await runInterviewQuestionSources("list", []))).toBe(true);
    await expect(runInterviewQuestionSources("collect", [])).rejects.toThrow(
      "collect에는 --output과 --cache-dir가 필요하다.",
    );
  });


  test("산출물 검사 실패는 호출자에게 예외로 전달한다", () => {
    expect(() => validateMorningReadingOutputs(directory)).toThrow("산출물이 없거나 비어 있다");
  });

  test("첫 옵션값 조회는 원본 argv를 변경하지 않는다", () => {
    const args = ["--input", "--next", "--input", "last", "--empty"];
    expect(firstOptionValue(args, "--input")).toBe("--next");
    expect(firstOptionValue(args, "--empty")).toBeUndefined();
    expect(firstOptionValue(args, "--absent")).toBeUndefined();
    expect(args).toEqual(["--input", "--next", "--input", "last", "--empty"]);
  });

  test("import는 실행하거나 출력하지 않는다", () => {
    for (const script of [
      "interview-drill/application_question_schema.ts",
      "interview-drill/drill-engine.ts",
      "study-topic-recommender/morning_reading_cli.ts",
    ]) {
      expect(invoke(script, [], true)).toEqual({ code: 0, out: "", err: "" });
    }
  });
});

describe("기존 명령 및 공용 runCli", () => {
  test("질문 소스의 기본 validate, list, 사용법 오류를 보존하고 import는 실행하지 않는다", () => {
    const script = "interview-question-sources/cli.ts";
    const result = invoke(script);
    expect(result.code).toBe(0);
    expect(result.err).toBe("");
    expect(JSON.parse(result.out)).toMatchObject({ status: "ok" });
    expect(invoke(script, [], true)).toEqual({ code: 0, out: "", err: "" });
    expect(Array.isArray(JSON.parse(invoke(script, ["list"]).out))).toBe(true);
    expect(invoke(script, ["collect"])).toEqual({
      code: 1,
      out: "",
      err: "collect에는 --output과 --cache-dir가 필요하다.\n",
    });
  });

  test("읽을거리 관리의 help와 JSON 템플릿을 보존한다", () => {
    const script = "study-topic-recommender/manage_reading_sources.ts";
    const help = invoke(script);
    expect(help.code).toBe(0);
    expect(help.err).toBe("");
    expect(help.out).toStartWith("사용법:");
    expect(help.out).toContain("\n로컬 명령:\n");
    expect(help.out).not.toContain('"');
    expect(help.out).not.toContain("\\n");
    expect(invoke(script, ["help"])).toEqual(help);
    expect(invoke(script, ["--help"])).toEqual(help);
    expect(invoke(script, ["-h"])).toEqual(help);
    expect(invoke(script, [], true)).toEqual({ code: 0, out: "", err: "" });
    expect(invoke(script, ["template"])).toEqual({
      code: 1,
      out: "",
      err: "--key 값이 필요하다.\n",
    });
    const template = invoke(script, [
      "template",
      "--key",
      "example-test-feed",
      "--category",
      "techBlog",
      "--title",
      "예시",
      "--feed-url",
      "https://example.com/feed.xml",
      "--adapter",
      "feed",
      "--note",
      "템플릿을 확인한다",
    ]);
    expect(template.code).toBe(0);
    expect(template.err).toBe("");
    expect(JSON.parse(template.out)).toEqual({
      sourceKey: "example-test-feed",
      payload: {
        title: "예시",
        category: "techBlog",
        adapter: "feed",
        url: null,
        feedUrl: "https://example.com/feed.xml",
        enabled: true,
        note: "템플릿을 확인한다",
        expectedVersion: 0,
      },
    });
  });

  test("아침 읽을거리의 경로 검증이 네트워크 실행보다 먼저 실패한다", () => {
    for (const script of [
      "study-topic-recommender/morning_reading_cli.ts",
      "study-topic-recommender/build_morning_reading.ts",
    ]) {
      expect(invoke(script, ["--collect-only"])).toEqual({
        code: 2,
        out: "",
        err: "CAREER_OS_ROOT 또는 --run-dir에 시스템 임시 실행 경로를 지정해야 한다.\n",
      });
    }
  });

  test.each(["--help", "-h"])("아침 읽을거리의 %s는 잘못된 인자보다 우선한다", (flag) => {
    for (const script of ["morning_reading_cli.ts", "build_morning_reading.ts"]) {
      const result = invoke(`study-topic-recommender/${script}`, ["--unknown", "--run-dir", flag]);
      expect(result.code).toBe(0);
      expect(result.err).toBe("");
      expect(result.out).toStartWith("사용법:");
      expect(result.out).toContain("--cleanup");
      expect(result.out).toContain("--reading-selection <파일>");
      expect(result.out).toContain("--candidate-pool <값>");
    }
  });

  test.each(["--run-dir", "CAREER_OS_ROOT"])("아침 읽을거리 cleanup은 정상 임시 실행 디렉터리를 지운다: %s", (source) => {
    const root = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
    try {
      writeFileSync(join(root, "report.html"), "보고서");
      const args = source === "--run-dir" ? ["--cleanup", "--run-dir", root] : ["--cleanup"];
      const result = invoke("study-topic-recommender/morning_reading_cli.ts", args, false,
        source === "CAREER_OS_ROOT" ? { CAREER_OS_ROOT: root } : {});
      expect(result).toEqual({ code: 0, out: `정리 완료: ${basename(root)}\n`, err: "" });
      expect(existsSync(root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test.each(["outside", "wrong-prefix", "nested", "symlink", "env-symlink", "file", "missing", "empty"])(
    "아침 읽을거리 cleanup은 안전하지 않은 경로를 보존하고 코드 2로 거절한다: %s", (kind) => {
      const fixture = mkdtempSync(join(directory, "cleanup."));
      const tempRoot = join(fixture, "temp");
      mkdirSync(tempRoot);
      const preserved = join(tempRoot, "study-topic-recommender.preserved");
      mkdirSync(preserved);
      writeFileSync(join(preserved, "keep.txt"), "보존");
      let target = join(tempRoot, "study-topic-recommender.target");
      if (kind === "outside") target = join(fixture, "study-topic-recommender.outside");
      if (kind === "wrong-prefix") target = join(tempRoot, "unrelated");
      if (kind === "nested") target = join(preserved, "study-topic-recommender.nested");
      if (kind === "empty") target = "";
      if (kind === "symlink" || kind === "env-symlink") symlinkSync(preserved, target);
      else if (kind === "file") writeFileSync(target, "보존");
      else if (kind !== "missing" && kind !== "empty") {
        mkdirSync(target);
        writeFileSync(join(target, "keep.txt"), "보존");
      }
      const result = invoke("study-topic-recommender/morning_reading_cli.ts", [
        "--cleanup", "--run-dir", kind === "env-symlink" ? preserved : target,
      ], false, { TMPDIR: tempRoot, CAREER_OS_ROOT: kind === "env-symlink" ? target : "" });

      expect(result.code).toBe(2);
      expect(result.out).toBe("");
      expect(readFileSync(join(preserved, "keep.txt"), "utf8")).toBe("보존");
      if (kind === "symlink" || kind === "env-symlink") expect(lstatSync(target).isSymbolicLink()).toBe(true);
      else if (kind === "file") expect(readFileSync(target, "utf8")).toBe("보존");
      else if (kind !== "missing" && kind !== "empty") {
        expect(readFileSync(join(target, "keep.txt"), "utf8")).toBe("보존");
      }
    },
  );

  test("산출물 검증기의 경로 실패 코드 2를 보존하고 import는 실행하지 않는다", () => {
    const script = "study-topic-recommender/validate_outputs.ts";
    const result = invoke(script);
    expect(result).toEqual({
      code: 2,
      out: "",
      err: "CAREER_OS_ROOT 또는 --run-dir에 시스템 임시 실행 경로를 지정해야 한다.\n",
    });
    expect(invoke(script, [], true)).toEqual({ code: 0, out: "", err: "" });
  });

  test("기존 runCli의 JSON, help와 사용법 오류 계약을 보존한다", () => {
    const fixture = join(directory, "run-cli.ts");
    writeFileSync(
      fixture,
      `import { runCli, UsageError } from ${JSON.stringify(join(scripts, "lib/cli.ts"))};\nawait runCli({name: 'fixture', summary: 'test', positional: [{name:'input', description:'input'}]}, ({positional}) => {if(positional[0] === 'usage') throw new UsageError('bad input'); if(positional[0] === 'error') throw new Error('failed'); return {passed: positional[0] === 'ok', value: positional[0]};});`,
    );
    expect(invoke(fixture, ["ok"])).toEqual({
      code: 0,
      out: '{\n  "passed": true,\n  "value": "ok"\n}\n',
      err: "",
    });
    expect(invoke(fixture, ["no"]).code).toBe(1);
    expect(invoke(fixture, ["error"])).toEqual({
      code: 1,
      out: "",
      err: '{\n  "passed": false,\n  "error": "failed"\n}\n',
    });
    expect(invoke(fixture, ["--help"]).code).toBe(0);
    expect(invoke(fixture, ["usage"]).code).toBe(2);
    expect(invoke(fixture).code).toBe(2);
  });
});
