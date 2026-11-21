import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupCareerWorkspaces, createCareerWorkspace } from "../../lib/career-store/test-support.ts";
import { checkStudyStore } from "./doctor.ts";

const directories: string[] = [];
afterEach(() => {
  cleanupCareerWorkspaces();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("공부 추천 실행 전 점검", () => {
  test("저장소를 열 수 있고 learning-interests 문서가 있으면 통과한다", async () => {
    const { environment } = createCareerWorkspace({ "learning-interests": "- 관심사" });
    expect(await checkStudyStore(environment)).toEqual({
      passed: true,
      checks: [
        { name: "store", ok: true, message: "커리어 데이터 파일을 열었다" },
        { name: "learning-interests", ok: true, message: "learning-interests 문서가 있다" },
      ],
    });
  });

  test("문서가 없으면 어디에 써야 하는지 알리고 실패한다", async () => {
    const { environment } = createCareerWorkspace();
    const result = await checkStudyStore(environment);
    expect(result.passed).toBe(false);
    expect(result.checks[1]).toMatchObject({ name: "learning-interests", ok: false });
    expect(result.checks[1]!.message).toContain("context/learning-interests.md");
  });

  test("깨진 저장소 파일은 그 code 를 알리고 문서 검사로 넘어가지 않는다", async () => {
    const root = mkdtempSync(join(tmpdir(), "study-doctor-test-"));
    directories.push(root);
    mkdirSync(join(root, "state"), { recursive: true });
    writeFileSync(join(root, "state", "career.sqlite"), "SQLite 가 아니다\n".repeat(100));
    const result = await checkStudyStore({ CAREER_WORKSPACE_ROOT: root });
    expect(result.passed).toBe(false);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0]!.message).toStartWith("CAREER_STORE_CORRUPT: ");
  });
});
