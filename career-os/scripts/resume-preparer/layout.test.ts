import { describe, expect, test } from "bun:test";
import { existsSync } from "fs";
import { join, resolve } from "path";

const REPO_SKILL_DIR = resolve(import.meta.dir, "../../.claude/skills/resume-preparer");
const TEMPLATE_DIR = join(import.meta.dir, "templates");

describe("resume-preparer 배치", () => {
  // 스킬 본문은 plugin 이 소유하고, 로고는 개인 경력을 드러내므로 작업본에서 읽는다(ADR-138, ADR-139).
  test("저장소에 resume-preparer 스킬 디렉터리가 없다", () => {
    expect(existsSync(REPO_SKILL_DIR), REPO_SKILL_DIR).toBe(false);
  });

  test("템플릿 세 파일이 실행 코드 옆에 있다", () => {
    for (const name of ["resume.css", "resume.html", "resume-page.html"]) {
      const file = join(TEMPLATE_DIR, name);
      expect(existsSync(file), file).toBe(true);
    }
  });
});
