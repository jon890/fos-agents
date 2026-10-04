import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkEvidenceSources, EVIDENCE_SOURCES, type EvidenceSourceSpec } from "./check_evidence_sources.ts";
import { SUBPROCESS_TEST_TIMEOUT_MS } from "../lib/test-timeouts.ts";

const workspaces: string[] = [];

afterAll(() => {
  for (const workspace of workspaces) rmSync(workspace, { recursive: true, force: true });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "evidence-sources-"));
  workspaces.push(workspace);
  return workspace;
}

function git(directory: string, args: readonly string[]): void {
  // 실행하는 사람의 전역 git 설정에 결과가 달라지지 않게 서명과 신원을 고정한다.
  const result = Bun.spawnSync(["git", "-c", "commit.gpgsign=false", "-C", directory, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
}

function commit(repository: string, name: string): void {
  writeFileSync(join(repository, name), name);
  git(repository, ["add", name]);
  git(repository, ["commit", "-m", name]);
}

/** origin 역할을 할 저장소와 그것을 clone 한 로컬 사본을 만든다. */
function createOriginAndClone(): { origin: string; clone: string } {
  const workspace = createWorkspace();
  const origin = join(workspace, "origin");
  mkdirSync(origin);
  git(origin, ["init", "--quiet", "--initial-branch", "main"]);
  commit(origin, "first.md");

  const clone = join(workspace, "clone");
  const cloned = Bun.spawnSync(["git", "clone", "--quiet", origin, clone], { stdout: "pipe", stderr: "pipe" });
  if (cloned.exitCode !== 0) throw new Error(new TextDecoder().decode(cloned.stderr));
  return { origin, clone };
}

function specFor(...paths: string[]): EvidenceSourceSpec {
  return { name: "테스트 원본", paths, branch: "main", affects: "테스트 판정" };
}

describe("근거 원본 목록의 문서 계약", () => {
  test("원본 셋 중 로컬 사본을 두는 하나만 목록에 있다", () => {
    expect(EVIDENCE_SOURCES.map((source) => source.name)).toEqual(["fos-study"]);
  });

  // 원본 위치는 사용자가 지정한 CAREER_EVIDENCE_DIR 로만 정한다. 저장소 루트 기준 경로나 .env 의 값을 짐작하지 않는다.
  test("원본 자리는 CAREER_EVIDENCE_DIR 와 그 상위 둘뿐이다", () => {
    expect(EVIDENCE_SOURCES[0].paths).toEqual(["${CAREER_EVIDENCE_DIR}", "${CAREER_EVIDENCE_DIR}/.."]);
  });

  // 홈서버 작업본은 `skill begin` 이 이미 받아 온다. 이 스크립트가 다시 검사하면 책임이 겹친다.
  test("홈서버 작업본은 이 스크립트의 대상이 아니다", () => {
    const paths = EVIDENCE_SOURCES.flatMap((source) => source.paths);
    expect(paths).not.toContain("career-os/applications");
    expect(paths).not.toContain("career-os/state");
  });

  /**
   * ADR-136 이 공통 프로필을 fos-assistant Memory 에서 CLI 로 읽는다고 정한다. 경로를 요구하면 조회 방식과 검사기가 묶인다.
   */
  test("지원서 공통 프로필의 경로를 요구하지 않는다", () => {
    const paths = EVIDENCE_SOURCES.flatMap((source) => source.paths);

    expect(paths.some((path) => path.includes("brain"))).toBe(false);
  });
});

describe("CLI 계약", () => {
  const script = join(import.meta.dir, "check_evidence_sources.ts");
  /** 실행하는 사람의 셸에 있는 CAREER_EVIDENCE_DIR 가 결과를 바꾸지 않게 그 값을 뺀 환경을 넘긴다. */
  const isolatedEnvironment = (): Record<string, string | undefined> => {
    const { CAREER_EVIDENCE_DIR: _ignored, ...rest } = process.env;
    return rest;
  };
  const invoke = (args: string[], cwd = import.meta.dir) => {
    const result = Bun.spawnSync([process.execPath, script, ...args], {
      cwd,
      env: isolatedEnvironment(),
      stdout: "pipe",
      stderr: "pipe",
    });
    return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
  };

  test("--help 는 0 으로 끝낸다", () => {
    const result = invoke(["--help"]);

    expect(result.code).toBe(0);
    expect(result.out).toContain("--no-fetch");
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("모르는 옵션은 사용법 오류 2 로 끝낸다", () => {
    expect(invoke(["--모르는옵션"]).code).toBe(2);
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("CAREER_EVIDENCE_DIR 가 없으면 unavailable 과 지정 안내를 내고 1 로 끝낸다", () => {
    const result = invoke(["--no-fetch"]);

    expect(result.code).toBe(1);
    const parsed = JSON.parse(result.out);
    expect(parsed.passed).toBe(false);
    expect(parsed.sources[0].status).toBe("unavailable");
    expect(parsed.sources[0].detail).toContain("CAREER_EVIDENCE_DIR 환경 변수가 없어");
    expect(parsed.sources[0].detail).toContain("`CAREER_EVIDENCE_DIR` 를 fos-study Git 저장소의 루트나 그 바로 아래 디렉터리로 지정한다");
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  // 실행한 자리가 Git 저장소의 루트여도 그 저장소를 원본으로 삼지 않는다. 위치는 환경 변수로만 받는다.
  test("실행한 자리가 Git 저장소여도 그 저장소를 원본으로 보지 않는다", () => {
    const repository = join(createWorkspace(), "repository");
    mkdirSync(repository);
    git(repository, ["init", "--quiet", "--initial-branch", "main"]);
    commit(repository, "first.md");

    const result = invoke(["--no-fetch"], repository);

    expect(result.code).toBe(1);
    expect(JSON.parse(result.out).sources[0].status).toBe("unavailable");
  }, SUBPROCESS_TEST_TIMEOUT_MS);
});

describe("최신 여부 판정", () => {
  test("원격과 같은 커밋이면 통과한다", () => {
    const { clone } = createOriginAndClone();

    const result = checkEvidenceSources({ sources: [specFor(clone)] });

    expect(result.passed).toBe(true);
    expect(result.sources[0].status).toBe("up_to_date");
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("원격에만 커밋이 있으면 뒤처진 커밋 수와 원격 시각을 돌려준다", () => {
    const { origin, clone } = createOriginAndClone();
    commit(origin, "second.md");
    commit(origin, "third.md");

    const result = checkEvidenceSources({ sources: [specFor(clone)] });

    expect(result.passed).toBe(false);
    expect(result.sources[0].status).toBe("behind");
    expect(result.sources[0].behindCommits).toBe(2);
    expect(result.sources[0].remoteCommittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  // 검사만 하고 당기지 않는다. 읽기 전용 저장소이며 당기는 과정에 사람이 판단할 것이 있다.
  test("뒤처진 것을 발견해도 로컬 HEAD 를 옮기지 않는다", () => {
    const { origin, clone } = createOriginAndClone();
    const before = Bun.spawnSync(["git", "-C", clone, "rev-parse", "HEAD"], { stdout: "pipe" }).stdout.toString();
    commit(origin, "second.md");

    checkEvidenceSources({ sources: [specFor(clone)] });

    const after = Bun.spawnSync(["git", "-C", clone, "rev-parse", "HEAD"], { stdout: "pipe" }).stdout.toString();
    expect(after).toBe(before);
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("--no-fetch 는 원격을 받지 않아 직전 remote-tracking ref 로 판정한다", () => {
    const { origin, clone } = createOriginAndClone();
    commit(origin, "second.md");

    const result = checkEvidenceSources({ sources: [specFor(clone)], fetch: false });

    expect(result.sources[0].status).toBe("up_to_date");
  }, SUBPROCESS_TEST_TIMEOUT_MS);
});

describe("확인할 수 없는 원본", () => {
  test("경로가 없으면 통과시키지 않는다", () => {
    const result = checkEvidenceSources({ sources: [specFor(join(createWorkspace(), "missing"))] });

    expect(result.passed).toBe(false);
    expect(result.sources[0].status).toBe("unavailable");
    expect(result.sources[0].detail).toContain("경로가 없습니다");
  });

  test("어느 저장소에도 속하지 않은 디렉터리는 통과시키지 않는다", () => {
    const plain = join(createWorkspace(), "plain");
    mkdirSync(plain);

    const result = checkEvidenceSources({ sources: [specFor(plain)] });

    expect(result.sources[0].status).toBe("unavailable");
  });

  /**
   * 가장 위험한 경우다. 상위 저장소 안의 평범한 디렉터리는 `rev-parse --git-dir` 를 통과한다.
   * 그대로 두면 fos-study 가 아니라 감싸고 있는 저장소를 재고 경고 없이 `up_to_date` 가 나온다.
   */
  test("상위 저장소 안의 평범한 디렉터리를 그 저장소로 착각하지 않는다", () => {
    const { clone } = createOriginAndClone();
    const inside = join(clone, "sources", "fos-study");
    mkdirSync(inside, { recursive: true });

    const result = checkEvidenceSources({ sources: [specFor(inside)] });

    expect(result.sources[0].status).toBe("unavailable");
    expect(result.sources[0].detail).toContain("루트가 아닙니다");
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("앞의 자리에 저장소가 없으면 다음 자리를 본다", () => {
    const { clone } = createOriginAndClone();

    const result = checkEvidenceSources({ sources: [specFor(join(createWorkspace(), "missing"), clone)] });

    expect(result.sources[0].status).toBe("up_to_date");
    expect(result.sources[0].path).toBe(clone);
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("원격을 받지 못하면 unreachable 로 구분한다", () => {
    const { clone } = createOriginAndClone();
    git(clone, ["remote", "set-url", "origin", join(createWorkspace(), "gone")]);

    const result = checkEvidenceSources({ sources: [specFor(clone)] });

    expect(result.passed).toBe(false);
    expect(result.sources[0].status).toBe("unreachable");
    // git stderr 는 여러 줄이다. 사용자에게 한 줄만 보인다.
    expect(result.sources[0].detail).not.toContain("\n");
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("모든 원본이 최신이면 통과한다", () => {
    const first = createOriginAndClone();
    const second = createOriginAndClone();

    const result = checkEvidenceSources({ sources: [specFor(first.clone), specFor(second.clone)] });

    expect(result.passed).toBe(true);
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  // 사용자가 할 일이 다르므로 자리마다의 이유를 남긴다. 값을 설정하는 일과 저장소를 가져오는 일이다.
  test("자리마다 왜 아니었는지를 detail 에 남긴다", () => {
    const missing = join(createWorkspace(), "missing");

    const result = checkEvidenceSources({ sources: [specFor(missing, "${CAREER_EVIDENCE_DIR}/..")], env: {} });

    expect(result.passed).toBe(false);
    expect(result.sources[0].status).toBe("unavailable");
    expect(result.sources[0].detail).toContain("경로가 없습니다");
    expect(result.sources[0].detail).toContain("CAREER_EVIDENCE_DIR 환경 변수가 없어");
  });

  test("상대 경로 원본은 위치를 짐작하지 않고 unavailable 로 둔다", () => {
    const result = checkEvidenceSources({ sources: [specFor("clone")], env: {} });

    expect(result.sources[0].status).toBe("unavailable");
    expect(result.sources[0].detail).toContain("위치를 정할 수 없습니다");
  });
});

describe("CAREER_EVIDENCE_DIR 로 찾는 fos-study", () => {
  test("환경 변수가 없으면 unavailable 이고 CAREER_EVIDENCE_DIR 를 지정하라고 안내한다", () => {
    const result = checkEvidenceSources({ env: {}, fetch: false });

    expect(result.passed).toBe(false);
    expect(result.sources[0].name).toBe("fos-study");
    expect(result.sources[0].status).toBe("unavailable");
    expect(result.sources[0].detail).toContain("CAREER_EVIDENCE_DIR 환경 변수가 없어");
    expect(result.sources[0].detail).toContain("셸 환경 변수 `CAREER_EVIDENCE_DIR` 를");
    expect(result.sources[0].detail).not.toContain("PERSONAL_ROOT");
    expect(result.sources[0].detail).not.toContain("ln -s");
  });

  test("공백뿐인 값은 환경 변수가 없는 것으로 본다", () => {
    const result = checkEvidenceSources({ env: { CAREER_EVIDENCE_DIR: "   " }, fetch: false });

    expect(result.sources[0].status).toBe("unavailable");
    expect(result.sources[0].detail).toContain("CAREER_EVIDENCE_DIR 환경 변수가 없어");
  });

  test("증거 디렉터리가 저장소 루트면 그 자리로 판정한다", () => {
    const { clone } = createOriginAndClone();

    const result = checkEvidenceSources({ env: { CAREER_EVIDENCE_DIR: clone } });

    expect(result.sources[0].status).toBe("up_to_date");
    expect(result.sources[0].path).toBe("${CAREER_EVIDENCE_DIR}");
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("증거 디렉터리의 상위가 저장소 루트면 up_to_date 다", () => {
    const { clone } = createOriginAndClone();
    const task = join(clone, "task");
    mkdirSync(task);

    const result = checkEvidenceSources({ env: { CAREER_EVIDENCE_DIR: task } });

    expect(result.passed).toBe(true);
    expect(result.sources[0].status).toBe("up_to_date");
    expect(result.sources[0].path).toBe("${CAREER_EVIDENCE_DIR}/..");
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("원격이 앞서 있으면 behind 다", () => {
    const { origin, clone } = createOriginAndClone();
    const task = join(clone, "task");
    mkdirSync(task);
    commit(origin, "second.md");

    const result = checkEvidenceSources({ env: { CAREER_EVIDENCE_DIR: task } });

    expect(result.passed).toBe(false);
    expect(result.sources[0].status).toBe("behind");
    expect(result.sources[0].behindCommits).toBe(1);
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  /**
   * 상위 모노레포의 `.git` 만 물려받은 평범한 디렉터리다. 그 자리도 상위도 저장소 루트가 아니다.
   * 그대로 두면 감싸고 있는 저장소를 원본으로 재고 경고 없이 `up_to_date` 가 나온다.
   */
  test("상위 모노레포 안의 평범한 디렉터리를 원본으로 오인하지 않는다", () => {
    const { clone } = createOriginAndClone();
    const evidence = join(clone, "career-os", "sources", "task");
    mkdirSync(evidence, { recursive: true });

    const result = checkEvidenceSources({ env: { CAREER_EVIDENCE_DIR: evidence } });

    expect(result.sources[0].status).toBe("unavailable");
    expect(result.sources[0].detail).toContain("루트가 아닙니다");
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("원격을 받지 않으면 직전 remote-tracking ref 로 판정한다", () => {
    const { origin, clone } = createOriginAndClone();
    commit(origin, "second.md");

    const result = checkEvidenceSources({ env: { CAREER_EVIDENCE_DIR: clone }, fetch: false });

    expect(result.sources[0].status).toBe("up_to_date");
  }, SUBPROCESS_TEST_TIMEOUT_MS);
});

describe("여러 원본", () => {
  test("한 원본이라도 최신이 아니면 전체가 통과하지 않는다", () => {
    const { clone } = createOriginAndClone();

    const result = checkEvidenceSources({
      sources: [specFor(clone), specFor(join(createWorkspace(), "missing"))],
    });

    expect(result.passed).toBe(false);
    expect(result.sources.map((source) => source.status)).toEqual(["up_to_date", "unavailable"]);
  }, SUBPROCESS_TEST_TIMEOUT_MS);
});
