import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileInterviewPracticeStore } from "./store/file-store.ts";
import {
  loadQuestionBank,
  runDrillCli,
  selectQuestions,
  type DrillQuestion,
} from "./drill-engine.ts";

const directories: string[] = [];
afterEach(() =>
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })),
);
const question: DrillQuestion = {
  id: "personal-1",
  topic: "transaction",
  category: "database",
  difficulty: "basic",
  question: "트랜잭션을 설명해 주세요.",
  intent: "기본 이해 확인",
  answerSignals: ["원자성"],
};
function store(): FileInterviewPracticeStore {
  const directory = mkdtempSync(join(tmpdir(), "drill-engine-"));
  directories.push(directory);
  return new FileInterviewPracticeStore(directory, () => new Date("2026-08-13T01:00:00.000Z"));
}

describe("면접 연습 CLI", () => {
  test("설정이 없으면 doctor가 저장소와 후보자 맥락을 모두 실패로 낸다", async () => {
    const result = (await runDrillCli(["doctor"], {
      environment: {},
      createStore: () => {
        throw new Error("만들면 안 됩니다.");
      },
      readFile: () => "",
    })) as { passed: boolean; checks: Array<{ name: string; ok: boolean }> };
    expect(result.passed).toBeFalse();
    expect(result.checks.map(({ name, ok }) => ({ name, ok }))).toEqual([
      { name: "CAREER_STORE", ok: false },
      { name: "CAREER_MEMORY", ok: false },
    ]);
  });
  test("file 저장소와 유효한 파일 후보자 맥락이면 doctor가 통과한다", async () => {
    const directory = mkdtempSync(join(tmpdir(), "drill-doctor-"));
    directories.push(directory);
    const result = (await runDrillCli(["doctor"], {
      environment: { CAREER_STORE: "file", CAREER_STORE_DIR: directory, CAREER_MEMORY: "file", CAREER_MEMORY_FILE: "memory.json" },
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
  test("memory와 잘못된 저장소 doctor는 저장소를 만들지 않고 모든 점검을 낸다", async () => {
    const createStore = () => {
      throw new Error("저장소 생성 실패");
    };
    const memory = await runDrillCli(["memory"], {
      environment: { CAREER_MEMORY: "brain" },
      createStore,
      readFile: () => "",
    });
    expect((memory as { provider: string }).provider).toBe("brain");
    const doctor = (await runDrillCli(["doctor"], {
      environment: { CAREER_MEMORY: "brain" },
      createStore,
      readFile: () => "",
    })) as { checks: Array<{ name: string; ok: boolean }> };
    expect(doctor.checks.map(({ name, ok }) => ({ name, ok }))).toEqual([
      { name: "CAREER_STORE", ok: false },
      { name: "CAREER_MEMORY", ok: true },
    ]);
  });
  test("저장소 생성이 실패해도 brain 후보자 맥락 doctor 점검은 계속한다", async () => {
    const result = (await runDrillCli(["doctor"], {
      environment: { CAREER_STORE: "file", CAREER_MEMORY: "brain" },
      createStore: () => {
        throw new Error("저장소 생성 실패");
      },
      readFile: () => "",
    })) as { passed: boolean; checks: Array<{ name: string; ok: boolean }> };
    expect(result.passed).toBeFalse();
    expect(result.checks.map(({ name, ok }) => ({ name, ok }))).toEqual([
      { name: "CAREER_STORE", ok: false },
      { name: "CAREER_MEMORY", ok: true },
    ]);
  });
  test("개인 질문을 select 결과에 넣는다", async () => {
    const value = store();
    await value.recordAttempt({
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
    await value.recordAttempt({
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
    const result = (await runDrillCli(["select", "behavioral"], {
      createStore: () => ({
        kind: "file",
        listProgress: async () => publicProgress,
        listPersonalQuestions: async () => [
          { questionId: personal.id, drillType: "behavioral", enabled: true, question: personal },
        ],
        recordAttempt: async () => {
          throw new Error("사용하지 않습니다.");
        },
        upsertPersonalQuestion: async () => {
          throw new Error("사용하지 않습니다.");
        },
      }),
      readFile: () => "",
    })) as { questions: Array<DrillQuestion & { dueForReview: boolean }> };
    expect(result.questions.find((item) => item.id === personal.id)?.dueForReview).toBeFalse();
  });
  test("attemptId 없는 record를 사용법 오류로 거절한다", async () => {
    await expect(
      runDrillCli(["record", "--drill-type", "tech"], { createStore: store, readFile: () => "" }),
    ).rejects.toThrow("--attempt-id");
  });
  test("형식이 틀린 jsonl은 저장 전에 거절한다", async () => {
    const value = store();
    await expect(
      runDrillCli(["personal", "add", "--file", "bad.jsonl"], {
        createStore: () => value,
        readFile: () => '{"drillType":"tech"}\n',
      }),
    ).rejects.toThrow();
    expect(await value.listPersonalQuestions("tech", { includeDisabled: true })).toEqual([]);
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
