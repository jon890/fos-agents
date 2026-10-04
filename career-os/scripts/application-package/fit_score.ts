#!/usr/bin/env bun

/**
 * 적합도 소계와 총점을 표에서 계산한다.
 * 문서에는 행별 점수와 구분별 가중치만 두고, 합과 나눗셈은 여기가 소유한다.
 * 사람이 옮겨 적으면 행을 고칠 때마다 총점이 어긋난다.
 */

import { FIT_SCORE_COLUMN } from "./package_contract.ts";

/** 아직 점수를 낼 수 없는 행. 분자와 분모 양쪽에서 뺀다. */
export const PENDING_SCORE = "사용자 확인";

const CATEGORY_COLUMN = "공고 구분";
const WEIGHT_COLUMN = "가중치";
const FULL_SCORE = 100;

export type FitCategory = {
  category: string;
  weight: number;
  scores: number[];
  pending: number;
  subtotal: number;
};

export type FitScores = {
  categories: FitCategory[];
  total: number | null;
  numerator: number;
  denominator: number;
};

type Table = { headers: string[]; rows: string[][] };

function cells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function isDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}/.test(line) && line.includes("|");
}

/** 머리글에 주어진 이름을 모두 가진 표를 모은다. */
function tablesWith(markdown: string, required: string[]): Table[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const found: Table[] = [];
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].includes("|") || !isDivider(lines[index + 1] ?? "")) continue;
    const headers = cells(lines[index]);
    let cursor = index + 2;
    const rows: string[][] = [];
    while (cursor < lines.length && lines[cursor].includes("|") && lines[cursor].trim()) {
      rows.push(cells(lines[cursor]));
      cursor += 1;
    }
    index = cursor - 1;
    if (required.every((name) => headers.includes(name))) found.push({ headers, rows });
  }
  return found;
}

/** 구분별 가중치. 표가 없으면 모든 구분을 1로 본다. */
function weights(markdown: string): Map<string, number> {
  const table = tablesWith(markdown, [CATEGORY_COLUMN, WEIGHT_COLUMN])
    .find((candidate) => !candidate.headers.includes(FIT_SCORE_COLUMN));
  const map = new Map<string, number>();
  if (!table) return map;
  const categoryAt = table.headers.indexOf(CATEGORY_COLUMN);
  const weightAt = table.headers.indexOf(WEIGHT_COLUMN);
  for (const row of table.rows) {
    const weight = Number(row[weightAt]);
    if (Number.isFinite(weight)) map.set(row[categoryAt], weight);
  }
  return map;
}

export function computeFitScores(markdown: string): FitScores {
  const table = tablesWith(markdown, [CATEGORY_COLUMN, FIT_SCORE_COLUMN])[0];
  const empty: FitScores = { categories: [], total: null, numerator: 0, denominator: 0 };
  if (!table) return empty;

  const categoryAt = table.headers.indexOf(CATEGORY_COLUMN);
  const scoreAt = table.headers.indexOf(FIT_SCORE_COLUMN);
  const weightOf = weights(markdown);

  const order: string[] = [];
  const collected = new Map<string, { scores: number[]; pending: number }>();
  for (const row of table.rows) {
    const category = row[categoryAt];
    if (!category) continue;
    if (!collected.has(category)) {
      collected.set(category, { scores: [], pending: 0 });
      order.push(category);
    }
    const bucket = collected.get(category)!;
    const raw = row[scoreAt];
    if (raw === PENDING_SCORE) bucket.pending += 1;
    else if (Number.isFinite(Number(raw))) bucket.scores.push(Number(raw));
  }

  let numerator = 0;
  let denominator = 0;
  const categories = order.map((category) => {
    const { scores, pending } = collected.get(category)!;
    const weight = weightOf.get(category) ?? 1;
    const sum = scores.reduce((left, right) => left + right, 0);
    numerator += sum * weight;
    denominator += scores.length * FULL_SCORE * weight;
    return {
      category,
      weight,
      scores,
      pending,
      subtotal: scores.length === 0 ? 0 : round(sum / scores.length),
    };
  });

  return {
    categories,
    total: denominator === 0 ? null : round((numerator / denominator) * FULL_SCORE),
    numerator,
    denominator,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
