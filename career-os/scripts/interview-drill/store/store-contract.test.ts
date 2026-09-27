import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileInterviewPracticeStore } from "./file-store.ts";
import type { InterviewPracticeStore } from "./port.ts";

const directories: string[] = [];
afterEach(() =>
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })),
);
const body = {
  attemptId: "11111111-1111-4111-8111-111111111111",
  drillType: "tech" as const,
  questionId: "question-1",
  topic: "transaction",
  question: "트랜잭션을 설명해 주세요.",
  score: "pass" as const,
};
const question = {
  id: "personal-1",
  topic: "transaction",
  category: "database",
  difficulty: "basic" as const,
  question: "질문입니다.",
  intent: "의도를 확인합니다.",
  answerSignals: ["신호"],
};
function describeStoreContract(name: string, makeStore: () => InterviewPracticeStore): void {
  describe(name, () => {
    test("pass 기록은 다음 날 복습 상태를 만든다", async () => {
      const store = makeStore();
      await store.recordAttempt(body);
      await expect(store.listProgress("tech")).resolves.toEqual([
        expect.objectContaining({ passCount: 1, nextReviewDate: "2026-08-14" }),
      ]);
    });
    test("같은 attemptId 기록은 한 번만 반영한다", async () => {
      const store = makeStore();
      await store.recordAttempt(body);
      await store.recordAttempt(body);
      expect((await store.listProgress("tech"))[0]?.passCount).toBe(1);
    });
    test("이전 attemptId 재시도는 당시의 응답을 돌려준다", async () => {
      const store = makeStore();
      const first = await store.recordAttempt(body);
      await store.recordAttempt({
        ...body,
        attemptId: "22222222-2222-4222-8222-222222222222",
        score: "fail",
      });
      await expect(store.recordAttempt(body)).resolves.toEqual(first);
    });
    test("개인 질문은 끈 뒤 목록에서 빠진다", async () => {
      const store = makeStore();
      await store.upsertPersonalQuestion(question.id, {
        enabled: true,
        drillType: "tech",
        question,
      });
      expect(await store.listPersonalQuestions("tech")).toHaveLength(1);
      await store.upsertPersonalQuestion(question.id, {
        enabled: false,
        drillType: "tech",
        question,
      });
      expect(await store.listPersonalQuestions("tech")).toEqual([]);
    });

    test("끈 개인 질문을 같은 내용으로 다시 켜면 목록에 돌아온다", async () => {
      const store = makeStore();
      const on = { enabled: true, drillType: "tech" as const, question };
      await store.upsertPersonalQuestion(question.id, on);
      await store.upsertPersonalQuestion(question.id, { ...on, enabled: false });
      await store.upsertPersonalQuestion(question.id, on);
      expect(await store.listPersonalQuestions("tech")).toHaveLength(1);
    });
    test("형식이 틀린 기록은 저장하지 않는다", async () => {
      const store = makeStore();
      await expect(store.recordAttempt({ ...body, attemptId: "bad" })).rejects.toThrow();
      expect(await store.listProgress("tech")).toEqual([]);
    });
  });
}
describeStoreContract("파일 저장소", () => {
  const directory = mkdtempSync(join(tmpdir(), "store-contract-"));
  directories.push(directory);
  return new FileInterviewPracticeStore(directory, () => new Date("2026-08-13T01:00:00.000Z"));
});
