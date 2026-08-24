import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REQUIRED_HEADINGS, REQUIRED_PACKAGE_FILES } from "./package_contract.ts";
import { renderApplicationPackage } from "./render_application_package.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "application-package-render-"));
  directories.push(directory);
  for (const file of REQUIRED_PACKAGE_FILES) {
    const headings = (REQUIRED_HEADINGS[file] ?? []).join("\n\n내용\n\n");
    writeFileSync(join(directory, file), `# ${file}\n\n${headings}\n`, "utf8");
  }
  writeFileSync(
    join(directory, "application-package.md"),
    `# 토스플레이스 AI Platform 지원 준비\n\n- readiness: needs_user_input\n- evidence: safe\n- 공식 공고: https://example.com/job\n- 근거: sources/fos-study/task/example.md\n\n${REQUIRED_HEADINGS["application-package.md"].join("\n\n내용\n\n")}`,
  );
  writeFileSync(join(directory, "application-answers.md"), "# 지원 문항\n\n실제 사용자에게 닿는 AI를 만들고 싶습니다.");
  return directory;
}

describe("renderApplicationPackage", () => {
  test("지원 판단과 제출 초안을 하나의 반응형 HTML로 묶는다", () => {
    const directory = fixture();
    const outputPath = renderApplicationPackage(directory);
    const html = readFileSync(outputPath, "utf8");

    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain("내 답변 필요");
    expect(html).toContain('class="review-card"');
    expect(html).toContain(".review-card { min-width: 0;");
    expect(html).toContain(".table-scroll { width: 100%; max-width: 100%;");
    expect(html).toContain("이력서 초안");
    expect(html).toContain("지원 문항 초안");
    expect(html).toContain("후보자 인터뷰 기록");
  });
});
