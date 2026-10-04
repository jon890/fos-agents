import { describe, expect, test } from "bun:test";
import { existsSync } from "fs";
import { join, resolve } from "path";
import {
  DOCUMENT_TEMPLATE_PATH,
  LOGO_DIR,
  PAGE_TEMPLATE_PATH,
  DEFAULT_DESIGN_PATH,
} from "./export_resume.ts";

const OLD_SCRIPTS_DIR = resolve(import.meta.dir, "../../.claude/skills/resume-preparer/scripts");

describe("resume-preparer 배치", () => {
  test("옛 스킬 scripts 디렉터리가 남아 있지 않다", () => {
    expect(existsSync(OLD_SCRIPTS_DIR)).toBe(false);
  });

  test("템플릿 세 파일이 실행 코드 옆에 있다", () => {
    for (const file of [DEFAULT_DESIGN_PATH, DOCUMENT_TEMPLATE_PATH, PAGE_TEMPLATE_PATH]) {
      expect(existsSync(file), file).toBe(true);
    }
  });

  test("로고 디렉터리에 index.json 이 있다", () => {
    expect(existsSync(join(LOGO_DIR, "index.json")), LOGO_DIR).toBe(true);
  });
});
