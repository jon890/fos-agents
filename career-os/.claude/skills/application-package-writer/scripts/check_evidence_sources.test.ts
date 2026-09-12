import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkEvidenceSources, EVIDENCE_SOURCES, type EvidenceSourceSpec } from "./check_evidence_sources.ts";

const reference = readFileSync(new URL("../references/evidence-source-freshness.md", import.meta.url), "utf8");

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
  test("원본 셋 중 스크립트가 검사하는 둘만 목록에 있다", () => {
    expect(EVIDENCE_SOURCES.map((source) => source.name)).toEqual(["fos-study", "private brain"]);
  });

  test("각 원본의 경로가 reference 의 대상 표에 있다", () => {
    for (const path of EVIDENCE_SOURCES.flatMap((source) => source.paths)) {
      expect(reference).toContain(path);
    }
  });

  // 홈서버 작업본은 `skill begin` 이 이미 받아 온다. 이 스크립트가 다시 검사하면 책임이 겹친다.
  test("홈서버 작업본은 이 스크립트의 대상이 아니다", () => {
    const paths = EVIDENCE_SOURCES.flatMap((source) => source.paths);
    expect(paths).not.toContain("career-os/applications");
    expect(paths).not.toContain("career-os/state");
  });
});

describe("CLI 계약", () => {
  const script = join(import.meta.dir, "check_evidence_sources.ts");
  const invoke = (args: string[], cwd = import.meta.dir) => {
    const result = Bun.spawnSync(["bun", script, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
    return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
  };

  test("--help 는 0 으로 끝낸다", () => {
    const result = invoke(["--help"]);

    expect(result.code).toBe(0);
    expect(result.out).toContain("--no-fetch");
  });

  test("모르는 옵션은 사용법 오류 2 로 끝낸다", () => {
    expect(invoke(["--모르는옵션"]).code).toBe(2);
  });

  test("검사에 실패하면 1 로 끝낸다", () => {
    const empty = createWorkspace();
    git(empty, ["init", "--quiet", "--initial-branch", "main"]);
    commit(empty, "first.md");

    const result = invoke(["--no-fetch"], empty);

    expect(result.code).toBe(1);
    expect(JSON.parse(result.out).passed).toBe(false);
  });

  // `fetch: options["--no-fetch"] !== true` 는 옵션 이름이 바뀌면 뜻이 조용히 뒤집히는 자리다.
  test("--no-fetch 가 원격을 받지 않는 경로로 이어진다", () => {
    // 계약에 적힌 첫 자리인 `career-os/sources/fos-study` 에 실제 clone 을 둔다.
    const { origin, clone } = createOriginAndClone();
    const root = join(createWorkspace(), "root");
    mkdirSync(join(root, "career-os", "sources"), { recursive: true });
    renameSync(clone, join(root, "career-os", "sources", "fos-study"));
    const source = join(root, "career-os", "sources", "fos-study");
    commit(origin, "second.md");

    const remoteRef = () =>
      Bun.spawnSync(["git", "-C", source, "rev-parse", "origin/main"], { stdout: "pipe" }).stdout.toString();

    const before = remoteRef();
    invoke(["--no-fetch", root]);
    expect(remoteRef()).toBe(before);

    // 플래그를 빼면 같은 저장소에서 원격 ref 가 움직인다. 위 단언이 기본값 때문에 통과한 것이 아니다.
    invoke([root]);
    expect(remoteRef()).not.toBe(before);
  });
});

describe("최신 여부 판정", () => {
  test("원격과 같은 커밋이면 통과한다", () => {
    const { clone } = createOriginAndClone();

    const result = checkEvidenceSources({ sources: [specFor(clone)] });

    expect(result.passed).toBe(true);
    expect(result.sources[0].status).toBe("up_to_date");
  });

  test("원격에만 커밋이 있으면 뒤처진 커밋 수와 원격 시각을 돌려준다", () => {
    const { origin, clone } = createOriginAndClone();
    commit(origin, "second.md");
    commit(origin, "third.md");

    const result = checkEvidenceSources({ sources: [specFor(clone)] });

    expect(result.passed).toBe(false);
    expect(result.sources[0].status).toBe("behind");
    expect(result.sources[0].behindCommits).toBe(2);
    expect(result.sources[0].remoteCommittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // 검사만 하고 당기지 않는다. 읽기 전용 저장소이며 당기는 과정에 사람이 판단할 것이 있다.
  test("뒤처진 것을 발견해도 로컬 HEAD 를 옮기지 않는다", () => {
    const { origin, clone } = createOriginAndClone();
    const before = Bun.spawnSync(["git", "-C", clone, "rev-parse", "HEAD"], { stdout: "pipe" }).stdout.toString();
    commit(origin, "second.md");

    checkEvidenceSources({ sources: [specFor(clone)] });

    const after = Bun.spawnSync(["git", "-C", clone, "rev-parse", "HEAD"], { stdout: "pipe" }).stdout.toString();
    expect(after).toBe(before);
  });

  test("--no-fetch 는 원격을 받지 않아 직전 remote-tracking ref 로 판정한다", () => {
    const { origin, clone } = createOriginAndClone();
    commit(origin, "second.md");

    const result = checkEvidenceSources({ sources: [specFor(clone)], fetch: false });

    expect(result.sources[0].status).toBe("up_to_date");
  });
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
  });

  test("앞의 자리에 저장소가 없으면 다음 자리를 본다", () => {
    const { clone } = createOriginAndClone();

    const result = checkEvidenceSources({ sources: [specFor(join(createWorkspace(), "missing"), clone)] });

    expect(result.sources[0].status).toBe("up_to_date");
    expect(result.sources[0].path).toBe(clone);
  });

  test("원격을 받지 못하면 unreachable 로 가른다", () => {
    const { clone } = createOriginAndClone();
    git(clone, ["remote", "set-url", "origin", join(createWorkspace(), "gone")]);

    const result = checkEvidenceSources({ sources: [specFor(clone)] });

    expect(result.passed).toBe(false);
    expect(result.sources[0].status).toBe("unreachable");
    // git stderr 는 여러 줄이다. 사용자에게 한 줄만 보인다.
    expect(result.sources[0].detail).not.toContain("\n");
  });

  test("모든 원본이 최신이면 통과한다", () => {
    const first = createOriginAndClone();
    const second = createOriginAndClone();

    const result = checkEvidenceSources({ sources: [specFor(first.clone), specFor(second.clone)] });

    expect(result.passed).toBe(true);
  });

  // 값을 설정하는 일과 저장소를 가져오는 일은 사용자가 할 일이 다르므로 판정에서 가른다.
  test("환경 변수가 없어 자리를 못 정하면 not_configured 로 가른다", () => {
    const result = checkEvidenceSources({ sources: [specFor("${PERSONAL_ROOT}/fos-brain")], env: {} });

    expect(result.passed).toBe(false);
    expect(result.sources[0].status).toBe("not_configured");
    expect(result.sources[0].detail).toContain("PERSONAL_ROOT");
    expect(result.sources[0].path).toBe("${PERSONAL_ROOT}/fos-brain");
  });

  test("자리는 정했는데 저장소가 없으면 unavailable 로 가른다", () => {
    const missing = join(createWorkspace(), "missing");

    const result = checkEvidenceSources({ sources: [specFor("${PERSONAL_ROOT}/fos-brain", missing)], env: {} });

    expect(result.sources[0].status).toBe("unavailable");
  });

  test("환경 변수를 `career-os/.env` 에서 읽는다", () => {
    const { clone } = createOriginAndClone();
    const root = join(createWorkspace(), "root");
    mkdirSync(join(root, "career-os"), { recursive: true });
    writeFileSync(join(root, "career-os", ".env"), `PERSONAL_ROOT=${join(clone, "..")}\n`);

    const result = checkEvidenceSources({ repositoryRoot: root, sources: [specFor("${PERSONAL_ROOT}/clone")] });

    expect(result.sources[0].status).toBe("up_to_date");
  });

  test("환경 변수 값이 있으면 그 아래 경로를 검사한다", () => {
    const { clone } = createOriginAndClone();
    const parent = join(clone, "..");

    const result = checkEvidenceSources({
      sources: [specFor("${PERSONAL_ROOT}/clone")],
      env: { PERSONAL_ROOT: parent },
    });

    expect(result.sources[0].status).toBe("up_to_date");
  });

  test("상대 경로 원본은 저장소 루트에서 푼다", () => {
    const { clone } = createOriginAndClone();

    const result = checkEvidenceSources({ repositoryRoot: join(clone, ".."), sources: [specFor("clone")] });

    expect(result.sources[0].status).toBe("up_to_date");
  });

  // 스킬마다 명령을 실행하는 디렉터리 관례가 달라 저장소 루트와 `career-os` 양쪽에서 실행된다.
  test("저장소 루트를 주지 않으면 현재 위치에서 찾아 어느 디렉터리에서 실행해도 같은 경로를 본다", () => {
    const repository = join(createWorkspace(), "repository");
    const nested = join(repository, "career-os", "scripts");
    mkdirSync(nested, { recursive: true });
    git(repository, ["init", "--quiet", "--initial-branch", "main"]);
    commit(repository, "first.md");

    const script = join(import.meta.dir, "check_evidence_sources.ts");
    const resultFrom = (cwd: string): unknown => {
      const output = Bun.spawnSync(["bun", script, "--no-fetch"], { cwd, stdout: "pipe", stderr: "pipe" });
      return JSON.parse(new TextDecoder().decode(output.stdout));
    };

    expect(resultFrom(nested)).toEqual(resultFrom(repository));
  });

  test("한 원본이라도 최신이 아니면 전체가 통과하지 않는다", () => {
    const { clone } = createOriginAndClone();

    const result = checkEvidenceSources({
      sources: [specFor(clone), specFor(join(createWorkspace(), "missing"))],
    });

    expect(result.passed).toBe(false);
    expect(result.sources.map((source) => source.status)).toEqual(["up_to_date", "unavailable"]);
  });
});
