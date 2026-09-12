import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  REQUIRED_HEADINGS,
  REQUIRED_PACKAGE_FILES,
} from "./package_contract.ts";
import { validateApplicationPackage } from "./validate_application_package.ts";

const FIT_TABLE_HEADING = "## 공고 항목별 적합도";
const FIT_TABLE = `| 공고 항목 | 공고 구분 | 근거 | 판정 |
| --- | --- | --- | --- |
| 공통 기반 표준화 | 주요 업무 | 공통 모듈 분리 경험 | 확인됨 |
| 자체 호스팅 모델 운영 | 우대 경험 | 직접 근거 없음 | 공백 |`;

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function fitBody(): string {
  return REQUIRED_HEADINGS["evidence/fit.md"]
    .map((heading) => (heading === FIT_TABLE_HEADING ? `${heading}\n\n${FIT_TABLE}` : `${heading}\n\n내용`))
    .join("\n\n");
}

function write(directory: string, relativePath: string, content: string): void {
  const path = join(directory, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "application-package-"));
  directories.push(directory);
  for (const file of REQUIRED_PACKAGE_FILES) {
    if (file === "evidence/interview-questions.json") continue;
    const headings = (REQUIRED_HEADINGS[file] ?? []).join("\n\n내용\n\n");
    write(directory, file, `# ${file}\n\n${headings}\n`);
  }
  write(
    directory,
    "evidence/status.md",
    `# 지원 준비 상태\n\n- readiness: ready\n- evidence: safe\n- human-confirmation: complete\n\n${REQUIRED_HEADINGS["evidence/status.md"].join("\n\n내용\n\n")}\n\n내용`,
  );
  write(
    directory,
    "evidence/fit.md",
    `# 적합도\n\n- 공식 공고: https://example.com/job\n- 근거: sources/fos-study/task/example.md\n\n${fitBody()}`,
  );
  write(
    directory,
    "evidence/interview-questions.json",
    JSON.stringify({
      schemaVersion: 1,
      company: "예시 회사",
      role: "Backend Developer",
      sourceDocuments: ["evidence/fit.md"],
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
    write(directory, "evidence/resume-draft.md", `${REQUIRED_HEADINGS["evidence/resume-draft.md"].join("\n")}\nsources/fos-study/task/private.md`);
    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("내부 정보");
  });

  test("포지션별 질문 계약이 잘못되면 거부한다", () => {
    const directory = fixture();
    write(directory, "evidence/interview-questions.json", "{}");
    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("interview-questions.json 형식");
  });

  test("사람 확인 상태가 없으면 거부한다", () => {
    const directory = fixture();
    const path = join(directory, "evidence", "status.md");
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
    const path = join(directory, "evidence", "status.md");
    const content = Bun.file(path).text();
    return content.then((text) => {
      writeFileSync(path, text.replace("human-confirmation: complete", "human-confirmation: needs_input"));
      const result = validateApplicationPackage(directory);
      expect(result.passed).toBe(false);
      expect(result.errors.join("\n")).toContain("human-confirmation은 complete");
    });
  });

  test("구조화된 지원서 입력값을 검증한다", () => {
    const directory = fixture();
    write(directory, "evidence/application-form.json", JSON.stringify({
      schemaVersion: 1,
      formUrl: "https://example.com/job/apply",
      verifiedAt: "2026-09-03",
      status: "fields_verified",
      profileSource: "private-brain:career-application-profile",
      sections: [{
        title: "기본 정보",
        fields: [{ id: "name", label: "이름", value: "김병태", source: "profile", required: true }],
      }],
      attachments: [{ label: "이력서", file: "resume.pdf", required: true }],
      questions: [],
      submission: { autofill: "ready_for_preview", finalSubmit: "requires_user_approval" },
      notes: [],
    }));

    expect(validateApplicationPackage(directory).passed).toBe(true);
  });

  test("기존 application-answers.md가 남으면 마이그레이션을 요구한다", () => {
    const directory = fixture();
    write(directory, "evidence/application-answers.md", "# 지원 문항");

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("application-form.json으로 옮겨야 합니다");
  });

  test("claim ledger를 반복하는 감사 문서가 남으면 거부한다", () => {
    const directory = fixture();
    write(directory, "evidence-audit.md", "# 중복 감사");

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("중복 중간 문서는 보존하지 않습니다");
  });

  test("계약에 없는 파일이 추가되면 거부한다", () => {
    const directory = fixture();
    write(directory, "review-notes.md", "# 임시 검토");

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("지원 패키지 계약에 없는 파일입니다");
  });

  test("세 층에 각각 올바른 파일이 있으면 통과한다", () => {
    const directory = fixture();
    write(directory, "application-package.html", "<html></html>");
    write(directory, "resume.pdf", "%PDF-1.4");
    write(directory, "review/resume.html", "<html></html>");
    write(directory, "review/claim-ledger.json", "{}");
    write(directory, "review/resume-scorecard.md", "# 점수표");
    write(directory, "review/submission-manifest.json", "{}");

    expect(validateApplicationPackage(directory).passed).toBe(true);
  });









  test("적합도 섹션에 표가 둘이어도 첫 표만 검사한다", () => {
    const directory = fixture();
    const path = join(directory, "evidence", "fit.md");
    write(
      directory,
      "evidence/fit.md",
      readFileSync(path, "utf8").replace(
        FIT_TABLE,
        `${FIT_TABLE}\n\n| 참고 자료 | 확인 범위 | 관점 | 비고 |\n| --- | --- | --- | --- |\n| 공고 | 공식 | 책임 확인 | 없음 |`,
      ),
    );

    expect(validateApplicationPackage(directory).passed).toBe(true);
  });

  test("최상위 application-answers.md도 마이그레이션을 요구한다", () => {
    const directory = fixture();
    write(directory, "application-answers.md", "# 지원 문항");

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("application-answers.md는 사용하지 않습니다");
  });


  test("선택 절을 어떤 모양으로 쓰든 검증기가 막지 않는다", () => {
    const directory = fixture();
    const path = join(directory, "evidence", "strategy.md");
    write(
      directory,
      "evidence/strategy.md",
      readFileSync(path, "utf8").replace(
        "## 보완할 공백",
        "## 이 자리에서 얻을 경험과 성장\n\n### 조직이 답하지 않은 것\n\n내용\n\n## 보완할 공백",
      ),
    );

    expect(validateApplicationPackage(directory).passed).toBe(true);
  });





  test("계약에 없는 하위 디렉터리의 파일을 거부한다", () => {
    const directory = fixture();
    write(directory, "notes/scratch.md", "# 임시 검토");
    write(directory, "evidence/sub/resume.html", "<main></main>");

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("지원 패키지 계약에 없는 파일입니다: notes/scratch.md");
    expect(result.errors.join("\n")).toContain("지원 패키지 계약에 없는 파일입니다: evidence/sub/resume.html");
  });

  test("evidence 파일이 최상위에 있으면 발견 경로와 기대 경로를 담아 거부한다", () => {
    const directory = fixture();
    renameSync(
      join(directory, "evidence", "fit.md"),
      join(directory, "fit.md"),
    );

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain(
      "지원 패키지 파일의 층이 어긋났습니다: fit.md에 있지만 evidence/fit.md에 있어야 합니다.",
    );
  });
});
