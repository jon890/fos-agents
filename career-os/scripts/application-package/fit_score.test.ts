import { describe, expect, test } from "bun:test";
import { computeFitScores } from "./fit_score.ts";

function table(rows: [string, string][]): string {
  return ["| 공고 항목 | 공고 구분 | 근거 | 점수 |", "| --- | --- | --- | --- |"]
    .concat(rows.map(([category, score], order) => `| 항목 ${order + 1} | ${category} | 근거 | ${score} |`))
    .join("\n");
}

function weights(rows: [string, number][]): string {
  return ["| 공고 구분 | 가중치 |", "| --- | --- |"]
    .concat(rows.map(([category, weight]) => `| ${category} | ${weight} |`))
    .join("\n");
}

describe("computeFitScores", () => {
  test("소계는 그 구분에 속한 행의 점수 평균이다", () => {
    const result = computeFitScores(table([["주요 업무", "90"], ["주요 업무", "60"]]));

    expect(result.categories[0].subtotal).toBe(75);
    expect(result.total).toBe(75);
  });

  test("가중치가 큰 구분이 총점을 더 움직인다", () => {
    const source = `${table([["주요 업무", "100"], ["우대 경험", "0"]])}\n\n${weights([["주요 업무", 3], ["우대 경험", 1]])}`;
    const result = computeFitScores(source);

    expect(result.numerator).toBe(300);
    expect(result.denominator).toBe(400);
    expect(result.total).toBe(75);
  });

  test("가중치 표가 없으면 모든 구분을 1로 본다", () => {
    const result = computeFitScores(table([["주요 업무", "100"], ["우대 경험", "0"]]));

    expect(result.total).toBe(50);
  });

  test("사용자 확인 행은 분자와 분모 양쪽에서 뺀다", () => {
    const result = computeFitScores(table([["주요 업무", "80"], ["주요 업무", "사용자 확인"]]));

    expect(result.categories[0].pending).toBe(1);
    expect(result.categories[0].scores).toEqual([80]);
    expect(result.total).toBe(80);
  });

  test("적합도 표가 없으면 총점을 내지 않는다", () => {
    expect(computeFitScores("# 지원\n\n본문만 있다").total).toBeNull();
  });
});
