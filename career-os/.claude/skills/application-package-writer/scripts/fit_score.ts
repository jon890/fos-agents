export type FitJudgment =
  | "확인됨"
  | "강한 인접"
  | "인접 경험"
  | "공백"
  | "사용자 확인";

// data-schema.md의 「적합도 판정과 점수」를 따른다. null은 계산 제외다.
export const FIT_JUDGMENT_SCORES = {
  확인됨: 100,
  "강한 인접": 75,
  "인접 경험": 50,
  공백: 0,
  "사용자 확인": null,
} as const satisfies Record<FitJudgment, number | null>;

export const FIT_SECTION_WEIGHTS = {
  "주요 업무": 3,
  "기대 경험": 2,
  "우대 경험": 1,
} as const;

export type FitSection = keyof typeof FIT_SECTION_WEIGHTS;
export type FitRow = {
  item: string;
  section: FitSection;
  evidence: string;
  judgment: FitJudgment;
};
export type FitScore = {
  total: number | null;
  sectionScores: Record<FitSection, number | null>;
  judgmentCounts: Record<FitJudgment, number>;
  excludedCount: number;
};
export type FitColor = "excellent" | "good" | "fair" | "weak" | "none";

export const FIT_SCORE_COLOR_BANDS = [
  { minimum: 85, color: "excellent" },
  { minimum: 65, color: "good" },
  { minimum: 45, color: "fair" },
  { minimum: 25, color: "weak" },
  { minimum: 0, color: "none" },
] as const satisfies readonly { minimum: number; color: FitColor }[];

export const FIT_TABLE_HEADING = "## 공고 항목별 적합도";
/** 머리행 순서까지 계약이다. package_contract.ts에서도 같은 상수를 내보낸다. */
export const FIT_TABLE_HEADERS = ["공고 항목", "공고 구분", "근거", "판정"] as const;

function tableCells(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  const content = line.replace(/^\|/, "").replace(/\|$/, "");
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === "\\" && index + 1 < content.length) {
      const next = content[index + 1];
      cell += next === "|" || next === "\\" ? next : `\\${next}`;
      index += 1;
    } else if (character === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function validateRows(rows: FitRow[]): void {
  const items = new Set<string>();
  for (const row of rows) {
    if (!Object.hasOwn(FIT_SECTION_WEIGHTS, row.section)) {
      throw new Error(`${FIT_TABLE_HEADING} 표의 공고 구분은 ${Object.keys(FIT_SECTION_WEIGHTS).join(", ")} 중 하나여야 합니다: ${row.section}`);
    }
    if (!Object.hasOwn(FIT_JUDGMENT_SCORES, row.judgment)) {
      throw new Error(`${FIT_TABLE_HEADING} 표의 판정은 ${Object.keys(FIT_JUDGMENT_SCORES).join(", ")} 중 하나여야 합니다: ${row.judgment}`);
    }
    const item = row.item.trim();
    if (!item) throw new Error(`${FIT_TABLE_HEADING} 표의 공고 항목이 비어 있습니다.`);
    if (items.has(item)) throw new Error(`${FIT_TABLE_HEADING} 표의 공고 항목이 중복됩니다: ${item}`);
    items.add(item);
    if (row.judgment !== "사용자 확인" && !row.evidence.trim()) {
      throw new Error(`${FIT_TABLE_HEADING} 표의 사용자 확인이 아닌 항목에는 근거가 필요합니다: ${item}`);
    }
  }
}

/** 지정 절의 첫 표만 읽는다. 잘못된 표를 판정이 없는 상태로 바꾸지 않는다. */
export function parseFitTable(markdown: string): FitRow[] {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim());
  const start = lines.indexOf(FIT_TABLE_HEADING);
  if (start < 0) throw new Error(`필수 섹션이 없습니다: ${FIT_TABLE_HEADING}`);
  const nextHeading = lines.findIndex((line, index) => index > start && /^#{1,2} /.test(line));
  const section = lines.slice(start + 1, nextHeading < 0 ? undefined : nextHeading);
  const divider = section.findIndex((line, index) =>
    index > 0 && section[index - 1].startsWith("|") && /^\|(?:\s*:?-{3,}:?\s*\|)+$/.test(line),
  );
  const dataRows: string[] = [];
  for (let index = divider + 1; divider > 0 && index < section.length; index += 1) {
    if (!section[index].startsWith("|")) break;
    dataRows.push(section[index]);
  }
  if (divider < 1 || dataRows.length === 0) {
    throw new Error(`${FIT_TABLE_HEADING} 섹션에는 머리행, 구분행과 데이터 행을 가진 표가 필요합니다.`);
  }
  const header = tableCells(section[divider - 1]);
  if (header.length !== FIT_TABLE_HEADERS.length || !FIT_TABLE_HEADERS.every((title, index) => header[index] === title)) {
    throw new Error(`${FIT_TABLE_HEADING} 표의 머리행은 ${FIT_TABLE_HEADERS.join(", ")} 순서여야 합니다: ${header.join(", ")}`);
  }
  if (tableCells(section[divider]).length !== FIT_TABLE_HEADERS.length) {
    throw new Error(`${FIT_TABLE_HEADING} 표의 구분행은 ${FIT_TABLE_HEADERS.length}열이어야 합니다.`);
  }
  const rows = dataRows.map((line): FitRow => {
    const cells = tableCells(line);
    if (cells.length !== FIT_TABLE_HEADERS.length) {
      throw new Error(`${FIT_TABLE_HEADING} 표의 데이터 행은 ${FIT_TABLE_HEADERS.length}열이어야 합니다: ${cells[0]}`);
    }
    return { item: cells[0], section: cells[1] as FitSection, evidence: cells[2], judgment: cells[3] as FitJudgment };
  });
  validateRows(rows);
  return rows;
}

export function calculateFitScore(rows: FitRow[]): FitScore {
  validateRows(rows);
  const sectionTotals: Record<FitSection, { weightedScore: number; weight: number }> = {
    "주요 업무": { weightedScore: 0, weight: 0 },
    "기대 경험": { weightedScore: 0, weight: 0 },
    "우대 경험": { weightedScore: 0, weight: 0 },
  };
  const judgmentCounts = Object.fromEntries(
    Object.keys(FIT_JUDGMENT_SCORES).map((judgment) => [judgment, 0]),
  ) as Record<FitJudgment, number>;
  let weightedScore = 0;
  let weight = 0;
  for (const row of rows) {
    judgmentCounts[row.judgment] += 1;
    const score = FIT_JUDGMENT_SCORES[row.judgment];
    if (score === null) continue;
    const rowWeight = FIT_SECTION_WEIGHTS[row.section];
    weightedScore += score * rowWeight;
    weight += rowWeight;
    sectionTotals[row.section].weightedScore += score * rowWeight;
    sectionTotals[row.section].weight += rowWeight;
  }
  const average = (sum: number, denominator: number): number | null =>
    denominator === 0 ? null : Math.round(sum / denominator * 10) / 10;
  const sectionScores = Object.fromEntries(
    Object.entries(sectionTotals).map(([section, totals]) => [section, average(totals.weightedScore, totals.weight)]),
  ) as Record<FitSection, number | null>;
  return {
    total: average(weightedScore, weight),
    sectionScores,
    judgmentCounts,
    excludedCount: judgmentCounts["사용자 확인"],
  };
}

export function fitScoreColor(score: number): FitColor {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error("적합도 점수는 0 이상 100 이하의 유한한 숫자여야 합니다.");
  }
  return FIT_SCORE_COLOR_BANDS.find((band) => score >= band.minimum)!.color;
}
