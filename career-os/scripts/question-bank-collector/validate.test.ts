import { describe, expect, test } from "bun:test";
import {
  validateItem,
  resolveQuestionSource,
  validateSourceRegistry,
  type QuestionItem,
  type QuestionSourceRegistry,
} from "./validate.ts";

const validItem: QuestionItem = {
  id: "java-spring-test",
  category: "java-spring",
  difficulty: "intermediate",
  question: "Spring transaction 경계를 어떤 기준으로 나누는지 실무 사례와 함께 설명해 주세요.",
  intent: "트랜잭션 경계와 서비스 책임 분리 기준을 확인한다.",
  answerSignals: ["일관성 경계", "외부 호출과 트랜잭션 분리"],
  source: "public-official-spring-documentation",
  publicSafe: true,
  positionFitHint: "Spring 기반 백엔드 포지션의 공통 기술 질문으로 사용한다.",
  normalizedFrom: "공식 transaction 문서를 실무 설계 질문으로 정규화했다.",
  topic: "transaction-boundary",
};

const validRegistry: QuestionSourceRegistry = {
  schemaVersion: 1,
  sources: [
    {
      id: "public-official-spring-documentation",
      label: "Spring 공식 문서",
      sourceType: "official-reference-set",
      checkedAt: "2026-08-27",
      scope: "Spring transaction 경계와 동작을 다루는 일반 기술 질문",
      normalizationNote: "공식 문서 내용을 복사하지 않고 실무 설계 판단을 설명하는 질문으로 바꿨다.",
      references: [
        {
          title: "Spring Framework Transaction Management",
          publisher: "Spring",
          url: "https://docs.spring.io/spring-framework/reference/data-access/transaction.html",
        },
      ],
    },
  ],
};

describe("question bank item validation", () => {
  test("공개 가능한 일반 질문을 허용한다", () => {
    expect(() => validateItem("questions.json", validItem, "java-spring")).not.toThrow();
  });

  test("개인 이력이 포함된 질문을 거부한다", () => {
    expect(() =>
      validateItem(
        "questions.json",
        { ...validItem, normalizedFrom: "개인 이력 내용을 질문으로 정규화했다." },
        "java-spring",
      ),
    ).toThrow("private/copyright risk");
  });

  test("public 접두사가 없는 출처를 거부한다", () => {
    expect(() =>
      validateItem(
        "questions.json",
        { ...validItem, source: "internal-interview-note" },
        "java-spring",
      ),
    ).toThrow("source must be public-*");
  });
});

describe("question bank source registry validation", () => {
  test("공식 URL과 확인일이 있는 출처를 허용한다", () => {
    expect(() => validateSourceRegistry("sources.json", validRegistry)).not.toThrow();
  });

  test("https가 아닌 출처 URL을 거부한다", () => {
    const registry = structuredClone(validRegistry);
    registry.sources[0].references[0].url = "http://docs.example.com/transaction";
    expect(() => validateSourceRegistry("sources.json", registry)).toThrow("reference URL must use https");
  });

  test("올바르지 않은 확인일을 거부한다", () => {
    const registry = structuredClone(validRegistry);
    registry.sources[0].checkedAt = "2026-02-30";
    expect(() => validateSourceRegistry("sources.json", registry)).toThrow("checkedAt must be YYYY-MM-DD");
  });

  test("중복된 출처 식별자를 거부한다", () => {
    const registry = structuredClone(validRegistry);
    registry.sources.push(structuredClone(registry.sources[0]));
    expect(() => validateSourceRegistry("sources.json", registry)).toThrow("duplicate source id");
  });

  test("레지스트리에 없는 질문 출처를 거부한다", () => {
    const sourcesById = validateSourceRegistry("sources.json", validRegistry);
    const item = { ...validItem, source: "public-unregistered-source" };
    expect(() => resolveQuestionSource("questions.json", item, sourcesById)).toThrow("is not registered");
  });
});
