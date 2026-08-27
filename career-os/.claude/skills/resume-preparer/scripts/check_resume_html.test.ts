import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkResumeHtml } from "./check_resume_html.ts";
import { RESUME_HTML_CONTRACT } from "./resume_html_contract.ts";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function validResume(pageCount = 2): string {
  const sections = RESUME_HTML_CONTRACT.requiredSectionIds
    .map((id) => `<section id="${id}">${id}</section>`)
    .join("");
  const width = Math.max(2, String(pageCount).length);
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const ordinal = String(index + 1).padStart(width, "0");
    const total = String(pageCount).padStart(width, "0");
    const role = index === 0 ? "resume-page--first" : "resume-page--continuation";
    const firstPageContent = index === 0
      ? `<header class="resume-header"></header>${sections}<a href="mailto:user@example.com">email</a><a href="https://github.com/user">github</a>`
      : `<p>${index + 1}페이지 경력 내용</p>`;
    return `<main class="resume-page ${role}" data-page="${ordinal} / ${total}">${firstPageContent}</main>`;
  }).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>@page { size: A4; } @media print { * { print-color-adjust: exact; } }</style></head><body>${pages}</body></html>`;
}

function validCareerDescription(): string {
  const sections = RESUME_HTML_CONTRACT.requiredSectionIds
    .filter((id) => ["career", "skills"].includes(id))
    .map((id) => `<section id="${id}">${id}</section>`)
    .join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>@page { size: A4; } @media print { * { print-color-adjust: exact; } }</style></head><body><main class="resume-page resume-page--first" data-page="01 / 02"><header class="resume-header"></header>${sections}<a href="mailto:user@example.com">email</a><a href="https://github.com/user">github</a></main><main class="resume-page resume-page--second" data-page="02 / 02"><p>경력기술서 상세 내용</p></main></body></html>`;
}

function writeResume(html: string): string {
  const directory = mkdtempSync(join(tmpdir(), "resume-html-"));
  tempDirectories.push(directory);
  const path = join(directory, "resume.html");
  writeFileSync(path, html);
  return path;
}

function writeCareerDescription(html: string): string {
  const directory = mkdtempSync(join(tmpdir(), "career-description-html-"));
  tempDirectories.push(directory);
  const path = join(directory, "career-description.html");
  writeFileSync(path, html);
  return path;
}

describe("checkResumeHtml", () => {
  test("계약을 만족하는 이력서를 통과시킨다", () => {
    expect(checkResumeHtml(writeResume(validResume())).passed).toBe(true);
  });

  test("분량에 맞춘 세 페이지 이력서도 통과시킨다", () => {
    expect(checkResumeHtml(writeResume(validResume(3))).passed).toBe(true);
  });

  test("실제 페이지 수와 순차 표지가 다르면 거부한다", () => {
    const result = checkResumeHtml(writeResume(validResume(3).replace("03 / 03", "03 / 04")));
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === "페이지별 정보 위계")?.passed).toBe(false);
  });

  test("표지만 있고 본문이 없는 페이지를 거부한다", () => {
    const result = checkResumeHtml(writeResume(validResume(3).replace("<p>3페이지 경력 내용</p>", "")));
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === "빈 페이지 없음")?.passed).toBe(false);
  });

  test("내부 경로가 노출된 이력서를 거부한다", () => {
    const result = checkResumeHtml(writeResume(validResume().replace("</body>", "/Users/private</body>")));
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === "내부 근거 경로 비노출")?.passed).toBe(false);
  });

  test("경력기술서에는 경력기술서 전용 섹션 계약을 적용한다", () => {
    const result = checkResumeHtml(writeCareerDescription(validCareerDescription()));
    expect(result.passed).toBe(true);
    expect(result.documentKind).toBe("career-description");
  });
});
