import { execFileSync } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

/**
 * 개인 맥락이 저장소에 남지 않도록 쓰려는 경로가 어떤 git 저장소 안이든 거절한다.
 * cwd 와 무관하게 대상 경로 기준으로 판정하고, 확인한 실제 경로를 돌려준다.
 * `label` 은 오류 문구에서 어느 경로인지 알리는 이름이다.
 */
export function assertOutsideRepository(path: string, label = "--out"): string {
  const rejection = new Error(`${label} 은 저장소 밖 경로여야 한다. 개인 맥락을 저장소에 두지 않는다.`);
  const target = resolve(path);
  const parent = realpathSync(dirname(target));
  // 이미 있는 symlink 는 저장소 안을 가리킬 수 있어 부모 검사만으로는 알 수 없다.
  const stat = lstatSync(target, { throwIfNoEntry: false });
  if (stat?.isSymbolicLink()) throw rejection;
  try {
    // `--git-dir` 은 작업 트리 안과 `.git` 디렉터리 안에서 모두 성공한다.
    execFileSync("git", ["-C", parent, "rev-parse", "--git-dir"], { encoding: "utf8", stdio: "pipe", env: { ...process.env, LC_ALL: "C" } });
  } catch (error) {
    // 저장소가 아니라서 실패한 경우만 허용한다. 메시지로 판정하므로 위에서 locale 을 C 로 고정했다.
    // git 이 없거나 다른 이유로 실패하면 판정할 수 없어 거절한다.
    if (isNotGitRepositoryError(error)) return join(parent, basename(target));
    throw new Error(`${label} 이 저장소 밖인지 git 으로 확인하지 못했다.`, { cause: error });
  }
  throw rejection;
}

function isNotGitRepositoryError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, stderr } = error as { status?: unknown; stderr?: unknown };
  return status === 128 && String(stderr ?? "").includes("not a git repository");
}
