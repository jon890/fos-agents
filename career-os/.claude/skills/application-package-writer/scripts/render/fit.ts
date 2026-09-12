import { computeFitScores, PENDING_SCORE } from "../fit_score.ts";
import { FIT_COLOR_LABELS, FIT_SCORE_COLOR_BANDS } from "./constants.ts";
import { escapeHtml } from "./markdown.ts";
import type { FitColor } from "./types.ts";

function fitScoreColor(score: number): FitColor {
  return FIT_SCORE_COLOR_BANDS.find((band) => score >= band.minimum)?.color ?? "none";
}

/**
 * 점수는 적합도 표에서 계산한다. 문서는 행별 점수와 구분별 가중치만 담는다.
 * 표에 점수 행이 없으면 원을 그리지 않는다.
 */
function scoresFrom(markdown: string): { total: number | null; subtotals: [string, number][] } {
  const computed = computeFitScores(markdown);
  return {
    total: computed.total,
    subtotals: computed.categories.map((category) => [category.category, category.subtotal]),
  };
}

/** 원 아래에 계산 과정을 둔다. 읽는 사람이 같은 숫자를 다시 만들 수 있어야 한다. */
function fitBreakdown(markdown: string): string {
  const computed = computeFitScores(markdown);
  if (computed.categories.length === 0) return "";
  const rows = computed.categories
    .map((category) => {
      const pending = category.pending === 0 ? "" : ` (${PENDING_SCORE} ${category.pending})`;
      return `<tr><td>${escapeHtml(category.category)}</td><td>${category.scores.length}${pending}</td>` +
        `<td>${category.weight}</td><td>${escapeHtml(category.scores.join(", "))}</td>` +
        `<td>${formatFitScore(category.subtotal)}</td></tr>`;
    })
    .join("");
  const formula = computed.total === null
    ? ""
    : `<p class="fit-formula">총점은 <code>${computed.numerator} ÷ ${computed.denominator} × 100 = ` +
      `${formatFitScore(computed.total)}</code> 입니다. 소계는 그 구분에 속한 행의 점수 평균입니다.</p>`;
  return `<details class="fit-breakdown"><summary>소계와 총점을 낸 방법</summary>
    <div class="table-scroll"><table><thead><tr>` +
    `<th>구분</th><th>항목 수</th><th>가중치</th><th>점수</th><th>소계</th>` +
    `</tr></thead><tbody>${rows}</tbody></table></div>${formula}</details>`;
}

function formatFitScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function fitCircle(label: string, score: number | null, total = false): string {
  const color = score === null ? "none" : fitScoreColor(score);
  const pendingTotal = total && score === null;
  const value = score === null ? (pendingTotal ? "판정 대기" : "해당 없음") : formatFitScore(score);
  const ariaScore = score === null ? (pendingTotal ? "판정이 아직 없습니다" : "해당 없음") : `${formatFitScore(score)}점`;
  // 점수가 없으면 색을 읽어 주지 않는다. 빈 원을 낮은 점수로 듣게 된다.
  const ariaLabel = score === null ? `${label} ${ariaScore}` : `${label} ${ariaScore}, 색 ${FIT_COLOR_LABELS[color]}`;
  return `<article class="fit-meter${total ? " fit-meter-total" : ""}">
      <div class="fit-circle fit-${color}${score === null ? " is-empty" : ""}" aria-label="${escapeHtml(ariaLabel)}">
        <span>${escapeHtml(value)}</span>
      </div>
      <strong class="fit-label">${escapeHtml(label)}</strong>
    </article>`;
}

export function renderFitScore(markdown: string): string {
  const { total, subtotals } = scoresFrom(markdown);
  return `<section class="fit-score" aria-labelledby="fit-score-title">
    <div class="fit-meter-row">
      ${fitCircle("적합도 총점", total, true)}
      ${subtotals.map(([label, value]) => fitCircle(label, value)).join("\n      ")}
    </div>
    ${fitBreakdown(markdown)}
    <p class="fit-boundary" id="fit-score-title">적합도 총점은 합격 확률이 아닙니다. 공고 요구와 현재 확보한 근거가 얼마나 맞닿아 있는지 보여주는 검토 점수입니다.</p>
  </section>`;
}
