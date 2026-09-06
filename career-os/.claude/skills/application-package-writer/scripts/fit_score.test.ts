import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { calculateFitScore, fitScoreColor, parseFitTable, FIT_JUDGMENT_SCORES, FIT_SECTION_WEIGHTS, type FitRow } from "./fit_score.ts";
import { FIT_TABLE_VERDICTS } from "./package_contract.ts";

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

  test("패키지 판정 목록도 점수 계약의 다섯 판정을 사용한다", () => {
    expect<readonly string[]>(FIT_TABLE_VERDICTS).toEqual(Object.keys(FIT_JUDGMENT_SCORES));
  });
});

const table = (rows: string): string => `## 공고 항목별 적합도

| 공고 항목 | 공고 구분 | 근거 | 판정 |
| --- | --- | --- | --- |
${rows}`;

describe("parseFitTable과 calculateFitScore", () => {
  test("세 구분과 다섯 판정을 파싱해 가중 총점과 소계를 계산한다", () => {
    const rows = parseFitTable(table(`| API 개발 | 주요 업무 | 서비스 개발 | 확인됨 |
| 오류 복구 | 주요 업무 | 배치 복구 | 강한 인접 |
| 지표 운영 | 기대 경험 | 알림 구현 | 인접 경험 |
| 모델 운영 | 우대 경험 | 직접 근거 없음 | 공백 |
| 본인 역할 | 주요 업무 | | 사용자 확인 |`));

    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({ item: "API 개발", section: "주요 업무", evidence: "서비스 개발", judgment: "확인됨" });
    expect(calculateFitScore(rows)).toEqual({
      total: 69.4,
      sectionScores: { "주요 업무": 87.5, "기대 경험": 50, "우대 경험": 0 },
      judgmentCounts: { 확인됨: 1, "강한 인접": 1, "인접 경험": 1, 공백: 1, "사용자 확인": 1 },
      excludedCount: 1,
    });
  });

  test("사용자 확인은 분모에서도 빠지고 구분에 계산할 행이 없으면 null이다", () => {
    const rows = parseFitTable(table(`| API 개발 | 주요 업무 | 개발 근거 | 확인됨 |
| 본인 역할 | 기대 경험 | | 사용자 확인 |`));
    expect(calculateFitScore(rows).total).toBe(100);
    expect(calculateFitScore(rows).sectionScores).toEqual({ "주요 업무": 100, "기대 경험": null, "우대 경험": null });
    expect(calculateFitScore(rows).excludedCount).toBe(1);
  });

  test("모든 행이 사용자 확인이면 총점과 모든 소계가 null이다", () => {
    const score = calculateFitScore(parseFitTable(table("| 본인 역할 | 주요 업무 | | 사용자 확인 |")));
    expect(score.total).toBeNull();
    expect(Object.values(score.sectionScores)).toEqual([null, null, null]);
    expect(score.judgmentCounts["사용자 확인"]).toBe(1);
    expect(score.excludedCount).toBe(1);
  });

  test("빈 행 목록을 계산하면 점수 없이 모든 개수를 0으로 반환한다", () => {
    const score = calculateFitScore([]);
    expect(score.total).toBeNull();
    expect(Object.values(score.sectionScores)).toEqual([null, null, null]);
    expect(Object.values(score.judgmentCounts)).toEqual([0, 0, 0, 0, 0]);
    expect(score.excludedCount).toBe(0);
  });

  test("구분별 소계를 반올림하기 전 값으로 총점을 구한다", () => {
    const score = calculateFitScore(parseFitTable(table(`| 개발 | 주요 업무 | 근거 | 확인됨 |
| 설계 | 주요 업무 | 근거 | 확인됨 |
| 운영 | 주요 업무 | 근거 없음 | 공백 |
| 도구 | 우대 경험 | 근거 | 강한 인접 |`)));
    expect(score.sectionScores["주요 업무"]).toBe(66.7);
    expect(score.total).toBe(67.5);
  });

  test("CRLF, 정렬 구분행과 이스케이프한 파이프를 지원하며 다음 절은 읽지 않는다", () => {
    const markdown = `${table("| API 개발 | 주요 업무 | 입력 \\| 출력 계약 | 확인됨 |")}
## 다음 절
| 잘못된 | 표 |`.replace("| --- | --- | --- | --- |", "| :--- | ---: | :---: | --- |").replaceAll("\n", "\r\n");
    const rows = parseFitTable(markdown);
    expect(rows).toHaveLength(1);
    expect(rows[0].evidence).toBe("입력 | 출력 계약");
  });

  test.each([
    ["절 누락", "# 문서\n공고 항목별 적합도를 확인했다.", "필수 섹션"],
    ["표 누락", "## 공고 항목별 적합도\n본문", "데이터 행을 가진 표"],
    ["행 누락", table(""), "데이터 행을 가진 표"],
    ["다음 절의 표", `## 공고 항목별 적합도\n## 다른 절\n${table("| 개발 | 주요 업무 | 근거 | 확인됨 |").split("\n").slice(2).join("\n")}`, "데이터 행을 가진 표"],
    ["열 누락", table("| 개발 | 주요 업무 | 확인됨 |"), "데이터 행은 4열"],
    ["열 추가", table("| 개발 | 주요 업무 | 근거 | 확인됨 | 추가 |"), "데이터 행은 4열"],
    ["구분행 열 누락", table("| 개발 | 주요 업무 | 근거 | 확인됨 |").replace("| --- | --- | --- | --- |", "| --- | --- | --- |"), "구분행은 4열"],
    ["항목 누락", table("| | 주요 업무 | 근거 | 확인됨 |"), "공고 항목이 비어"],
    ["잘못된 구분", table("| 개발 | toString | 근거 | 확인됨 |"), "공고 구분은"],
    ["잘못된 판정", table("| 개발 | 주요 업무 | 근거 | toString |"), "표의 판정은"],
  ])("%s 입력은 빈 배열로 숨기지 않고 거부한다", (_name, markdown, message) => {
    expect(() => parseFitTable(markdown)).toThrow(message);
  });

  test("계산 함수에 잘못된 판정을 직접 주어도 NaN 결과 대신 거부한다", () => {
    const rows = [{ item: "개발", section: "주요 업무", evidence: "근거", judgment: "잘못된 판정" }] as unknown as FitRow[];
    expect(() => calculateFitScore(rows)).toThrow("표의 판정은");
  });
});

describe("fitScoreColor", () => {
  test.each([
    [100, "excellent"], [85, "excellent"], [84.9, "good"], [65, "good"],
    [64.9, "fair"], [45, "fair"], [44.9, "weak"], [25, "weak"], [24.9, "none"], [0, "none"],
  ] as const)("%d점은 %s 색이다", (score, color) => {
    expect(fitScoreColor(score)).toBe(color);
  });

  test.each([NaN, Infinity, -1, 100.1])("잘못된 점수 %d를 거부한다", (score) => {
    expect(() => fitScoreColor(score)).toThrow("0 이상 100 이하");
  });
});
