import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  selectQuestions,
  type DrillQuestion,
  updateDrillProgressState,
} from "./drill-engine.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const question: DrillQuestion = {
  id: "test-1",
  topic: "transaction",
  category: "database",
  difficulty: "basic",
  question: "트랜잭션을 설명해 주세요.",
  intent: "기본 이해 확인",
  answerSignals: ["원자성"],
};

describe("답변 연습 복습 상태", () => {
  test("첫 통과는 하루 뒤, 두 번째 통과는 사흘 뒤에 복습한다", () => {
    const first = updateDrillProgressState({}, question, "pass", "2026-08-13");
    expect(first.transaction?.next_review_date).toBe("2026-08-14");

    const second = updateDrillProgressState(first, question, "pass", "2026-08-14");
    expect(second.transaction?.next_review_date).toBe("2026-08-17");
  });

  test("실패한 질문은 다음 날 다시 복습한다", () => {
    const progress = updateDrillProgressState({}, question, "fail", "2026-08-13");
    expect(progress.transaction).toMatchObject({ fail_count: 1, next_review_date: "2026-08-14" });
  });
});

describe("지원별 질문 선택", () => {
  test("명시한 지원 디렉터리의 질문을 공통 질문보다 우선한다", () => {
    const directory = mkdtempSync(join(tmpdir(), "drill-application-"));
    temporaryDirectories.push(directory);
    writeFileSync(
      join(directory, "interview-questions.json"),
      JSON.stringify({
        schemaVersion: 1,
        company: "테스트 회사",
        role: "AI Platform Server Developer",
        sourceDocuments: ["application-package.md"],
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
            evidenceBoundary: "설계 질문이며 직접 운영 경험으로 확대하지 않는다."
          }
        ]
      }),
    );

    const selected = selectQuestions("tech", {}, 1, directory);
    expect(selected[0]?.id).toBe("test-position-specific-question");
    expect(selected[0]?.sourceScope).toBe("application");
  });
});
