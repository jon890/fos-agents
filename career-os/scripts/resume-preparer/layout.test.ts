import { describe, expect, test } from "bun:test";
import { existsSync } from "fs";
import { join, resolve } from "path";

const OLD_SKILL_DIR = resolve(import.meta.dir, "../../.claude/skills/resume-preparer");
const TEMPLATE_DIR = join(import.meta.dir, "templates");

describe("resume-preparer 배치", () => {
  test("옛 스킬 scripts 디렉터리가 남아 있지 않다", () => {
    expect(existsSync(join(OLD_SKILL_DIR, "scripts"))).toBe(false);
  });

  test("템플릿 세 파일이 실행 코드 옆에 있다", () => {
    for (const name of ["resume.css", "resume.html", "resume-page.html"]) {
      const file = join(TEMPLATE_DIR, name);
      expect(existsSync(file), file).toBe(true);
    }
  });

  // 로고는 개인 경력을 드러내므로 저장소 스킬에 두지 않고 작업본에서 읽는다(ADR-138).
  test("저장소 스킬에 templates 디렉터리가 남아 있지 않다", () => {
    const templates = join(OLD_SKILL_DIR, "templates");
    expect(existsSync(templates), templates).toBe(false);
  });
});
