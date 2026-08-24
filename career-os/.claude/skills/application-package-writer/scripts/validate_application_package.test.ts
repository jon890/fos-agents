import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REQUIRED_HEADINGS, REQUIRED_PACKAGE_FILES } from "./package_contract.ts";
import { validateApplicationPackage } from "./validate_application_package.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "application-package-"));
  directories.push(directory);
  for (const file of REQUIRED_PACKAGE_FILES) {
    const headings = (REQUIRED_HEADINGS[file] ?? []).join("\n\n내용\n\n");
    writeFileSync(join(directory, file), `# ${file}\n\n${headings}\n`, "utf8");
  }
  writeFileSync(
    join(directory, "application-package.md"),
    `# 지원 준비\n\n- readiness: ready\n- evidence: safe\n- 공식 공고: https://example.com/job\n- 근거: sources/fos-study/task/example.md\n\n${REQUIRED_HEADINGS["application-package.md"].join("\n\n내용\n\n")}`,
  );
  return directory;
}

describe("validateApplicationPackage", () => {
  test("지원 준비 계약을 만족하면 통과한다", () => {
    expect(validateApplicationPackage(fixture()).passed).toBe(true);
  });

  test("제출 이력서의 내부 근거 경로를 거부한다", () => {
    const directory = fixture();
    writeFileSync(join(directory, "resume-draft.md"), `${REQUIRED_HEADINGS["resume-draft.md"].join("\n")}\nsources/fos-study/task/private.md`);
    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("내부 정보");
  });
});
