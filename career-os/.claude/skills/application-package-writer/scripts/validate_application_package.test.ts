import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { validateApplicationPackage } from "./validate_application_package.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function write(directory: string, relativePath: string, content: string): void {
  const path = join(directory, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "application-package-"));
  directories.push(directory);
  return directory;
}

function form(answer: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    formUrl: "https://example.com/job/apply",
    verifiedAt: "2026-09-03",
    status: "fields_verified",
    profileSource: "private-brain:career-application-profile",
    sections: [{ title: "기본 정보", fields: [{ id: "name", label: "이름", value: "지원자", source: "profile", required: true }] }],
    attachments: [],
    questions: [{ id: "motivation", prompt: "지원동기를 적어 주세요", answer }],
    submission: { autofill: "ready_for_preview", finalSubmit: "requires_user_approval" },
    notes: [],
  });
}

describe("validateApplicationPackage", () => {
  test("빈 디렉터리도 통과한다. 파일과 절은 검사 대상이 아니다", () => {
    expect(validateApplicationPackage(fixture()).passed).toBe(true);
  });

  test("절 이름과 준비 상태 세 줄을 어떻게 쓰든 막지 않는다", () => {
    const directory = fixture();
    write(directory, "evidence/status.md", "# 상태\n\n## 내가 정한 절\n\n내용");
    write(directory, "evidence/fit.md", "# 적합도\n\n## 내가 정한 절\n\n내용");

    expect(validateApplicationPackage(directory).passed).toBe(true);
  });

  test("제출 이력서의 내부 근거 경로를 거부한다", () => {
    const directory = fixture();
    write(directory, "evidence/resume-draft.md", "## 경력\n\nsources/fos-study/task/private.md");

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("내부 정보");
  });

  test("제출 경력기술서의 내부 경로도 거부한다", () => {
    const directory = fixture();
    write(directory, "evidence/career-description-draft.md", "## 경력\n\n/Users/example/repo");

    expect(validateApplicationPackage(directory).passed).toBe(false);
  });

  test("지원서 답변의 커밋 해시를 거부한다", () => {
    const directory = fixture();
    write(directory, "evidence/application-form.json", form(`근거는 ${"a".repeat(40)} 커밋에 있습니다.`));

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("motivation");
  });

  test("지원서 답변이 제출용 문장이면 통과한다", () => {
    const directory = fixture();
    write(directory, "evidence/application-form.json", form("문서 변환 서비스를 맡아 처리 비용을 줄였습니다."));

    expect(validateApplicationPackage(directory).passed).toBe(true);
  });

  test("지원서 입력값 형식이 깨지면 거부한다", () => {
    const directory = fixture();
    write(directory, "evidence/application-form.json", "{}");

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("형식이 올바르지 않습니다");
  });

  test("내부 문서의 근거 경로는 검사하지 않는다", () => {
    const directory = fixture();
    write(directory, "evidence/fit.md", "## 근거\n\nsources/fos-study/task/example.md");

    expect(validateApplicationPackage(directory).passed).toBe(true);
  });
});
