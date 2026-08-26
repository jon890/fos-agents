import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadApplicationInterviewQuestions } from "./application_question_schema.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function validFile() {
  return {
    schemaVersion: 1,
    company: "테스트 회사",
    role: "AI Platform Server Developer",
    sourceDocuments: ["application-package.md"],
    questions: [
      {
        id: "test-position-tool-safety",
        drillType: "tech",
        topic: "tool-safety",
        category: "ai-platform",
        difficulty: "advanced",
        question: "상태를 변경하는 Agent Tool을 어떤 경계와 순서로 안전하게 실행하겠습니까?",
        intent: "상태 변경 Tool의 안전한 실행 계약을 확인한다.",
        answerSignals: ["권한 확인", "실행 전 사용자 확인"],
        followUps: ["중복 실행은 어떻게 막겠습니까?"],
        positionFitHint: "AI Platform의 공통 Tool 계약과 연결한다.",
        origin: "posting_requirement",
        evidenceBoundary: "설계 질문이며 직접 운영 경험으로 표현하지 않는다.",
        tags: ["agent", "tool"],
      },
    ],
  };
}

function writeQuestionFile(value: unknown): string {
  const directory = mkdtempSync(join(tmpdir(), "application-questions-"));
  temporaryDirectories.push(directory);
  writeFileSync(join(directory, "interview-questions.json"), JSON.stringify(value));
  return directory;
}

describe("application interview question schema", () => {
  test("지원별 질문 파일을 검증한다", () => {
    const result = loadApplicationInterviewQuestions(writeQuestionFile(validFile()));
    expect(result.questions).toHaveLength(1);
  });

  test("중복 질문 ID를 거부한다", () => {
    const value = validFile();
    value.questions.push({ ...value.questions[0] });
    expect(() => loadApplicationInterviewQuestions(writeQuestionFile(value))).toThrow(
      "중복 질문 ID",
    );
  });
});
