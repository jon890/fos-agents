import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterviewPracticeStore } from "./index.ts";

test("CAREER_STORE가 없으면 doctor 안내와 함께 실패한다", () =>
  expect(() => createInterviewPracticeStore({})).toThrow("doctor"));
test("file 저장소는 지정한 디렉터리를 사용한다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "store-index-"));
  try {
    const store = createInterviewPracticeStore({
      CAREER_STORE: "file",
      CAREER_STORE_DIR: directory,
    });
    expect(store.kind).toBe("file");
    await store.listProgress("tech");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("빈 CAREER_STORE_DIR은 지정한 career-os 임시 경로의 기본 저장소를 사용한다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "store-index-"));
  try {
    for (const value of ["", "  "]) {
      const store = createInterviewPracticeStore(
        { CAREER_STORE: "file", CAREER_STORE_DIR: value },
        directory,
      );
      await store.recordAttempt({
        attemptId: value
          ? "22222222-2222-4222-8222-222222222222"
          : "11111111-1111-4111-8111-111111111111",
        drillType: "tech",
        questionId: "question-1",
        topic: "transaction",
        question: "질문입니다.",
        score: "pass",
      });
    }
    expect(existsSync(join(directory, "state", "interview-practice", "attempts.jsonl"))).toBeTrue();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
