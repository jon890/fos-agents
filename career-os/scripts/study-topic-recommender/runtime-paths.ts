import { lstatSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { resolveCareerStoreRoot } from "../lib/career-store/database.ts";

const RUN_DIRECTORY_PREFIX = "study-topic-recommender.";

export class StudyRunPathError extends Error {
  readonly exitCode = 2;

  constructor(message: string) {
    super(message);
    this.name = "StudyRunPathError";
  }
}

/**
 * 실행 폴더를 둘 수 있는 부모다. 작업 폴더 `runs/` 가 기본이고(실행 공간의 임시 폴더는 작다),
 * 시스템 임시 폴더는 옛 실행과 테스트를 위해 계속 받는다. 아직 없는 폴더는 뺀다.
 */
function runParents(environment: NodeJS.ProcessEnv = process.env): string[] {
  return [tmpdir(), resolve(resolveCareerStoreRoot(environment), "runs")].flatMap((parent) => {
    try {
      return [realpathSync(parent)];
    } catch {
      return [];
    }
  });
}

export function validateStudyCleanupDirectory(directory: string, environment: NodeJS.ProcessEnv = process.env): string {
  const message = `정리 경로는 작업 폴더 runs/ 나 시스템 임시 디렉터리의 직접 자식인 ${RUN_DIRECTORY_PREFIX}* 디렉터리여야 하며 symlink는 허용하지 않습니다.`;
  try {
    if (!directory.trim()) throw new StudyRunPathError(message);
    const path = resolve(directory);
    const stat = lstatSync(path);
    const realPath = realpathSync(path);
    if (stat.isSymbolicLink() || !stat.isDirectory()
      || !runParents(environment).includes(dirname(realPath))
      || !basename(realPath).startsWith(RUN_DIRECTORY_PREFIX)) {
      throw new StudyRunPathError(message);
    }
    return realPath;
  } catch {
    throw new StudyRunPathError(message);
  }
}

function realPathOrUsageError(path: string, label: string): string {
  try {
    return realpathSync(path);
  } catch {
    throw new StudyRunPathError(`${label}는 이미 생성된 실행 경로여야 한다.`);
  }
}

function validateRunRoot(path: string, label: string, environment: NodeJS.ProcessEnv): string {
  const runRoot = realPathOrUsageError(resolve(path), label);
  const isInsideParent = runParents(environment).some((parent) => {
    const relativePath = relative(parent, runRoot);
    return relativePath !== "" && !relativePath.startsWith("..") && !isAbsolute(relativePath);
  });

  if (!isInsideParent || !basename(runRoot).startsWith(RUN_DIRECTORY_PREFIX)) {
    throw new StudyRunPathError(
      `${label}는 작업 폴더 runs/ 나 시스템 임시 디렉터리 아래의 study-topic-recommender.* 경로여야 한다.`
    );
  }

  return runRoot;
}

export function resolveStudyRunRoot(
  environment: NodeJS.ProcessEnv = process.env,
  runDir?: string
): string {
  const configuredRoot = environment.CAREER_OS_ROOT;
  if (!configuredRoot && !runDir) {
    throw new StudyRunPathError("CAREER_OS_ROOT 또는 --run-dir에 실행 경로를 지정해야 한다.");
  }

  const envRoot = configuredRoot ? validateRunRoot(configuredRoot, "CAREER_OS_ROOT", environment) : undefined;
  const cliRoot = runDir ? validateRunRoot(runDir, "--run-dir", environment) : undefined;
  if (envRoot && cliRoot && envRoot !== cliRoot) {
    throw new StudyRunPathError("CAREER_OS_ROOT와 --run-dir는 같은 실행 경로를 가리켜야 한다.");
  }
  return cliRoot ?? envRoot!;
}
