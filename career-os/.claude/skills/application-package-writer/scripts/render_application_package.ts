#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runCli } from "../../../../scripts/lib/cli.ts";
import { dirname, join, resolve } from "node:path";
import { validateApplicationPackage } from "./validate_application_package.ts";
import { validateSubmissionBundle } from "../../resume-preparer/scripts/validate_submission_bundle.ts";
import { loadApplicationForm, type ApplicationForm } from "./application_form_schema.ts";
import { actionPanel } from "./render/actions.ts";
import {
  EVIDENCE_LABELS,
  HUMAN_CONFIRMATION_LABELS,
  READINESS_LABELS,
  TAB_KEYS,
  TOP_SECTION_TITLES,
} from "./render/constants.ts";
import { applicationFormPanel, primaryFiles, renderInterviewQuestions } from "./render/files.ts";
import { renderFitScore } from "./render/fit.ts";
import { buildTabs, fillTemplate, readTemplate } from "./render/layout.ts";
import { escapeHtml, renderMarkdown, splitSections, supportingSection } from "./render/markdown.ts";
import { documentTitle, statusFrom } from "./render/status.ts";
import type { RenderAssets } from "./render/types.ts";

/** 테스트와 문서가 이 파일에서 부르는 이름이다. 구현은 `render/` 가 소유한다. */
export { fillTemplate, renderFitScore, renderMarkdown, TAB_KEYS };

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/** 아직 만들지 않은 원본은 빈 문자열로 읽는다. 화면이 만들어지는 것이 검사보다 먼저다. */
function readIfPresent(path: string): string {
  return existsSync(path) ? read(path) : "";
}

export function renderApplicationPackageHtml(
  packageMarkdown: string,
  interviewMarkdown: string,
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
  const tabs = buildTabs(sections, interviewMarkdown, assets, questionsMarkdown, postingMarkdown);
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
      actionPanel(sections, assets),
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
  const applicationFormPath = join(directory, "evidence", "application-form.json");
  const postingPath = join(directory, "evidence", "posting.md");
  const submission = validateSubmissionBundle(directory);
  const html = renderApplicationPackageHtml(
    packageMarkdown,
    interviewMarkdown,
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
