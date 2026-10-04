/**
 * plugin 로컬 실행기의 `package` 하위 명령이다.
 * 근거 원본 최신화 검사, 제출 문서 유출 검사, 검토 화면 렌더, 포지션별 면접 질문 파일 검증을 한 진입점으로 묶는다.
 *
 * 프로세스를 끝내지 않고 종료 코드를 돌려준다. 0 은 통과, 1 은 검사나 실행 실패, 2 는 사용법 오류다.
 */

import { runApplicationQuestionSchemaCli } from "../interview-drill/application_question_schema.ts";
import { checkEvidenceSources } from "./check_evidence_sources.ts";
import { renderApplicationPackage } from "./render_application_package.ts";
import { validateApplicationPackage } from "./validate_application_package.ts";

const PACKAGE_USAGE = [
  "사용법: package <check-sources | validate | render | question-schema> [인자...]",
  "  check-sources [--no-fetch]                         근거 원본이 원격보다 뒤처졌는지 검사한다. 원본 위치는 CAREER_EVIDENCE_DIR 로 받는다",
  "  validate <application-directory>                   제출 문서에 내부 정보가 남았는지 검사한다",
  "  render <application-directory> [output-path]       검토 화면 HTML 을 만든다",
  "  question-schema <application-directory>            포지션별 면접 질문 파일을 검증한다",
].join("\n");

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function usageError(message?: string): number {
  if (message) console.error(message);
  console.error(PACKAGE_USAGE);
  return 2;
}

export async function runPackageCommand(
  args: string[],
  environment: Record<string, string | undefined> = process.env,
): Promise<number> {
  const [command, ...rest] = args;
  switch (command) {
    case "check-sources": {
      const unknown = rest.filter((arg) => arg !== "--no-fetch");
      if (unknown.length > 0) return usageError(`모르는 인자입니다: ${unknown.join(" ")}`);
      const result = checkEvidenceSources({ env: environment, fetch: !rest.includes("--no-fetch") });
      console.log(JSON.stringify(result, null, 2));
      return result.passed ? 0 : 1;
    }
    case "validate": {
      const [applicationDirectory] = rest;
      if (!applicationDirectory) return usageError("<application-directory> 인자가 필요합니다.");
      try {
        const result = validateApplicationPackage(applicationDirectory);
        console.log(JSON.stringify(result, null, 2));
        return result.passed ? 0 : 1;
      } catch (error) {
        console.error(messageOf(error));
        return 1;
      }
    }
    case "render": {
      const [applicationDirectory, outputPath] = rest;
      if (!applicationDirectory) return usageError("<application-directory> 인자가 필요합니다.");
      try {
        console.log(renderApplicationPackage(applicationDirectory, outputPath));
        return 0;
      } catch (error) {
        console.error(messageOf(error));
        return 1;
      }
    }
    case "question-schema":
      return runApplicationQuestionSchemaCli(rest[0]);
    default:
      return usageError(command ? `모르는 하위 명령입니다: ${command}` : undefined);
  }
}
