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

function realPathOrUsageError(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    throw new StudyRunPathError("CAREER_OS_ROOT는 이미 생성된 시스템 임시 실행 경로여야 한다.");
  }
}

export function resolveStudyRunRoot(environment: NodeJS.ProcessEnv = process.env): string {
  const configuredRoot = environment.CAREER_OS_ROOT;
  if (!configuredRoot) {
    throw new StudyRunPathError("CAREER_OS_ROOT에 시스템 임시 실행 경로를 지정해야 한다.");
  }

  const systemTempRoot = realPathOrUsageError(tmpdir());
  const runRoot = realPathOrUsageError(resolve(configuredRoot));
  const relativePath = relative(systemTempRoot, runRoot);
  const isInsideSystemTemp = relativePath !== ""
    && !relativePath.startsWith("..")
    && !isAbsolute(relativePath);

  if (!isInsideSystemTemp || !basename(runRoot).startsWith(RUN_DIRECTORY_PREFIX)) {
    throw new StudyRunPathError(
      "CAREER_OS_ROOT는 시스템 임시 디렉터리 아래의 study-topic-recommender.* 경로여야 한다."
    );
  }

  return runRoot;
}
