import { loadApplicationInterviewQuestions } from "../../../../../scripts/interview-drill/application_question_schema.ts";
import type { ApplicationForm } from "../application_form_schema.ts";
import { QUESTION_ORIGIN_LABELS } from "./constants.ts";
import { escapeHtml } from "./markdown.ts";
import type { RenderAssets } from "./types.ts";

export function primaryFiles(applicationForm: ApplicationForm | undefined, assets: RenderAssets): string {
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

export function applicationFormPanel(form: ApplicationForm | undefined): string {
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

export function renderInterviewQuestions(applicationDirectory: string): string {
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
