import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { SUBPROCESS_TEST_TIMEOUT_MS } from "../lib/test-timeouts.ts";
import { runPackageCommand } from "./cli.ts";

const directories: string[] = [];
let logged: string[];
let errored: string[];
let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  logged = [];
  errored = [];
  logSpy = spyOn(console, "log").mockImplementation((...values: unknown[]) => { logged.push(values.join(" ")); });
  errorSpy = spyOn(console, "error").mockImplementation((...values: unknown[]) => { errored.push(values.join(" ")); });
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "application-package-cli-"));
  directories.push(directory);
  return directory;
}

function write(directory: string, relativePath: string, content: string): void {
  const path = join(directory, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

/** 지어낸 회사와 직무의 질문 파일이다. */
function questionsFile(): string {
  return JSON.stringify({
    schemaVersion: 1,
    company: "예시 회사",
    role: "Backend Developer",
    sourceDocuments: ["evidence/fit.md"],
    questions: [
      {
        id: "example-position-question",
        drillType: "tech",
        topic: "position-question",
        category: "platform",
        difficulty: "advanced",
        question: "여러 팀이 함께 쓰는 예시 플랫폼의 공통 계약을 어떻게 설계하겠습니까?",
        intent: "공통 플랫폼 책임에 맞는 판단을 확인한다.",
        answerSignals: ["입출력 계약", "오류 경계"],
        positionFitHint: "지원 포지션의 핵심 책임과 연결한다.",
        origin: "posting_requirement",
        evidenceBoundary: "설계 질문이며 운영 경험으로 확대하지 않는다.",
      },
    ],
  });
}

/** 검토 화면을 그릴 수 있는 최소 지원 디렉터리다. */
function applicationDirectory(): string {
  const directory = temporaryDirectory();
  write(directory, "evidence/status.md", "# 예시 회사 지원\n\n- readiness: needs_user_input\n\n## 제출 준비 상태\n\n내용\n");
  write(directory, "evidence/fit.md", "## 결론\n\n예시 결론 문장\n");
  write(directory, "evidence/interview-questions.json", questionsFile());
  return directory;
}

describe("package validate", () => {
  test("내부 정보가 없는 제출 문서는 0 으로 끝나고 결과 JSON 을 낸다", async () => {
    const directory = applicationDirectory();
    write(directory, "evidence/resume-draft.md", "## 경력\n\n예시 서비스를 운영했다.\n");

    expect(await runPackageCommand(["validate", directory], {})).toBe(0);
    expect(JSON.parse(logged.join("\n"))).toMatchObject({ passed: true, errors: [] });
  });

  test("제출 이력서에 내부 근거 경로가 있으면 1 로 끝난다", async () => {
    const directory = applicationDirectory();
    write(directory, "evidence/resume-draft.md", "## 경력\n\nsources/fos-study/task/example.md\n");

    expect(await runPackageCommand(["validate", directory], {})).toBe(1);
    const result = JSON.parse(logged.join("\n"));
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("evidence/resume-draft.md");
  });

  test("지원 디렉터리가 없으면 사용법 오류 2 로 끝난다", async () => {
    expect(await runPackageCommand(["validate"], {})).toBe(2);
    expect(errored.join("\n")).toContain("<application-directory>");
  });
});

describe("package render", () => {
  test("검토 화면 HTML 을 만들고 그 경로를 출력한다", async () => {
    const directory = applicationDirectory();

    expect(await runPackageCommand(["render", directory], {})).toBe(0);
    const destination = join(directory, "application-package.html");
    expect(logged).toEqual([destination]);
    const html = readFileSync(destination, "utf8");
    expect(html).toContain("예시 결론 문장");
    expect(html).toContain("여러 팀이 함께 쓰는 예시 플랫폼의 공통 계약");
  });

  test("출력 경로를 주면 그 자리에 만든다", async () => {
    const directory = applicationDirectory();
    const destination = join(temporaryDirectory(), "nested", "review.html");

    expect(await runPackageCommand(["render", directory, destination], {})).toBe(0);
    expect(existsSync(destination)).toBe(true);
  });

  test("제출 문서에 내부 경로가 있으면 화면을 만들지 않고 1 로 끝난다", async () => {
    const directory = applicationDirectory();
    write(directory, "evidence/resume-draft.md", "## 경력\n\nsources/fos-study/task/example.md\n");

    expect(await runPackageCommand(["render", directory], {})).toBe(1);
    expect(existsSync(join(directory, "application-package.html"))).toBe(false);
    expect(errored.join("\n")).toContain("내부 정보");
  });

  test("면접 질문 파일이 없으면 1 로 끝난다", async () => {
    const directory = applicationDirectory();
    rmSync(join(directory, "evidence", "interview-questions.json"));

    expect(await runPackageCommand(["render", directory], {})).toBe(1);
    expect(errored.join("\n")).toContain("interview-questions.json");
  });
});

describe("package question-schema", () => {
  test("올바른 질문 파일은 요약 JSON 을 내고 0 으로 끝난다", async () => {
    const directory = applicationDirectory();

    expect(await runPackageCommand(["question-schema", directory], {})).toBe(0);
    expect(JSON.parse(logged.join("\n"))).toEqual({
      status: "ok",
      company: "예시 회사",
      role: "Backend Developer",
      questions: 1,
    });
  });

  test("형식이 틀린 질문 파일은 1 로 끝난다", async () => {
    const directory = applicationDirectory();
    write(directory, "evidence/interview-questions.json", JSON.stringify({ schemaVersion: 1, questions: [] }));

    expect(await runPackageCommand(["question-schema", directory], {})).toBe(1);
    expect(errored.join("\n")).toContain("형식이 올바르지 않다");
  });

  test("인자가 없으면 2 로 끝난다", async () => {
    expect(await runPackageCommand(["question-schema"], {})).toBe(2);
  });
});

describe("package check-sources", () => {
  test("CAREER_EVIDENCE_DIR 가 없으면 unavailable 로 1 을 낸다", async () => {
    expect(await runPackageCommand(["check-sources", "--no-fetch"], {})).toBe(1);
    const result = JSON.parse(logged.join("\n"));
    expect(result.passed).toBe(false);
    expect(result.sources[0].status).toBe("unavailable");
    expect(result.sources[0].detail).toContain("CAREER_EVIDENCE_DIR");
  });

  test("모르는 옵션은 2 로 끝난다", async () => {
    expect(await runPackageCommand(["check-sources", "--fetch-all"], {})).toBe(2);
    expect(logged).toEqual([]);
  });

  // `--no-fetch` 를 읽는 자리가 바뀌면 뜻이 조용히 뒤집힌다. 같은 저장소에서 두 경로를 대조한다.
  test("--no-fetch 는 원격을 받지 않고, 빼면 원격을 받는다", async () => {
    const workspace = temporaryDirectory();
    const origin = join(workspace, "origin");
    mkdirSync(origin);
    const git = (directory: string, args: string[]) => {
      const result = Bun.spawnSync(["git", "-c", "commit.gpgsign=false", "-C", directory, ...args], {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
      });
      if (result.exitCode !== 0) throw new Error(result.stderr.toString());
      return result.stdout.toString().trim();
    };
    const commit = (name: string) => {
      writeFileSync(join(origin, name), name);
      git(origin, ["add", name]);
      git(origin, ["commit", "-m", name]);
    };
    git(origin, ["init", "--quiet", "--initial-branch", "main"]);
    commit("first.md");
    const clone = join(workspace, "clone");
    git(workspace, ["clone", "--quiet", origin, clone]);
    mkdirSync(join(clone, "task"));
    commit("second.md");
    const environment = { CAREER_EVIDENCE_DIR: join(clone, "task") };

    expect(await runPackageCommand(["check-sources", "--no-fetch"], environment)).toBe(0);
    expect(JSON.parse(logged.join("\n")).sources[0].status).toBe("up_to_date");

    logged.length = 0;
    expect(await runPackageCommand(["check-sources"], environment)).toBe(1);
    expect(JSON.parse(logged.join("\n")).sources[0]).toMatchObject({ status: "behind", behindCommits: 1 });
  }, SUBPROCESS_TEST_TIMEOUT_MS);
});

describe("package 사용법", () => {
  test("모르는 하위 명령은 사용법을 stderr 에 쓰고 2 로 끝난다", async () => {
    expect(await runPackageCommand(["nope"], {})).toBe(2);
    const output = errored.join("\n");
    expect(output).toContain("모르는 하위 명령입니다: nope");
    for (const command of ["check-sources", "validate", "render", "question-schema"]) expect(output).toContain(command);
  });

  test("하위 명령이 없으면 2 로 끝난다", async () => {
    expect(await runPackageCommand([], {})).toBe(2);
    expect(errored.join("\n")).toContain("사용법: package");
  });
});
