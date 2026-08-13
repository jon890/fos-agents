import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REQUIRED_APPLICATION_FILES, REQUIRED_REVIEW_HEADINGS } from "./review_contract.ts";
import { validateReview } from "./validate_review.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "application-review-"));
  directories.push(directory);
  mkdirSync(directory, { recursive: true });
  for (const file of REQUIRED_APPLICATION_FILES) writeFileSync(join(directory, file), `# ${file}\n검토할 내용`);

  const headings = REQUIRED_REVIEW_HEADINGS.map((heading) => `${heading}\n\n- 확인 완료\n- 추가 근거`).join("\n\n");
  writeFileSync(join(directory, "review.md"), `# 지원 패키지 검토\n\n- 결과: revise\n- 다음 행동: 아래 수정 요청을 반영합니다.\n\n${headings}\n\n- result: revise\n- confidence: high\n`);
  return directory;
}

describe("validateReview", () => {
  test("필수 입력과 검토 계약을 만족하면 통과한다", () => {
    expect(validateReview(fixture()).passed).toBe(true);
  });

  test("제출 초안의 내부 절대 경로를 거부한다", () => {
    const directory = fixture();
    writeFileSync(join(directory, "resume-draft.md"), "/Users/private/evidence.md");
    const result = validateReview(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("내부 검토 정보");
  });
});
