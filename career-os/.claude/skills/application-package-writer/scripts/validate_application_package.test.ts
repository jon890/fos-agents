import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REQUIRED_HEADINGS, REQUIRED_PACKAGE_FILES } from "./package_contract.ts";
import { validateApplicationPackage } from "./validate_application_package.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "application-package-"));
  directories.push(directory);
  for (const file of REQUIRED_PACKAGE_FILES) {
    if (file === "interview-questions.json") continue;
    const headings = (REQUIRED_HEADINGS[file] ?? []).join("\n\n내용\n\n");
    writeFileSync(join(directory, file), `# ${file}\n\n${headings}\n`, "utf8");
  }
  writeFileSync(
    join(directory, "application-package.md"),
    `# 지원 준비\n\n- readiness: ready\n- evidence: safe\n- human-confirmation: complete\n- 공식 공고: https://example.com/job\n- 근거: sources/fos-study/task/example.md\n\n${REQUIRED_HEADINGS["application-package.md"].join("\n\n내용\n\n")}`,
  );
  writeFileSync(
    join(directory, "interview-questions.json"),
    JSON.stringify({
      schemaVersion: 1,
      company: "예시 회사",
      role: "Backend Developer",
      sourceDocuments: ["application-package.md"],
      questions: [
        {
          id: "example-position-question",
          drillType: "tech",
          topic: "position-question",
          category: "system-design",
          difficulty: "intermediate",
          question: "현재 포지션의 핵심 책임을 어떤 설계와 운영 기준으로 해결하겠습니까?",
          intent: "공고 책임과 후보자의 판단 근거를 함께 확인한다.",
          answerSignals: ["문제 경계", "운영 검증 기준"],
          positionFitHint: "현재 지원 포지션의 핵심 책임과 연결한다.",
          origin: "posting_requirement",
          evidenceBoundary: "설계 질문이며 직접 운영 경험으로 확대하지 않는다."
        }
      ]
    }),
  );
  return directory;
}

describe("validateApplicationPackage", () => {
  test("지원 준비 계약을 만족하면 통과한다", () => {
    expect(validateApplicationPackage(fixture()).passed).toBe(true);
  });

  test("제출 이력서의 내부 근거 경로를 거부한다", () => {
    const directory = fixture();
    writeFileSync(join(directory, "resume-draft.md"), `${REQUIRED_HEADINGS["resume-draft.md"].join("\n")}\nsources/fos-study/task/private.md`);
    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("내부 정보");
  });

  test("포지션별 질문 계약이 잘못되면 거부한다", () => {
    const directory = fixture();
    writeFileSync(join(directory, "interview-questions.json"), "{}");
    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("interview-questions.json 형식");
  });

  test("사람 확인 상태가 없으면 거부한다", () => {
    const directory = fixture();
    const path = join(directory, "application-package.md");
    const content = Bun.file(path).text();
    return content.then((text) => {
      writeFileSync(path, text.replace("- human-confirmation: complete\n", ""));
      const result = validateApplicationPackage(directory);
      expect(result.passed).toBe(false);
      expect(result.errors.join("\n")).toContain("human-confirmation 판정");
    });
  });

  test("사람 확인이 남은 패키지를 ready로 판정하지 않는다", () => {
    const directory = fixture();
    const path = join(directory, "application-package.md");
    const content = Bun.file(path).text();
    return content.then((text) => {
      writeFileSync(path, text.replace("human-confirmation: complete", "human-confirmation: needs_input"));
      const result = validateApplicationPackage(directory);
      expect(result.passed).toBe(false);
      expect(result.errors.join("\n")).toContain("human-confirmation은 complete");
    });
  });
});
