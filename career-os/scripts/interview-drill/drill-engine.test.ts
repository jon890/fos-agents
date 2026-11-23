import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeCareerStores, openCareerStore } from "../lib/career-store/database.ts";
import { CareerStoreError } from "../lib/career-store/errors.ts";
import { InterviewStore } from "../lib/career-store/interview/store.ts";
import { cleanupCareerWorkspaces, createCareerWorkspace } from "../lib/career-store/test-support.ts";
import {
  loadQuestionBank,
  runDrillCli,
  selectQuestions,
  type DrillQuestion,
} from "./drill-engine.ts";

const directories: string[] = [];
afterEach(() => {
  cleanupCareerWorkspaces();
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});
const question: DrillQuestion = {
  id: "personal-1",
  topic: "transaction",
  category: "database",
  difficulty: "basic",
  question: "트랜잭션을 설명해 주세요.",
  intent: "기본 이해 확인",
  answerSignals: ["원자성"],
};
const contextDocuments = {
  "career-status": { documentKey: "career-status" as const, version: "career-status:sha256:a", body: "# 합성 경력 상태" },
  "application-state": { documentKey: "application-state" as const, version: "application-state:sha256:b", body: "# 합성 지원 상태" },
};
async function readContextDocuments() {
  return contextDocuments;
}
const databases = new WeakMap<InterviewStore, ReturnType<typeof createCareerWorkspace>["db"]>();
function createdDb(value: InterviewStore) {
  return databases.get(value)!;
}
function store(): InterviewStore {
  const { db } = createCareerWorkspace();
  const value = new InterviewStore(db, () => new Date("2026-08-13T01:00:00.000Z"));
  databases.set(value, db);
  return value;
}

describe("면접 연습 CLI", () => {
  test("저장소를 열지 못하고 설정이 없으면 doctor가 둘 다 실패로 낸다", async () => {
    const result = (await runDrillCli(["doctor"], {
      environment: {},
      createStore: () => {
        throw new CareerStoreError(500, "CAREER_STORE_CORRUPT", "읽을 수 없습니다.");
      },
      readFile: () => "",
    })) as { passed: boolean; checks: Array<{ name: string; ok: boolean }> };
    expect(result.passed).toBeFalse();
    expect(result.checks.map(({ name, ok }) => ({ name, ok }))).toEqual([
      { name: "CAREER_WORKSPACE", ok: false },
      { name: "CAREER_MEMORY", ok: false },
    ]);
  });
  test("저장소가 열리고 유효한 파일 후보자 맥락이면 doctor가 통과한다", async () => {
    const result = (await runDrillCli(["doctor"], {
      environment: { CAREER_MEMORY: "file", CAREER_MEMORY_FILE: "memory.json" },
      createStore: store,
      readFile: () => JSON.stringify({
        schemaVersion: 1,
        currentRole: { title: "Backend Engineer", yearsOfExperience: 3, bar: "production" },
        experience: { direct: [], adjacent: [], studyOnly: [] },
        targets: [],
      }),
    })) as { passed: boolean };
    expect(result.passed).toBeTrue();
  });
  test("memory 는 저장소를 만들지 않고 context 문서를 그대로 낸다", async () => {
    const memory = (await runDrillCli(["memory"], {
      environment: { CAREER_MEMORY: "context" },
      createStore: () => {
        throw new Error("만들면 안 됩니다.");
      },
      readFile: () => "",
      readContextDocuments,
    })) as { provider: string; documents: Array<{ documentKey: string; version: string; body: string }> };
    expect(memory.provider).toBe("context");
    expect(memory.documents).toEqual([contextDocuments["career-status"], contextDocuments["application-state"]]);
  });
  test("context 문서가 빠지면 doctor가 쓸 자리와 빠진 문서 키를 알린다", async () => {
    const result = (await runDrillCli(["doctor"], {
      environment: { CAREER_MEMORY: "context" },
      createStore: store,
      readFile: () => "",
      readContextDocuments: async () => ({ "career-status": contextDocuments["career-status"] }),
    })) as { passed: boolean; checks: Array<{ name: string; ok: boolean; message: string }> };
    expect(result.passed).toBeFalse();
    const memoryCheck = result.checks.find((check) => check.name === "CAREER_MEMORY");
    expect(memoryCheck?.ok).toBeFalse();
    expect(memoryCheck?.message).toContain("context/application-state.md");
    expect(memoryCheck?.message).not.toContain("candidate-memory.json");
    expect(memoryCheck?.message).not.toContain("CAREER_BACKEND");
  });
  test("개인 질문을 select 결과에 넣는다", async () => {
    const value = store();
    await value.createAttempt({
      attemptId: "11111111-1111-4111-8111-111111111111",
      drillType: "behavioral",
      questionId: "personal-1",
      topic: "behavior",
      question: "질문입니다.",
      score: "fail",
    });
    await value.upsertPersonalQuestion(question.id, {
      enabled: true,
      drillType: "behavioral",
      question: { ...question, id: "personal-1", topic: "behavior", category: "behavioral" },
    });
    const result = (await runDrillCli(["select", "behavioral"], {
      createStore: () => value,
      readFile: () => "",
    })) as { questions: DrillQuestion[] };
    expect(
      result.questions.some((item) => item.id === "personal-1" && item.sourceScope === "personal"),
    ).toBeTrue();
  });
  test("복습일이 지난 질문을 dueForReview로 표시한다", async () => {
    const value = store();
    await value.createAttempt({
      attemptId: "22222222-2222-4222-8222-222222222222",
      drillType: "behavioral",
      questionId: "personal-2",
      topic: "overdue",
      question: "질문입니다.",
      score: "fail",
    });
    const personal = { ...question, id: "personal-2", topic: "overdue", category: "behavioral" };
    await value.upsertPersonalQuestion(personal.id, {
      enabled: true,
      drillType: "behavioral",
      question: personal,
    });
    const result = (await runDrillCli(["select", "behavioral"], {
      createStore: () => value,
      readFile: () => "",
    })) as { questions: Array<DrillQuestion & { dueForReview: boolean }> };
    expect(result.questions.find((item) => item.id === personal.id)?.dueForReview).toBeTrue();
  });
  test("진행 상태가 없는 신규 질문은 dueForReview가 거짓이다", async () => {
    const personal = { ...question, id: "personal-3", topic: "new-topic", category: "behavioral" };
    const publicProgress = loadQuestionBank("behavioral").map((item) => ({
      drillType: "behavioral" as const,
      topic: item.topic,
      passCount: 1,
      failCount: 0,
      nextReviewDate: "9999-12-31",
      lastPassedDate: "9999-12-31",
    }));
    const value = store();
    // 공개 질문의 주제를 모두 한참 뒤 복습으로 밀어 두면 진행 상태가 없는 개인 질문만 남는다.
    const nowIso = new Date().toISOString();
    for (const item of publicProgress)
      createdDb(value).run(
        `INSERT OR REPLACE INTO interview_topic_progress
           (drill_type, topic, pass_count, fail_count, next_review_date, last_passed_date, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.drillType, item.topic, item.passCount, item.failCount, item.nextReviewDate, item.lastPassedDate, nowIso],
      );
    await value.upsertPersonalQuestion(personal.id, { enabled: true, drillType: "behavioral", question: personal });
    const result = (await runDrillCli(["select", "behavioral"], {
      createStore: () => value,
      readFile: () => "",
    })) as { questions: Array<DrillQuestion & { dueForReview: boolean }> };
    expect(result.questions.find((item) => item.id === personal.id)?.dueForReview).toBeFalse();
  });
  test("progress 는 주제별 복습 상태와 복습 차례를 낸다", async () => {
    const value = store();
    await value.createAttempt({
      attemptId: "33333333-3333-4333-8333-333333333333",
      drillType: "tech",
      questionId: "question-1",
      topic: "transaction",
      question: "질문입니다.",
      score: "pass",
    });
    const result = (await runDrillCli(["progress", "tech"], { createStore: () => value, readFile: () => "" })) as {
      items: Array<{ topic: string; passCount: number; nextReviewDate: string; dueForReview: boolean }>;
    };
    expect(result.items).toEqual([
      expect.objectContaining({ topic: "transaction", passCount: 1, nextReviewDate: "2026-08-14", dueForReview: true }),
    ]);
  });
  test("attemptId 없는 record 는 새 기록으로 저장하고 만든 attemptId 를 돌려준다", async () => {
    const value = store();
    const args = ["record", "--drill-type", "tech", "--question-id", "q", "--topic", "t", "--question", "질문", "--score", "pass"];
    const first = (await runDrillCli(args, { createStore: () => value, readFile: () => "" })) as { attemptId: string };
    const second = (await runDrillCli(args, { createStore: () => value, readFile: () => "" })) as { attemptId: string };
    expect(first.attemptId).not.toBe(second.attemptId);
    expect((await value.listProgress("tech")).items[0]?.passCount).toBe(2);
  });
  test("record --input 은 JSON 파일의 기록을 저장하고, 형식이 틀리면 저장하지 않는다", async () => {
    const value = store();
    const attempt = { drillType: "tech", questionId: "q", topic: "quoted", question: '따옴표 "와"\n줄바꿈이 있는 질문', score: "shallow" };
    const saved = (await runDrillCli(["record", "--input", "attempt.json"], {
      createStore: () => value,
      readFile: () => JSON.stringify(attempt),
    })) as { attemptId: string; progress: { topic: string; failCount: number } };
    expect(saved.progress).toMatchObject({ topic: "quoted", failCount: 1 });
    await expect(
      runDrillCli(["record", "--input", "attempt.json"], {
        createStore: () => value,
        readFile: () => JSON.stringify({ ...attempt, score: "great" }),
      }),
    ).rejects.toThrow();
    await expect(
      runDrillCli(["record", "--input", "attempt.json"], { createStore: () => value, readFile: () => "{" }),
    ).rejects.toThrow("--input");
    expect((await value.listProgress("tech")).items[0]?.failCount).toBe(1);
  });
  test("record --input 은 만든 attemptId 를 입력 파일에 되써, 같은 파일로 다시 실행해도 한 번만 쌓인다", async () => {
    const value = store();
    let file = JSON.stringify({ drillType: "tech", questionId: "q", topic: "retry", question: "질문", score: "fail" });
    const run = () =>
      runDrillCli(["record", "--input", "attempt.json"], {
        createStore: () => value,
        readFile: () => file,
        writeFile: (_path, content) => {
          file = content;
        },
      }) as Promise<{ attemptId: string }>;
    const first = await run();
    expect(JSON.parse(file).attemptId).toBe(first.attemptId);
    expect(await run()).toEqual(first);
    expect((await value.listProgress("tech")).items[0]?.failCount).toBe(1);
  });
  test("다른 날 다시 열어 고르면 앞 연습의 복습 대상과 저장한 개인 질문이 나온다", async () => {
    const workspace = createCareerWorkspace();
    const dayOne = new InterviewStore(workspace.db, () => new Date("2026-08-13T01:00:00.000Z"));
    const personal = { ...question, id: "personal-due", topic: "due-topic", category: "behavioral" };
    await dayOne.upsertPersonalQuestion(personal.id, { enabled: true, drillType: "behavioral", question: personal });
    await dayOne.createAttempt({
      attemptId: "44444444-4444-4444-8444-444444444444",
      drillType: "behavioral",
      questionId: personal.id,
      topic: personal.topic,
      question: personal.question,
      score: "fail",
    });
    const select = async (now: string) => {
      closeCareerStores();
      const reopened = new InterviewStore(openCareerStore(workspace.environment));
      const result = (await runDrillCli(["select", "behavioral"], {
        createStore: () => reopened,
        readFile: () => "",
        now: () => new Date(now),
      })) as { today: string; questions: Array<DrillQuestion & { dueForReview: boolean }> };
      return result.questions.find((item) => item.id === personal.id);
    };
    // 같은 날에는 복습일(다음 날)이 오지 않았다.
    expect((await select("2026-08-13T02:00:00.000Z"))?.dueForReview ?? false).toBeFalse();
    expect(await select("2026-08-14T02:00:00.000Z")).toMatchObject({ sourceScope: "personal", dueForReview: true });
  });
  test("필수 값이 빠진 record 를 사용법 오류로 거절한다", async () => {
    await expect(
      runDrillCli(["record", "--drill-type", "tech"], { createStore: store, readFile: () => "" }),
    ).rejects.toThrow("--question-id");
  });
  test("형식이 틀린 jsonl은 저장 전에 거절한다", async () => {
    const value = store();
    await expect(
      runDrillCli(["personal", "add", "--file", "bad.jsonl"], {
        createStore: () => value,
        readFile: () => '{"drillType":"tech"}\n',
      }),
    ).rejects.toThrow();
    expect((await value.listEnabledPersonalQuestions("tech")).items).toEqual([]);
  });
});

describe("지원별 질문 선택", () => {
  test("명시한 지원 디렉터리의 질문을 공통 질문보다 우선한다", () => {
    const directory = mkdtempSync(join(tmpdir(), "drill-application-"));
    directories.push(directory);
    mkdirSync(join(directory, "evidence"), { recursive: true });
    writeFileSync(
      join(directory, "evidence", "interview-questions.json"),
      JSON.stringify({
        schemaVersion: 1,
        company: "테스트 회사",
        role: "AI Platform Server Developer",
        sourceDocuments: ["evidence/fit.md"],
        questions: [
          {
            id: "test-position-specific-question",
            drillType: "tech",
            topic: "position-specific-question",
            category: "ai-platform",
            difficulty: "advanced",
            question: "여러 팀이 함께 사용하는 AI Platform의 공통 계약을 어떻게 설계하겠습니까?",
            intent: "포지션 핵심 책임에 맞는 플랫폼 설계 판단을 확인한다.",
            answerSignals: ["입출력 계약", "권한과 오류 경계"],
            positionFitHint: "현재 지원 포지션의 공통 플랫폼 책임과 연결한다.",
            origin: "posting_requirement",
            evidenceBoundary: "설계 질문이며 직접 운영 경험으로 확대하지 않는다.",
          },
        ],
      }),
    );
    const selected = selectQuestions("tech", {}, 1, directory);
    expect(selected[0]?.id).toBe("test-position-specific-question");
    expect(selected[0]?.sourceScope).toBe("application");
  });
  test("다섯 문제 세션은 포지션 질문만으로 채우지 않는다", () => {
    const directory = mkdtempSync(join(tmpdir(), "drill-mixed-application-"));
    directories.push(directory);
    mkdirSync(join(directory, "evidence"), { recursive: true });
    writeFileSync(
      join(directory, "evidence", "interview-questions.json"),
      JSON.stringify({
        schemaVersion: 1,
        company: "테스트 회사",
        role: "Backend Developer",
        sourceDocuments: ["evidence/posting.md"],
        questions: Array.from({ length: 5 }, (_, index) => ({
          id: `test-position-${index + 1}`,
          drillType: "tech",
          topic: `position-${index + 1}`,
          category: "system-design",
          difficulty: "advanced",
          bar: index === 4 ? "global-scale" : "large-scale",
          question: `여러 팀이 사용하는 플랫폼의 설계 판단 ${index + 1}을 구체적으로 설명해 주세요.`,
          intent: "포지션별 시스템 설계 판단을 확인한다.",
          answerSignals: ["제약", "트레이드오프"],
          positionFitHint: "지원 포지션의 플랫폼 책임과 연결한다.",
          origin: "posting_requirement",
          evidenceBoundary: "설계 답변이며 직접 운영 경험으로 확대하지 않는다.",
        })),
      }),
    );
    const selected = selectQuestions("tech", {}, 5, directory, "large-scale");
    expect(selected.filter((item) => item.sourceScope === "application")).toHaveLength(3);
    expect(selected.filter((item) => item.sourceScope !== "application")).toHaveLength(2);
    expect(selected.some((item) => item.bar === "global-scale")).toBeTrue();
    expect(
      selected.every((item) => item.bar !== "production" && item.difficulty !== "basic"),
    ).toBeTrue();
  });
});
