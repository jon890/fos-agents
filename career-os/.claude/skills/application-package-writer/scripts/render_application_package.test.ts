import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REQUIRED_HEADINGS, REQUIRED_PACKAGE_FILES } from "./package_contract.ts";
import { renderApplicationPackage } from "./render_application_package.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "application-package-render-"));
  directories.push(directory);
  for (const file of REQUIRED_PACKAGE_FILES) {
    if (file === "interview-questions.json") continue;
    const headings = (REQUIRED_HEADINGS[file] ?? []).join("\n\n내용\n\n");
    writeFileSync(join(directory, file), `# ${file}\n\n${headings}\n`, "utf8");
  }
  writeFileSync(
    join(directory, "application-package.md"),
    `# 토스플레이스 AI Platform 지원 준비\n\n- readiness: needs_user_input\n- evidence: safe\n- 공식 공고: https://example.com/job\n- 근거: sources/fos-study/task/example.md\n\n${REQUIRED_HEADINGS["application-package.md"].join("\n\n내용\n\n")}`,
  );
  writeFileSync(
    join(directory, "interview-questions.json"),
    JSON.stringify({
      schemaVersion: 1,
      company: "토스플레이스",
      role: "AI Platform Server Developer",
      sourceDocuments: ["application-package.md"],
      questions: [
        {
          id: "tossplace-position-question",
          drillType: "tech",
          topic: "position-question",
          category: "ai-platform",
          difficulty: "advanced",
          question: "여러 팀이 함께 사용하는 AI Platform의 공통 계약을 어떻게 설계하겠습니까?",
          intent: "포지션의 공통 플랫폼 책임에 맞는 판단을 확인한다.",
          answerSignals: ["입출력 계약", "권한과 오류 경계"],
          positionFitHint: "현재 지원 포지션의 핵심 책임과 연결한다.",
          origin: "posting_requirement",
          evidenceBoundary: "설계 질문이며 직접 운영 경험으로 확대하지 않는다."
        }
      ]
    }),
  );
  writeFileSync(join(directory, "application-answers.md"), "# 지원 문항\n\n실제 사용자에게 닿는 AI를 만들고 싶습니다.");
  return directory;
}

describe("renderApplicationPackage", () => {
  test("지원 판단과 제출 초안을 하나의 반응형 HTML로 묶는다", () => {
    const directory = fixture();
    const outputPath = renderApplicationPackage(directory);
    const html = readFileSync(outputPath, "utf8");

    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain("내 답변 필요");
    expect(html).toContain("제출 파일 검증 필요");
    expect(html).toContain('class="review-card"');
    expect(html).toContain(".review-card { min-width: 0;");
    expect(html).toContain(".table-scroll { width: 100%; max-width: 100%;");
    expect(html).toContain("이력서 초안");
    expect(html).toContain("지원 문항 초안");
    expect(html).toContain("후보자 인터뷰 기록");
    expect(html).toContain("포지션별 면접 질문");
    expect(html).toContain("여러 팀이 함께 사용하는 AI Platform");
  });

  test("존재하는 경력기술서와 통합 PDF 링크를 같은 화면에 표시한다", () => {
    const directory = fixture();
    writeFileSync(join(directory, "career-description.html"), "<main>경력기술서</main>");
    writeFileSync(join(directory, "career-description.pdf"), "pdf");
    writeFileSync(join(directory, "submission.pdf"), "pdf");

    const html = readFileSync(renderApplicationPackage(directory), "utf8");
    expect(html).toContain('href="career-description.pdf"');
    expect(html).toContain('href="submission.pdf"');
  });
});
