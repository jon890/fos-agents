import { afterEach, describe, expect, test } from "bun:test";
import { dueForReview, toDrillProgress } from "../../../interview-drill/question-selection.ts";
import { closeCareerStores, openCareerStore } from "../database.ts";
import { CareerStoreError } from "../errors.ts";
import { cleanupCareerWorkspaces, createCareerWorkspace } from "../test-support.ts";
import { InterviewStore } from "./store.ts";

afterEach(cleanupCareerWorkspaces);

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
const day = (date: string) => () => new Date(`${date}T01:00:00.000Z`);

function store(now = day("2026-08-13")) {
  const workspace = createCareerWorkspace();
  return { ...workspace, store: new InterviewStore(workspace.db, now) };
}

describe("면접 연습 저장", () => {
  test("pass 기록은 다음 날 복습 상태를 만든다", async () => {
    const { store: interview } = store();
    await interview.createAttempt(body);
    expect((await interview.listProgress("tech")).items).toEqual([
      expect.objectContaining({ passCount: 1, nextReviewDate: "2026-08-14", lastPassedDate: "2026-08-13" }),
    ]);
    expect((await interview.listProgress("behavioral")).items).toEqual([]);
  });

  test("같은 attemptId 기록은 한 번만 반영하고 당시의 응답을 돌려준다", async () => {
    const { store: interview } = store();
    const first = await interview.createAttempt(body);
    await interview.createAttempt({
      ...body,
      attemptId: "22222222-2222-4222-8222-222222222222",
      score: "fail",
    });
    await expect(interview.createAttempt(body)).resolves.toEqual(first);
    expect((await interview.listProgress("tech")).items[0]).toMatchObject({ passCount: 1, failCount: 1 });
  });

  test("같은 attemptId 에 다른 본문이 오면 충돌이고 복습 상태를 바꾸지 않는다", async () => {
    const { store: interview } = store();
    await interview.createAttempt(body);
    const error = await interview.createAttempt({ ...body, score: "fail" }).catch((caught) => caught);
    expect(error).toBeInstanceOf(CareerStoreError);
    expect((error as CareerStoreError).code).toBe("IDEMPOTENCY_CONFLICT");
    expect((await interview.listProgress("tech")).items[0]).toMatchObject({ passCount: 1, failCount: 0 });
  });

  test("형식이 틀린 기록은 저장하지 않는다", async () => {
    const { store: interview } = store();
    await expect(interview.createAttempt({ ...body, attemptId: "bad" })).rejects.toThrow(CareerStoreError);
    expect((await interview.listProgress("tech")).items).toEqual([]);
  });

  test("개인 질문은 끈 뒤 목록에서 빠지고 같은 내용으로 다시 켜면 돌아온다", async () => {
    const { store: interview } = store();
    const on = { enabled: true, drillType: "tech" as const, question };
    await interview.upsertPersonalQuestion(question.id, on);
    expect((await interview.listEnabledPersonalQuestions("tech")).items).toEqual([question]);
    await interview.upsertPersonalQuestion(question.id, { ...on, enabled: false });
    expect((await interview.listEnabledPersonalQuestions("tech")).items).toEqual([]);
    await interview.upsertPersonalQuestion(question.id, on);
    expect((await interview.listEnabledPersonalQuestions("tech")).items).toHaveLength(1);
  });

  test("questionId 가 질문의 id 와 다르면 저장하지 않는다", async () => {
    const { store: interview } = store();
    await expect(
      interview.upsertPersonalQuestion("other", { enabled: true, drillType: "tech", question }),
    ).rejects.toThrow(CareerStoreError);
    expect((await interview.listEnabledPersonalQuestions("tech")).items).toEqual([]);
  });

  test("연결을 닫고 다시 열어도 복습 상태와 개인 질문이 남고, 복습일이 되면 복습 대상으로 나온다", async () => {
    const { store: first, environment } = store();
    await first.createAttempt(body);
    await first.upsertPersonalQuestion(question.id, { enabled: true, drillType: "tech", question });
    closeCareerStores();

    const reopened = new InterviewStore(openCareerStore(environment), day("2026-08-14"));
    const progress = toDrillProgress((await reopened.listProgress("tech")).items);
    expect(dueForReview(progress, "transaction", "2026-08-13")).toBe(false);
    expect(dueForReview(progress, "transaction", "2026-08-14")).toBe(true);
    expect((await reopened.listEnabledPersonalQuestions("tech")).items).toEqual([question]);
  });
});
