import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dueForReview, selectFromBank, type SelectableQuestion } from "./question-selection.ts";

const TODAY = "2026-10-04";

function question(id: string, overrides: Partial<SelectableQuestion> = {}): SelectableQuestion {
  return {
    id,
    topic: `topic-${id}`,
    category: "cs",
    difficulty: "basic",
    question: `질문 ${id}`,
    intent: "의도",
    answerSignals: ["신호"],
    ...overrides,
  };
}

describe("selectFromBank", () => {
  test("복습 상태가 비면 maxCount 만큼 고르고 sequenceHint, 난도 순으로 정렬한다", () => {
    const bank = [
      question("c", { sequenceHint: "late" }),
      question("a", { sequenceHint: "opening", difficulty: "advanced" }),
      question("b", { sequenceHint: "opening", difficulty: "basic" }),
    ];
    const result = selectFromBank(bank, {}, { today: TODAY, maxCount: 2 });
    expect(result.map((item) => item.id)).toEqual(["a", "c"]);
    const all = selectFromBank(bank, {}, { today: TODAY, maxCount: 3 });
    expect(all.map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  test("전날 통과한 주제는 제외한다", () => {
    const bank = [question("a"), question("b")];
    const progress = { "topic-a": { pass_count: 1, last_passed: "2026-10-03", next_review_date: "2026-10-10" } };
    const result = selectFromBank(bank, progress, { today: TODAY, maxCount: 5 });
    expect(result.map((item) => item.id)).toEqual(["b"]);
  });

  test("mixApplication 이면 지원 질문을 ceil(maxCount * 0.6) 개까지 포함한다", () => {
    const bank = [
      ...["p1", "p2", "p3", "p4"].map((id) => question(id, { sourceScope: "public" })),
      ...["x1", "x2", "x3", "x4"].map((id) => question(id, { sourceScope: "application" })),
    ];
    const result = selectFromBank(bank, {}, { today: TODAY, maxCount: 5, mixApplication: true });
    expect(result).toHaveLength(5);
    expect(result.filter((item) => item.sourceScope === "application")).toHaveLength(3);
  });

  test("target large-scale 이면 production 질문은 난도 창 밖이라 빠진다", () => {
    const bank = [
      question("a", { bar: "production" }),
      question("b", { bar: "large-scale" }),
    ];
    const result = selectFromBank(bank, {}, { today: TODAY, maxCount: 5, target: "large-scale" });
    expect(result.map((item) => item.id)).toEqual(["b"]);
  });
});

describe("dueForReview", () => {
  test("next_review_date 가 없으면 false", () => {
    expect(dueForReview({}, "topic-a", TODAY)).toBe(false);
    expect(dueForReview({ "topic-a": { next_review_date: null } }, "topic-a", TODAY)).toBe(false);
  });
  test("오늘 이전이면 true, 이후면 false", () => {
    expect(dueForReview({ "topic-a": { next_review_date: "2026-10-03" } }, "topic-a", TODAY)).toBe(true);
    expect(dueForReview({ "topic-a": { next_review_date: "2026-10-05" } }, "topic-a", TODAY)).toBe(false);
  });
});

test("question-selection.ts 는 파일 시스템과 zod 를 import 하지 않는다", () => {
  const source = readFileSync(new URL("./question-selection.ts", import.meta.url), "utf8");
  expect(source).not.toContain("node:fs");
  expect(source).not.toContain("node:path");
  expect(source).not.toContain('"zod"');
});
