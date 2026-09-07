import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, relative, resolve } from "node:path";

const RUN_DIRECTORY_PREFIX = "study-topic-recommender.";

export class StudyRunPathError extends Error {
  readonly exitCode = 2;

  constructor(message: string) {
    super(message);
    this.name = "StudyRunPathError";
  }
}

function realPathOrUsageError(path: string, label: string): string {
  try {
    return realpathSync(path);
  } catch {
    throw new StudyRunPathError(`${label}는 이미 생성된 시스템 임시 실행 경로여야 한다.`);
  }
}

function validateRunRoot(path: string, label: string): string {
  const systemTempRoot = realPathOrUsageError(tmpdir(), label);
  const runRoot = realPathOrUsageError(resolve(path), label);
  const relativePath = relative(systemTempRoot, runRoot);
  const isInsideSystemTemp = relativePath !== ""
    && !relativePath.startsWith("..")
    && !isAbsolute(relativePath);

  if (!isInsideSystemTemp || !basename(runRoot).startsWith(RUN_DIRECTORY_PREFIX)) {
    throw new StudyRunPathError(
      `${label}는 시스템 임시 디렉터리 아래의 study-topic-recommender.* 경로여야 한다.`
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
    throw new StudyRunPathError("CAREER_OS_ROOT 또는 --run-dir에 시스템 임시 실행 경로를 지정해야 한다.");
  }

  const envRoot = configuredRoot ? validateRunRoot(configuredRoot, "CAREER_OS_ROOT") : undefined;
  const cliRoot = runDir ? validateRunRoot(runDir, "--run-dir") : undefined;
  if (envRoot && cliRoot && envRoot !== cliRoot) {
    throw new StudyRunPathError("CAREER_OS_ROOT와 --run-dir는 같은 실행 경로를 가리켜야 한다.");
  }
  return cliRoot ?? envRoot!;
}
