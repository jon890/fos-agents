import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { FIT_JUDGMENT_SCORES, FIT_SECTION_WEIGHTS } from "./fit_score.ts";

const schema = readFileSync(new URL("../../../../docs/data-schema.md", import.meta.url), "utf8");
const fitSchema = schema.split("### 적합도 판정과 점수\n")[1]?.split("\n## ")[0] ?? "";

describe("적합도 판정과 점수의 문서 계약", () => {
  test("다섯 판정의 점수와 계산 제외 값이 데이터 스키마와 같다", () => {
    const documentedScores = Object.fromEntries(
      Array.from(fitSchema.matchAll(/^\| `([^`]+)` \| (\d+|계산 제외) \|/gm),
        ([, judgment, score]) => [judgment, score === "계산 제외" ? null : Number(score)]),
    );

    expect(Object.keys(documentedScores)).toHaveLength(5);
    expect<Record<string, number | null>>(FIT_JUDGMENT_SCORES).toEqual(documentedScores);
  });

  test("세 공고 구분의 가중치가 데이터 스키마와 같다", () => {
    const documentedWeights = Object.fromEntries(
      Array.from(fitSchema.matchAll(/^\| ([^|`]+?) \| (\d+) \|$/gm),
        ([, section, weight]) => [section, Number(weight)]),
    );

    expect(Object.keys(documentedWeights)).toHaveLength(3);
    expect<Record<string, number>>(FIT_SECTION_WEIGHTS).toEqual(documentedWeights);
  });

  test("근거 공백의 0점과 판정 보류의 계산 제외를 구분한다", () => {
    expect(FIT_JUDGMENT_SCORES["공백"]).toBe(0);
    expect(FIT_JUDGMENT_SCORES["사용자 확인"]).toBeNull();
  });
});
