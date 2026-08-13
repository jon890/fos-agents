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

function validResume(): string {
  const sections = RESUME_HTML_CONTRACT.requiredSectionIds
    .map((id) => `<section id="${id}">${id}</section>`)
    .join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>@page { size: A4; } @media print { * { print-color-adjust: exact; } }</style></head><body><main class="resume-page">${sections}<a href="mailto:user@example.com">email</a><a href="https://github.com/user">github</a></main><main class="resume-page"></main></body></html>`;
}

function writeResume(html: string): string {
  const directory = mkdtempSync(join(tmpdir(), "resume-html-"));
  tempDirectories.push(directory);
  const path = join(directory, "resume.html");
  writeFileSync(path, html);
  return path;
}

describe("checkResumeHtml", () => {
  test("계약을 만족하는 이력서를 통과시킨다", () => {
    expect(checkResumeHtml(writeResume(validResume())).passed).toBe(true);
  });

  test("내부 경로가 노출된 이력서를 거부한다", () => {
    const result = checkResumeHtml(writeResume(validResume().replace("</body>", "/Users/private</body>")));
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === "내부 근거 경로 비노출")?.passed).toBe(false);
  });
});
