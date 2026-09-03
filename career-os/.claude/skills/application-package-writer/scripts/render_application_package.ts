#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { validateApplicationPackage } from "./validate_application_package.ts";
import { validateSubmissionBundle } from "../../resume-preparer/scripts/validate_submission_bundle.ts";
import { loadApplicationInterviewQuestions } from "../../../../scripts/interview-drill/application_question_schema.ts";
import { loadApplicationForm, type ApplicationForm } from "./application_form_schema.ts";

type PackageStatus = {
  readiness: "ready" | "needs_user_input" | "revise" | "do_not_apply";
  evidence: "safe" | "revise" | "blocked";
  humanConfirmation: "complete" | "needs_input";
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

const PRIMARY_SECTION_TITLES = new Set([
  "이 포지션에서의 승부처",
  "지원동기",
  "보완할 공백",
  "다음 행동",
]);

const READINESS_LABELS: Record<PackageStatus["readiness"], string> = {
  ready: "제출 검토 가능",
  needs_user_input: "내 답변 필요",
  revise: "문장 보강 필요",
  do_not_apply: "지원 보류 권장",
};

const EVIDENCE_LABELS: Record<PackageStatus["evidence"], string> = {
  safe: "근거 안전",
  revise: "근거 표현 조정",
  blocked: "근거 확인 전 사용 금지",
};

const HUMAN_CONFIRMATION_LABELS: Record<PackageStatus["humanConfirmation"], string> = {
  complete: "사람 확인 완료",
  needs_input: "내 경험 확인 필요",
};

const QUESTION_ORIGIN_LABELS = {
  posting_requirement: "공고 핵심 책임",
  evidence_defense: "제출 근거 방어",
  experience_gap: "경험 공백 확인",
} as const;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(
      /\[([^\]]+)]\(((?:https?:\/\/|mailto:|(?:\.\.?\/)+|\/|#)[^\s)]+)\)/g,
      '<a href="$2">$1</a>',
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
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
      output.push("<div class=\"table-scroll\"><table><thead><tr>");
      for (const header of headers) output.push(`<th>${inlineMarkdown(header)}</th>`);
      output.push("</tr></thead><tbody>");
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        output.push("<tr>");
        for (const cell of tableCells(lines[index])) output.push(`<td>${inlineMarkdown(cell)}</td>`);
        output.push("</tr>");
        index += 1;
      }
      index -= 1;
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
  const readiness = markdown.match(/^- readiness:\s*(ready|needs_user_input|revise|do_not_apply)\s*$/m)?.[1];
  const evidence = markdown.match(/^- evidence:\s*(safe|revise|blocked)\s*$/m)?.[1];
  const humanConfirmation = markdown.match(/^- human-confirmation:\s*(complete|needs_input)\s*$/m)?.[1];
  if (!readiness || !evidence || !humanConfirmation) {
    throw new Error("지원 준비 상태를 읽을 수 없습니다.");
  }
  return { readiness, evidence, humanConfirmation } as PackageStatus;
}

function documentTitle(markdown: string): string {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "지원 준비";
}

function supportingSection(title: string, markdown: string): string {
  return `<section class="supporting-section">
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

function userFacingBlocker(error: string): string {
  if (error.includes("resume-scorecard.md의 verdict")) {
    return "이력서가 채용 담당자와 기술 리더 검토를 통과하도록 문장을 보강해야 합니다.";
  }
  if (error.includes("career-description-scorecard.md의 verdict")) {
    return "경력기술서가 채용 담당자와 기술 리더 검토를 통과하도록 문장을 보강해야 합니다.";
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
  if (status.evidence !== "safe") {
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

function supportingDetails(
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

  return `<details class="source-drawer">
    <summary>상세 자료<span>필요할 때만 펼치기</span></summary>
    <div class="drawer-body">
      ${individualPdfs ? `<nav class="secondary-files" aria-label="개별 제출 PDF">${individualPdfs}</nav>` : ""}
      ${sections}
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

export function renderApplicationPackageHtml(
  packageMarkdown: string,
  interviewMarkdown: string,
  resumeMarkdown: string,
  applicationForm?: ApplicationForm,
  assets: RenderAssets = {},
  questionsMarkdown?: string,
): string {
  const title = documentTitle(packageMarkdown);
  const status = statusFrom(packageMarkdown);
  const sections = splitSections(packageMarkdown);
  const conclusion = sections.find((section) => section.title === "결론");
  const primarySections = sections.filter((section) => PRIMARY_SECTION_TITLES.has(section.title));
  const secondarySections = sections.filter(
    (section) => section.title !== "결론" && !PRIMARY_SECTION_TITLES.has(section.title),
  );
  const cards = primarySections
    .map(
      (section) => `<article class="review-card" id="${slug(section.title)}">
        <h2>${escapeHtml(section.title)}</h2>
        <div class="card-body">${renderMarkdown(section.body)}</div>
      </article>`,
    )
    .join("\n");
  const secondaryDetails = secondarySections
    .map((section) => supportingSection(section.title, section.body))
    .join("\n");
  const submissionLabel = assets.submissionReady ? "제출 검증 완료" : "제출 준비 중";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --canvas: #eef2f7;
      --paper: #ffffff;
      --ink: #172033;
      --muted: #687286;
      --line: #d9e0e9;
      --blue: #2d5fe8;
      --blue-soft: #edf2ff;
      --green: #117a55;
      --green-soft: #eaf7f1;
      --amber: #9a5a0a;
      --amber-soft: #fff3df;
      --red: #a63d4d;
      --red-soft: #fff0f2;
      --shadow: 0 12px 34px rgba(29, 44, 75, .08);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; background: var(--canvas); }
    body {
      margin: 0;
      color: var(--ink);
      background:
        linear-gradient(90deg, rgba(45, 95, 232, .045) 1px, transparent 1px) 0 0 / 28px 28px,
        var(--canvas);
      font-family: Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 1.68;
      word-break: keep-all;
    }
    a { color: var(--blue); text-underline-offset: 3px; overflow-wrap: anywhere; }
    a:focus-visible, summary:focus-visible { outline: 3px solid #9bb5ff; outline-offset: 3px; }
    .shell { width: min(1120px, calc(100% - 40px)); margin: 0 auto; padding: 36px 0 72px; }
    .hero {
      position: relative;
      overflow: hidden;
      padding: 34px;
      border: 1px solid #cfd9e8;
      border-radius: 22px;
      background: var(--paper);
      box-shadow: var(--shadow);
    }
    .hero::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 7px;
      background: var(--blue);
    }
    .eyebrow { margin: 0 0 9px; color: var(--blue); font: 750 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; }
    h1 { max-width: 820px; margin: 0; font-size: clamp(30px, 5vw, 52px); line-height: 1.08; letter-spacing: -.04em; }
    .hero-copy { max-width: 820px; margin: 18px 0 0; color: #39455b; font-size: clamp(17px, 2vw, 20px); }
    .status-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
    .status { display: inline-flex; align-items: center; min-height: 34px; padding: 6px 11px; border-radius: 8px; font-weight: 750; font-size: 13px; }
    .readiness-ready, .evidence-safe, .human-complete { color: var(--green); background: var(--green-soft); }
    .readiness-needs_user_input, .readiness-revise, .evidence-revise, .human-needs_input { color: var(--amber); background: var(--amber-soft); }
    .readiness-do_not_apply, .evidence-blocked { color: var(--red); background: var(--red-soft); }
    .action-panel { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 20px; margin-top: 22px; padding: 22px; border: 1px solid #cfd9e8; border-radius: 16px; background: #172033; color: #fff; box-shadow: var(--shadow); }
    .action-panel h2 { margin: 0; font-size: 22px; }
    .action-panel .eyebrow { margin-bottom: 4px; color: #9bb5ff; }
    .action-panel ul { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
    .action-panel li { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 12px; margin: 0; padding: 12px 14px; border-radius: 10px; background: rgba(255,255,255,.08); }
    .action-panel li strong { color: #b8c9ff; font-size: 13px; }
    .action-panel li span { font-size: 14px; }
    .primary-files { display: grid; gap: 16px; margin-top: 22px; padding: 22px; border: 1px solid #cfd9e8; border-radius: 16px; background: var(--paper); box-shadow: var(--shadow); }
    .primary-files h2 { margin: 0 0 4px; font-size: 19px; }
    .primary-files p { margin: 0; color: var(--muted); font-size: 14px; }
    .file-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .file-card { display: grid; align-content: start; gap: 5px; min-width: 0; padding: 16px; border: 1px solid var(--line); border-radius: 12px; color: var(--ink); background: #f8fafc; text-decoration: none; }
    a.file-card:hover { border-color: #9eb4ef; background: var(--blue-soft); }
    .file-card.pending { border-style: dashed; }
    .file-card span { color: var(--blue); font-size: 12px; font-weight: 800; }
    .file-card strong { font-size: 15px; }
    .file-card small { color: var(--muted); font-size: 12px; line-height: 1.55; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 22px; min-width: 0; margin-top: 22px; align-items: start; }
    .cards { display: grid; gap: 14px; min-width: 0; }
    .review-card, .source-drawer, .strategy-drawer, .form-drawer {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--paper);
      box-shadow: 0 5px 18px rgba(29, 44, 75, .045);
    }
    .review-card { min-width: 0; padding: 24px 26px; scroll-margin-top: 20px; }
    .card-body { min-width: 0; }
    .review-card h2 { margin: 0 0 14px; font-size: 20px; line-height: 1.3; letter-spacing: -.02em; }
    .card-body > :first-child, .drawer-body > :first-child { margin-top: 0; }
    .card-body > :last-child, .drawer-body > :last-child { margin-bottom: 0; }
    p { margin: 10px 0; overflow-wrap: anywhere; }
    ul, ol { margin: 10px 0; padding-left: 22px; }
    li { margin: 6px 0; }
    code { padding: 2px 5px; border-radius: 5px; color: #244079; background: #edf2fa; font: 650 .86em/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
    blockquote { margin: 14px 0; padding: 12px 14px; border-left: 4px solid var(--blue); color: #45516a; background: var(--blue-soft); }
    .table-scroll { width: 100%; max-width: 100%; overflow-x: auto; margin: 14px 0; border: 1px solid var(--line); border-radius: 10px; }
    table { width: 100%; min-width: 560px; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 11px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { color: #34405a; background: #f4f7fb; font-size: 12px; }
    tr:last-child td { border-bottom: 0; }
    .review-rail { position: sticky; top: 18px; display: grid; gap: 12px; }
    .rail-card { padding: 18px; border: 1px solid #cbd6e6; border-radius: 16px; background: #f8faff; }
    .rail-card h2 { margin: 0 0 8px; font-size: 15px; }
    .rail-card p { margin: 0; color: var(--muted); font-size: 13px; }
    .rail-card a { display: block; padding: 7px 0; border-bottom: 1px solid #dfe6f1; color: #39455b; font-size: 13px; font-weight: 700; text-decoration: none; }
    .rail-card a:last-child { border-bottom: 0; }
    .supporting { display: grid; gap: 12px; margin-top: 22px; }
    .source-drawer, .strategy-drawer, .form-drawer { overflow: hidden; margin-top: 22px; }
    .source-drawer summary, .strategy-drawer summary, .form-drawer summary { display: flex; justify-content: space-between; gap: 18px; padding: 18px 20px; cursor: pointer; list-style: none; font-weight: 800; }
    .source-drawer summary::-webkit-details-marker, .strategy-drawer summary::-webkit-details-marker, .form-drawer summary::-webkit-details-marker { display: none; }
    .source-drawer summary span, .strategy-drawer summary span, .form-drawer summary span { color: var(--muted); font-size: 12px; font-weight: 650; }
    .source-drawer[open] summary, .strategy-drawer[open] summary, .form-drawer[open] summary { border-bottom: 1px solid var(--line); }
    .drawer-body { padding: 22px; overflow-wrap: anywhere; }
    .drawer-body h1 { font-size: 24px; }
    .drawer-body h2 { margin-top: 24px; font-size: 18px; }
    .drawer-body h3 { margin-top: 18px; font-size: 16px; }
    .secondary-files { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
    .secondary-files a { padding: 7px 10px; border: 1px solid var(--line); border-radius: 8px; color: #33415b; background: #f8fafc; font-size: 13px; font-weight: 700; text-decoration: none; }
    .supporting-section { padding: 4px 0 22px; border-bottom: 1px solid var(--line); }
    .supporting-section + .supporting-section { padding-top: 22px; }
    .supporting-section:last-child { padding-bottom: 0; border-bottom: 0; }
    .supporting-section > h2:first-child { margin-top: 0; }
    .form-meta { margin: 0 0 20px; color: var(--muted); font-size: 13px; }
    .form-section { padding: 0 0 20px; border-bottom: 1px solid var(--line); }
    .form-section + .form-section { padding-top: 20px; }
    .form-section:last-child { padding-bottom: 0; border-bottom: 0; }
    .form-section h3 { margin: 0 0 12px; font-size: 17px; }
    .form-section dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; }
    .form-section dl div { min-width: 0; padding: 11px 12px; border-radius: 9px; background: #f6f8fb; }
    .form-section dt { color: var(--muted); font-size: 12px; }
    .form-section dd { margin: 3px 0 0; font-weight: 700; overflow-wrap: anywhere; }
    .question-answer { padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: #f8fafc; }
    .question-answer + .question-answer { margin-top: 10px; }
    .question-answer h4 { margin: 0 0 8px; font-size: 15px; }
    .question-answer p { white-space: pre-wrap; }
    .question-answer small { color: var(--muted); }
    footer { padding: 24px 4px 0; color: var(--muted); font-size: 12px; text-align: center; }
    @media (max-width: 760px) {
      body { background: var(--canvas); font-size: 15px; }
      .shell { width: min(100% - 24px, 680px); padding: 12px 0 44px; }
      .hero { padding: 25px 20px 23px; border-radius: 16px; }
      .hero::before { inset: 0 0 auto; width: 100%; height: 5px; }
      h1 { font-size: 31px; }
      .hero-copy { font-size: 16px; }
      .layout { display: flex; flex-direction: column-reverse; gap: 12px; margin-top: 12px; }
      .review-rail { position: static; width: 100%; }
      .rail-card:first-child { display: none; }
      .cards { width: 100%; gap: 10px; }
      .review-card { padding: 20px 18px; border-radius: 13px; }
      .review-card h2 { font-size: 18px; }
      .supporting { margin-top: 12px; }
      .source-drawer summary, .strategy-drawer summary, .form-drawer summary { padding: 17px 18px; }
      .drawer-body { padding: 18px; }
      .primary-files { margin-top: 12px; padding: 18px; }
      .file-grid { grid-template-columns: 1fr; }
      .action-panel { grid-template-columns: 1fr; gap: 12px; margin-top: 12px; padding: 18px; }
      .action-panel li { grid-template-columns: 90px minmax(0, 1fr); }
      .form-section dl { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
    @media print {
      body { background: #fff; }
      .shell { width: 100%; padding: 0; }
      .hero, .review-card, .source-drawer { box-shadow: none; }
      .review-rail { display: none; }
      .layout { display: block; }
      .review-card { break-inside: avoid; margin-bottom: 10px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="hero" id="${slug(conclusion?.title ?? "결론")}">
      <p class="eyebrow">APPLICATION REVIEW DESK</p>
      <h1>${escapeHtml(title)}</h1>
      ${conclusion ? `<div class="hero-copy">${renderMarkdown(conclusion.body)}</div>` : ""}
      <div class="status-row" aria-label="지원 준비 상태">
        <span class="status readiness-${status.readiness}">${READINESS_LABELS[status.readiness]}</span>
        <span class="status evidence-${status.evidence}">${EVIDENCE_LABELS[status.evidence]}</span>
        <span class="status human-${status.humanConfirmation}">${HUMAN_CONFIRMATION_LABELS[status.humanConfirmation]}</span>
        <span class="status ${assets.submissionReady ? "evidence-safe" : "evidence-revise"}">${submissionLabel}</span>
      </div>
    </header>

    ${actionPanel(status, assets)}
    ${primaryFiles(applicationForm, assets)}

    <div class="layout">
      <section class="cards" aria-label="지원 검토 내용">${cards}</section>
      <aside class="review-rail" aria-label="검토 안내">
        <section class="rail-card">
          <h2>검토 순서</h2>
          <p>지금 할 일과 제출 자료를 먼저 확인하세요. 승부처, 지원동기와 보완할 공백을 읽고 세부 근거는 필요한 경우에만 펼칩니다.</p>
        </section>
        <nav class="rail-card" aria-label="빠른 이동">
          ${primarySections.map((section) => `<a href="#${slug(section.title)}">${escapeHtml(section.title)}</a>`).join("\n")}
        </nav>
      </aside>
    </div>

    ${applicationFormPanel(applicationForm)}
    <details class="strategy-drawer">
      <summary>지원 전략 상세<span>회사 기준, 근거와 기여 시나리오</span></summary>
      <div class="drawer-body">${secondaryDetails}</div>
    </details>
    <section class="supporting" aria-label="상세 자료">
      ${supportingDetails(interviewMarkdown, resumeMarkdown, assets, questionsMarkdown)}
    </section>
    <footer>로컬 검토용 문서입니다. 실제 제출이나 외부 공개는 별도 승인 뒤 진행합니다.</footer>
  </main>
</body>
</html>`;
}

export function renderApplicationPackage(applicationDirectory: string, outputPath?: string): string {
  const directory = resolve(applicationDirectory);
  const validation = validateApplicationPackage(directory);
  if (!validation.passed) throw new Error(validation.errors.join("\n"));

  const packageMarkdown = read(join(directory, "application-package.md"));
  const interviewMarkdown = read(join(directory, "candidate-interview.md"));
  const resumeMarkdown = read(join(directory, "resume-draft.md"));
  const applicationFormPath = join(directory, "application-form.json");
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
  );
  const destination = resolve(outputPath ?? join(directory, "application-package.html"));
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, html, "utf8");
  return destination;
}

if (import.meta.main) {
  const directory = process.argv[2];
  const outputPath = process.argv[3];
  if (!directory) {
    console.error("사용법: render_application_package.ts <application-directory> [output-path]");
    process.exit(2);
  }
  try {
    console.log(renderApplicationPackage(directory, outputPath));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
