import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const result = Bun.spawnSync(["git", "-C", directory, ...args], {
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
  Bun.spawnSync(["git", "clone", "--quiet", origin, clone], { stdout: "pipe", stderr: "pipe" });
  return { origin, clone };
}

function specFor(path: string): EvidenceSourceSpec {
  return { name: "테스트 원본", path, branch: "main", affects: "테스트 판정" };
}

describe("근거 원본 목록의 문서 계약", () => {
  test("원본 셋 중 스크립트가 검사하는 둘만 목록에 있다", () => {
    expect(EVIDENCE_SOURCES.map((source) => source.name)).toEqual(["fos-study", "private brain"]);
  });

  test("각 원본의 경로가 reference 의 대상 표에 있다", () => {
    for (const source of EVIDENCE_SOURCES) {
      expect(reference).toContain(source.path);
    }
  });

  // 홈서버 작업본은 `skill begin` 이 이미 받아 온다. 이 스크립트가 다시 검사하면 책임이 겹친다.
  test("홈서버 작업본은 이 스크립트의 대상이 아니다", () => {
    const paths = EVIDENCE_SOURCES.map((source) => source.path);
    expect(paths).not.toContain("career-os/applications");
    expect(paths).not.toContain("career-os/state");
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

  test("Git 저장소가 아니면 통과시키지 않는다", () => {
    const workspace = createWorkspace();
    const plain = join(workspace, "plain");
    mkdirSync(plain);

    const result = checkEvidenceSources({ sources: [specFor(plain)] });

    expect(result.sources[0].status).toBe("unavailable");
  });

  test("환경 변수 경로는 값이 없으면 경로를 추측하지 않는다", () => {
    const result = checkEvidenceSources({ sources: [specFor("${PERSONAL_ROOT}/fos-brain")], env: {} });

    expect(result.sources[0].status).toBe("unavailable");
    expect(result.sources[0].detail).toContain("PERSONAL_ROOT");
    expect(result.sources[0].path).toBe("${PERSONAL_ROOT}/fos-brain");
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

  // 스킬마다 명령을 실행하는 디렉터리 관례가 달라도 같은 결과가 나와야 한다.
  test("저장소 루트를 주지 않으면 현재 위치에서 찾는다", () => {
    const script = join(import.meta.dir, "check_evidence_sources.ts");
    const run = (cwd: string) =>
      JSON.parse(new TextDecoder().decode(Bun.spawnSync(["bun", script, "--no-fetch"], { cwd, stdout: "pipe", stderr: "pipe" }).stdout));

    const fromRoot = run(join(import.meta.dir, "../../../../.."));
    const fromCareerOs = run(join(import.meta.dir, "../../../.."));

    expect(fromCareerOs.sources.map((source: { path: string }) => source.path)).toEqual(
      fromRoot.sources.map((source: { path: string }) => source.path),
    );
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
