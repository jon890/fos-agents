#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runCli } from "../../../../scripts/lib/cli.ts";
import { dirname, join, resolve } from "node:path";
import { validateApplicationPackage } from "./validate_application_package.ts";
import { validateSubmissionBundle } from "../../resume-preparer/scripts/validate_submission_bundle.ts";
import { loadApplicationInterviewQuestions } from "../../../../scripts/interview-drill/application_question_schema.ts";
import { loadApplicationForm, type ApplicationForm } from "./application_form_schema.ts";
import { FIT_SCORE_COLUMN } from "./package_contract.ts";
import { computeFitScores, PENDING_SCORE } from "./fit_score.ts";

/** 모델이 적지 않았으면 그 자리는 `null` 이다. 화면은 그 배지를 그리지 않는다. */
type PackageStatus = {
  readiness: "ready" | "needs_user_input" | "revise" | "do_not_apply" | null;
  evidence: "safe" | "revise" | "blocked" | null;
  humanConfirmation: "complete" | "needs_input" | null;
};

type MarkdownSection = {
  title: string;
  body: string;
};

type RenderAssets = {
  resumePdf?: boolean;
  careerDescriptionPdf?: boolean;
  submissionPdf?: boolean;
  submissionReady?: boolean;
  submissionBlockers?: string[];
};

type ActionItem = {
  owner: "내 확인" | "에이전트 작업";
  body: string;
};

/** 탭 밖 상단에 고정하는 섹션. 어느 탭을 보고 있든 보여야 한다. */
const TOP_SECTION_TITLES = new Set(["결론", "제출 준비 상태", "사용자 확인 필요"]);

const FIT_TAB_SECTION_TITLES = ["공고 항목별 적합도", "공개 자료로 확인한 팀과 인접 사례"] as const;

const STRATEGY_TAB_SECTION_TITLES = [
  "이 포지션에서의 승부처",
  "지원동기",
  "입사 후 기여 시나리오",
  // 선택 절이다. 없으면 건너뛰고 나머지 순서는 그대로 둔다.
  "이 자리에서 얻을 경험과 성장",
  "보완할 공백",
  "회사 문화와의 연결",
  "면접에서 검증받을 내용",
  "다음 행동",
] as const;

const TEMPLATE_DIRECTORY = resolve(import.meta.dir, "../templates");

const READINESS_LABELS: Record<NonNullable<PackageStatus["readiness"]>, string> = {
  ready: "제출 검토 가능",
  needs_user_input: "내 답변 필요",
  revise: "문장 보강 필요",
  do_not_apply: "지원 보류 권장",
};

const EVIDENCE_LABELS: Record<NonNullable<PackageStatus["evidence"]>, string> = {
  safe: "근거 안전",
  revise: "근거 표현 조정",
  blocked: "근거 확인 전 사용 금지",
};

const HUMAN_CONFIRMATION_LABELS: Record<NonNullable<PackageStatus["humanConfirmation"]>, string> = {
  complete: "사람 확인 완료",
  needs_input: "내 경험 확인 필요",
};

const QUESTION_ORIGIN_LABELS = {
  posting_requirement: "공고 핵심 책임",
  evidence_defense: "제출 근거 방어",
  experience_gap: "경험 공백 확인",
} as const;


const FIT_COLOR_LABELS: Record<FitColor, string> = {
  excellent: "진한 초록",
  good: "초록",
  fair: "노랑",
  none: "빨강",
};

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/** 아직 만들지 않은 원본은 빈 문자열로 읽는다. 화면이 만들어지는 것이 검사보다 먼저다. */
function readIfPresent(path: string): string {
  return existsSync(path) ? read(path) : "";
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * 표 셀 안의 줄바꿈은 `<br>` 로 적는다. 셀 안 개행이 먹히지 않는 렌더러가 있기 때문이다.
 * escape 뒤에 이 태그만 되살린다. 다른 태그는 이스케이프된 채로 둔다.
 */
function restoreLineBreaks(escaped: string): string {
  return escaped.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
}

/** 끝에 붙은 구두점은 주소에서 뺀다. 문장 끝의 마침표와 쉼표가 주소에 딸려 들어가지 않게 한다. */
const BARE_URL = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

/**
 * 이미 링크나 코드로 만들어진 구간은 건드리지 않고, 남은 맨 주소만 링크로 만든다.
 * `split` 의 캡처 그룹이 결과에 포함되므로 홀수 자리가 보호 구간이다.
 */
function autoLink(html: string): string {
  return html
    .split(/(<a\s[^>]*>[\s\S]*?<\/a>|<code>[\s\S]*?<\/code>)/g)
    .map((part, index) => (index % 2 === 1 ? part : part.replace(BARE_URL, '<a href="$&">$&</a>')))
    .join("");
}

function inlineMarkdown(text: string): string {
  const linked = restoreLineBreaks(escapeHtml(text))
    .replace(
      /\[([^\]]+)]\(((?:https?:\/\/|mailto:|(?:\.\.?\/)+|\/|#)[^\s)]+)\)/g,
      '<a href="$2">$1</a>',
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  return autoLink(linked);
}

function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

function splitSections(markdown: string): MarkdownSection[] {
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    return { title: match[1].trim(), body: markdown.slice(start, end).trim() };
  });
}

function isTableDivider(line: string): boolean {
  const cells = line.trim().replace(/^\||\|$/g, "").split("|");
  return cells.length > 1 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * `- ` 로 시작하는 항목을 `<br>` 로 이은 칸은 목록으로 그린다.
 * 근거가 여럿인 칸이 한 문단으로 붙어 있으면 어디까지가 한 근거인지 읽히지 않는다.
 */
function tableCell(cell: string): string {
  const items = cell.split(/<br\s*\/?>/i).map((part) => part.trim()).filter(Boolean);
  if (items.length < 2 || !items.every((item) => item.startsWith("- "))) return inlineMarkdown(cell);
  const rendered = items.map((item) => `<li>${inlineMarkdown(item.slice(2))}</li>`).join("");
  return `<ul class="cell-list">${rendered}</ul>`;
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let list: "ul" | "ol" | null = null;

  const closeList = () => {
    if (list) output.push(`</${list}>`);
    list = null;
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }

    if (line.includes("|") && isTableDivider(lines[index + 1] ?? "")) {
      closeList();
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      index -= 1;

      output.push("<div class=\"table-scroll\"><table><thead><tr>");
      for (const header of headers) output.push(`<th>${inlineMarkdown(header)}</th>`);
      output.push("</tr></thead><tbody>");
      for (const cells of rows) {
        output.push("<tr>");
        for (const cell of cells) output.push(`<td>${tableCell(cell)}</td>`);
        output.push("</tr>");
      }
      output.push("</tbody></table></div>");
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      if (list !== "ul") {
        closeList();
        list = "ul";
        output.push("<ul>");
      }
      output.push(`<li>${inlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      if (list !== "ol") {
        closeList();
        list = "ol";
        output.push("<ol>");
      }
      output.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    closeList();
    if (line.startsWith("> ")) output.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
    else output.push(`<p>${inlineMarkdown(line.trim())}</p>`);
  }

  closeList();
  return output.join("\n");
}

function statusFrom(markdown: string): PackageStatus {
  return {
    readiness: (markdown.match(/^- readiness:\s*(ready|needs_user_input|revise|do_not_apply)\s*$/m)?.[1] ??
      null) as PackageStatus["readiness"],
    evidence: (markdown.match(/^- evidence:\s*(safe|revise|blocked)\s*$/m)?.[1] ??
      null) as PackageStatus["evidence"],
    humanConfirmation: (markdown.match(/^- human-confirmation:\s*(complete|needs_input)\s*$/m)?.[1] ??
      null) as PackageStatus["humanConfirmation"],
  };
}

function documentTitle(markdown: string): string {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "지원 준비";
}

function supportingSection(title: string, markdown: string): string {
  return `<section class="supporting-section" id="${slug(title)}">
    <h2>${escapeHtml(title)}</h2>
    ${renderMarkdown(markdown)}
  </section>`;
}

function primaryFiles(applicationForm: ApplicationForm | undefined, assets: RenderAssets): string {
  const submissionCard = assets.submissionPdf
    ? `<a class="file-card" href="submission.pdf">
        <span>제출 후보</span>
        <strong>제출용 통합 PDF</strong>
        <small>이력서와 경력기술서를 한 파일로 합친 제출 후보입니다.</small>
      </a>`
    : assets.resumePdf
      ? `<a class="file-card" href="resume.pdf">
          <span>제출 후보</span>
          <strong>이력서 PDF</strong>
          <small>지원 사이트에 올릴 이력서 제출 후보입니다.</small>
        </a>`
      : `<article class="file-card pending">
          <span>생성 필요</span>
          <strong>제출 PDF</strong>
          <small>제출 후보 파일이 아직 만들어지지 않았습니다.</small>
        </article>`;
  const formCard = applicationForm
    ? `<a class="file-card" href="#application-form">
        <span>입력 준비</span>
        <strong>지원서 입력값</strong>
        <small>필드 ${applicationForm.sections.reduce((sum, section) => sum + section.fields.length, 0)}개, 서술형 문항 ${applicationForm.questions.length}개를 확인합니다.</small>
      </a>`
    : "";

  return `<section class="primary-files" aria-labelledby="primary-files-title">
    <div>
      <h2 id="primary-files-title">제출 자료</h2>
      <p>실제 제출 파일과 지원서에 입력할 값만 먼저 확인합니다.</p>
    </div>
    <div class="file-grid">
      ${submissionCard}
      ${formCard}
    </div>
  </section>`;
}

type FitColor = "excellent" | "good" | "fair" | "none";

/** 점수를 색으로만 옮긴다. 이름은 붙이지 않는다. */
const FIT_SCORE_COLOR_BANDS = [
  { minimum: 85, color: "excellent" },
  { minimum: 65, color: "good" },
  { minimum: 35, color: "fair" },
  { minimum: 0, color: "none" },
] as const satisfies readonly { minimum: number; color: FitColor }[];

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

function userFacingBlocker(error: string): string {
  if (error.includes("resume-scorecard.md의 verdict")) {
    return "이력서가 인사담당자와 실무담당자 리뷰를 통과하도록 문장을 보강해야 합니다.";
  }
  if (error.includes("career-description-scorecard.md의 verdict")) {
    return "경력기술서가 인사담당자와 실무담당자 리뷰를 통과하도록 문장을 보강해야 합니다.";
  }
  if (error.includes("해시") || error.includes("오래됐습니다")) {
    return "PDF와 최신 원문의 버전을 다시 맞춰야 합니다.";
  }
  if (error.includes("파일이 없습니다") || error.includes("파일이 비어 있습니다")) {
    return "제출 묶음에 필요한 파일을 생성해야 합니다.";
  }
  if (error.includes("evidence가 safe")) {
    return "제출 문장의 근거 범위를 다시 확인해야 합니다.";
  }
  if (error.includes("human-confirmation이 complete")) {
    return "지원동기나 경험 범위에 관한 내 확인이 필요합니다.";
  }
  return "제출 묶음 검증에서 확인된 문제를 해결해야 합니다.";
}

function actionItems(status: PackageStatus, assets: RenderAssets): ActionItem[] {
  const actions: ActionItem[] = [];
  if (status.humanConfirmation === "needs_input") {
    actions.push({ owner: "내 확인", body: "지원동기, 실제 역할 또는 결과 범위에 답해야 합니다." });
  }
  if (status.evidence && status.evidence !== "safe") {
    actions.push({ owner: "에이전트 작업", body: "근거보다 강한 제출 문장을 낮추거나 추가 근거를 확인해야 합니다." });
  }
  for (const blocker of new Set((assets.submissionBlockers ?? []).map(userFacingBlocker))) {
    actions.push({ owner: "에이전트 작업", body: blocker });
  }
  if (actions.length === 0 && assets.submissionReady) {
    actions.push({ owner: "내 확인", body: "제출 PDF와 지원서 입력값을 읽고 실제 지원 진행 여부를 승인합니다." });
  } else if (actions.length === 0 && status.readiness === "revise") {
    actions.push({ owner: "에이전트 작업", body: "지원 전략과 제출 문장을 보강해야 합니다." });
  }
  return actions;
}

function actionPanel(status: PackageStatus, assets: RenderAssets): string {
  const actions = actionItems(status, assets);
  return `<section class="action-panel" aria-labelledby="action-panel-title">
    <div>
      <p class="eyebrow">NEXT ACTION</p>
      <h2 id="action-panel-title">지금 할 일</h2>
    </div>
    <ul>${actions.map((action) => `<li><strong>${action.owner}</strong><span>${escapeHtml(action.body)}</span></li>`).join("")}</ul>
  </section>`;
}

function applicationFormPanel(form: ApplicationForm | undefined): string {
  if (!form) return "";
  const sections = form.sections.map((section) => `<section class="form-section">
    <h3>${escapeHtml(section.title)}</h3>
    <dl>${section.fields.map((field) => `<div><dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(field.value)}</dd></div>`).join("")}</dl>
  </section>`).join("");
  const attachments = form.attachments.length > 0
    ? `<section class="form-section"><h3>첨부 파일</h3><ul>${form.attachments.map((attachment) => `<li><code>${escapeHtml(attachment.file)}</code> · ${escapeHtml(attachment.label)}</li>`).join("")}</ul></section>`
    : "";
  const questions = form.questions.length > 0
    ? `<section class="form-section"><h3>서술형 문항</h3>${form.questions.map((question) => `<article class="question-answer"><h4>${escapeHtml(question.prompt)}</h4><p>${escapeHtml(question.answer)}</p>${question.limit ? `<small>${question.limit}자 제한</small>` : ""}</article>`).join("")}</section>`
    : "";
  const notes = form.notes.length > 0
    ? `<section class="form-section"><h3>입력할 때 확인할 내용</h3><ul>${form.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul></section>`
    : "";

  return `<details class="form-drawer" id="application-form">
    <summary>지원서 입력값<span>${form.status === "fields_verified" ? "필드 확인 완료" : "추가 확인 필요"}</span></summary>
    <div class="drawer-body">
      <p class="form-meta">${escapeHtml(form.verifiedAt)}에 확인한 지원 화면입니다. 최종 제출 버튼은 별도 승인 전에는 누르지 않습니다.</p>
      ${sections}${attachments}${questions}${notes}
    </div>
  </details>`;
}

function renderInterviewQuestions(applicationDirectory: string): string {
  const file = loadApplicationInterviewQuestions(applicationDirectory);
  return file.questions
    .map((question, index) => {
      const signals = question.answerSignals.map((signal) => `- ${signal}`).join("\n");
      const followUps = question.followUps?.map((followUp) => `- ${followUp}`).join("\n");
      return [
        `### ${index + 1}. ${question.question}`,
        `출처: ${QUESTION_ORIGIN_LABELS[question.origin]}`,
        `의도: ${question.intent}`,
        "답변에서 확인할 신호:",
        signals,
        `근거 경계: ${question.evidenceBoundary}`,
        followUps ? `꼬리 질문:\n${followUps}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    })
    .join("\n\n");
}

/** 순서가 화면 순서이고 첫 항목이 기본 선택이다. 공고 원문을 먼저 읽고 적합도를 본다. */
const TABS = [
  { key: "posting", label: "공고 원문" },
  { key: "fit", label: "공고 적합도" },
  { key: "strategy", label: "지원 전략" },
  { key: "detail", label: "상세 자료" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** CSS 가 탭 키마다 선택자를 하드코딩하므로 테스트가 두 곳을 대조한다. */
export const TAB_KEYS: readonly TabKey[] = TABS.map((tab) => tab.key);

function readTemplate(name: string): string {
  return read(join(TEMPLATE_DIRECTORY, name));
}

/** 치환 이름을 모두 채우고, 남은 이름이 있으면 그 이름을 담은 오류를 낸다. */
export function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
  const remaining = new Set<string>();
  // 콜백 반환값은 치환 패턴으로 해석되지 않으므로 본문의 달러 기호가 그대로 남는다.
  const filled = template.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (match, name: string) => {
    if (Object.hasOwn(values, name)) return values[name];
    remaining.add(name);
    return match;
  });
  if (remaining.size > 0) {
    throw new Error(`템플릿에 채우지 못한 치환 이름이 남았습니다: ${[...remaining].join(", ")}`);
  }
  return filled;
}

/** 섹션 제목이 `h2`이므로 본문 제목을 한 단계 낮춰 단계가 뒤집히지 않게 한다. */
function demoteHeadings(markdown: string): string {
  return markdown.replace(/^(#{1,3})(\s+)/gm, "#$1$2");
}

function tabPanelBody(sections: readonly MarkdownSection[]): string {
  return sections.map((section) => supportingSection(section.title, section.body)).join("\n");
}

function buildTabs(
  sections: readonly MarkdownSection[],
  interviewMarkdown: string,
  resumeMarkdown: string,
  assets: RenderAssets,
  questionsMarkdown: string | undefined,
  postingMarkdown: string | undefined,
): { buttons: string; panels: string } {
  const byTitle = (title: string) => sections.find((section) => section.title === title);
  const fitSections = FIT_TAB_SECTION_TITLES.map(byTitle).filter((section) => section !== undefined);
  const strategySections = STRATEGY_TAB_SECTION_TITLES.map(byTitle).filter((section) => section !== undefined);
  const placed = new Set<string>([
    ...TOP_SECTION_TITLES,
    ...FIT_TAB_SECTION_TITLES,
    ...STRATEGY_TAB_SECTION_TITLES,
  ]);
  // 표에 없는 섹션은 화면에서 사라지지 않도록 지원 전략 탭 끝에 붙인다.
  const extraSections = sections.filter((section) => !placed.has(section.title));

  const bodies: Partial<Record<TabKey, string>> = {
    fit: tabPanelBody(fitSections),
    strategy: tabPanelBody([...strategySections, ...extraSections]),
    posting: postingMarkdown ? supportingSection("공고 원문", demoteHeadings(postingMarkdown)) : undefined,
    detail: detailTabBody(interviewMarkdown, resumeMarkdown, assets, questionsMarkdown),
  };

  const activeTabs = TABS.filter((tab) => bodies[tab.key] !== undefined);
  const inputs = activeTabs
    .map((tab, index) =>
      `<input type="radio" name="tab" class="tab-input" id="tab-${tab.key}"${index === 0 ? " checked" : ""}>`,
    )
    .join("\n      ");
  const labels = activeTabs
    .map((tab) => `<label for="tab-${tab.key}">${escapeHtml(tab.label)}</label>`)
    .join("\n        ");
  const panels = activeTabs
    .map(
      (tab) => `<section class="tab-panel" id="panel-${tab.key}" aria-label="${escapeHtml(tab.label)}">
${bodies[tab.key]}
        </section>`,
    )
    .join("\n        ");

  return {
    buttons: `${inputs}
      <div class="tab-buttons">
        ${labels}
      </div>`,
    panels,
  };
}

function detailTabBody(
  interviewMarkdown: string,
  resumeMarkdown: string,
  assets: RenderAssets,
  questionsMarkdown?: string,
): string {
  const individualPdfs = [
    assets.resumePdf ? '<a href="resume.pdf">이력서 PDF</a>' : "",
    assets.careerDescriptionPdf ? '<a href="career-description.pdf">경력기술서 PDF</a>' : "",
  ].filter(Boolean).join("");
  const sections = [
    supportingSection("이력서 원문", resumeMarkdown),
    questionsMarkdown ? supportingSection("포지션별 면접 질문", questionsMarkdown) : "",
    supportingSection("후보자 인터뷰 기록", interviewMarkdown),
  ].filter(Boolean).join("\n");

  return [
    individualPdfs ? `<nav class="secondary-files" aria-label="개별 제출 PDF">${individualPdfs}</nav>` : "",
    sections,
  ].filter(Boolean).join("\n");
}

export function renderApplicationPackageHtml(
  packageMarkdown: string,
  interviewMarkdown: string,
  resumeMarkdown: string,
  applicationForm?: ApplicationForm,
  assets: RenderAssets = {},
  questionsMarkdown?: string,
  postingMarkdown?: string,
  generatedAt?: string,
): string {
  const title = documentTitle(packageMarkdown);
  const status = statusFrom(packageMarkdown);
  const sections = splitSections(packageMarkdown);
  const conclusion = sections.find((section) => section.title === "결론");
  const fitScore = sections.some((section) => section.title === "공고 항목별 적합도")
    ? renderFitScore(packageMarkdown)
    : "";
  const tabs = buildTabs(sections, interviewMarkdown, resumeMarkdown, assets, questionsMarkdown, postingMarkdown);
  const submissionLabel = assets.submissionReady ? "제출 검증 완료" : "제출 준비 중";
  const statusBadges = [
    status.readiness &&
      `<span class="status readiness-${status.readiness}">${READINESS_LABELS[status.readiness]}</span>`,
    status.evidence &&
      `<span class="status evidence-${status.evidence}">${EVIDENCE_LABELS[status.evidence]}</span>`,
    status.humanConfirmation &&
      `<span class="status human-${status.humanConfirmation}">${HUMAN_CONFIRMATION_LABELS[status.humanConfirmation]}</span>`,
    `<span class="status ${assets.submissionReady ? "evidence-safe" : "evidence-revise"}">${submissionLabel}</span>`,
  ].filter(Boolean).join("\n        ");
  const heroNotes = sections
    .filter((section) => section.title !== "결론" && TOP_SECTION_TITLES.has(section.title))
    .map((section) => supportingSection(section.title, section.body))
    .join("\n");

  return fillTemplate(readTemplate("application-package.html"), {
    TITLE: escapeHtml(title),
    STYLE: readTemplate("application-package.css"),
    STATUS_BADGES: statusBadges,
    FIT_SCORE: fitScore,
    CONCLUSION: [
      conclusion ? `<div class="hero-copy">${renderMarkdown(conclusion.body)}</div>` : "",
      heroNotes ? `<div class="hero-notes">${heroNotes}</div>` : "",
    ].filter(Boolean).join("\n      "),
    PRIMARY_FILES: [
      actionPanel(status, assets),
      primaryFiles(applicationForm, assets),
      applicationFormPanel(applicationForm),
    ].filter(Boolean).join("\n    "),
    TAB_BUTTONS: tabs.buttons,
    TAB_PANELS: tabs.panels,
    GENERATED_AT: escapeHtml(generatedAt ?? new Date().toISOString()),
  });
}

export function renderApplicationPackage(applicationDirectory: string, outputPath?: string): string {
  const directory = resolve(applicationDirectory);
  const validation = validateApplicationPackage(directory);
  if (!validation.passed) throw new Error(validation.errors.join("\n"));

  // 세 파일이 한 화면으로 합쳐진다. 절을 제목으로 골라 쓰므로 이어 붙이면 된다.
  // 아직 만들지 않은 파일은 빈 문자열로 둔다. 화면은 그만큼 비어 보인다.
  const packageMarkdown = ["status.md", "fit.md", "strategy.md"]
    .map((file) => readIfPresent(join(directory, "evidence", file)))
    .join("\n\n");
  const interviewMarkdown = readIfPresent(join(directory, "evidence", "candidate-interview.md"));
  const resumeMarkdown = readIfPresent(join(directory, "evidence", "resume-draft.md"));
  const applicationFormPath = join(directory, "evidence", "application-form.json");
  const postingPath = join(directory, "evidence", "posting.md");
  const submission = validateSubmissionBundle(directory);
  const html = renderApplicationPackageHtml(
    packageMarkdown,
    interviewMarkdown,
    resumeMarkdown,
    existsSync(applicationFormPath) ? loadApplicationForm(applicationFormPath) : undefined,
    {
      resumePdf: existsSync(join(directory, "resume.pdf")),
      careerDescriptionPdf: existsSync(join(directory, "career-description.pdf")),
      submissionPdf: existsSync(join(directory, "submission.pdf")),
      submissionReady: submission.passed,
      submissionBlockers: submission.errors,
    },
    renderInterviewQuestions(directory),
    existsSync(postingPath) ? read(postingPath) : undefined,
  );
  const destination = resolve(outputPath ?? join(directory, "application-package.html"));
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, html, "utf8");
  return destination;
}

if (import.meta.main) {
  await runCli(
    {
      name: "render_application_package.ts",
      summary: "지원 판단과 근거를 검토 화면 HTML 로 만든다.",
      positional: [
        { name: "<application-directory>", description: "지원 디렉터리" },
        { name: "[output-path]", description: "출력 경로. 생략하면 기본 위치에 만든다", required: false },
      ],
    },
    ({ positional }) => {
      console.log(renderApplicationPackage(positional[0], positional[1]));
    },
    { json: false },
  );
}
