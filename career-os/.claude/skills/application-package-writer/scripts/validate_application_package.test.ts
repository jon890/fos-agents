import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  FIT_TABLE_HEADING,
  GROWTH_HEADING,
  GROWTH_SUBHEADINGS,
  REQUIRED_HEADINGS,
  REQUIRED_PACKAGE_FILES,
} from "./package_contract.ts";
import { validateApplicationPackage } from "./validate_application_package.ts";

const FIT_TABLE = `| 공고 항목 | 공고 구분 | 근거 | 판정 |
| --- | --- | --- | --- |
| 공통 기반 표준화 | 주요 업무 | 공통 모듈 분리 경험 | 확인됨 |
| 자체 호스팅 모델 운영 | 우대 경험 | 직접 근거 없음 | 공백 |`;

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function packageBody(): string {
  return REQUIRED_HEADINGS["evidence/application-package.md"]
    .map((heading) => (heading === FIT_TABLE_HEADING ? `${heading}\n\n${FIT_TABLE}` : `${heading}\n\n내용`))
    .join("\n\n");
}

/** 하위 절 다섯을 계약 순서대로 채운 선택 절. 트래픽 절은 쓰기와 읽기를 나눠 적는다. */
function growthSection(): string {
  const body = (subheading: string) =>
    subheading === "### 경험할 수 있는 트래픽의 성격"
      ? "쓰기는 일 12만 건이고 읽기는 초당 900건이다."
      : "내용";
  return [GROWTH_HEADING, ...GROWTH_SUBHEADINGS.map((subheading) => `${subheading}\n\n${body(subheading)}`)].join("\n\n");
}

/** 선택 절을 「입사 후 기여 시나리오」와 「보완할 공백」 사이에 끼운다. */
function withGrowthSection(directory: string, section = growthSection()): void {
  const path = join(directory, "evidence", "application-package.md");
  write(
    directory,
    "evidence/application-package.md",
    readFileSync(path, "utf8").replace("## 보완할 공백", `${section}\n\n## 보완할 공백`),
  );
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
    "evidence/application-package.md",
    `# 지원 준비\n\n- readiness: ready\n- evidence: safe\n- human-confirmation: complete\n- 공식 공고: https://example.com/job\n- 근거: sources/fos-study/task/example.md\n\n${packageBody()}`,
  );
  write(
    directory,
    "evidence/interview-questions.json",
    JSON.stringify({
      schemaVersion: 1,
      company: "예시 회사",
      role: "Backend Developer",
      sourceDocuments: ["evidence/application-package.md"],
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
    const path = join(directory, "evidence", "application-package.md");
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
    const path = join(directory, "evidence", "application-package.md");
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

  test("네 열 머리행과 계약된 판정 값을 가진 적합도 표는 통과한다", () => {
    const directory = fixture();
    const text = readFileSync(join(directory, "evidence", "application-package.md"), "utf8");
    expect(text).toContain("| 공고 항목 | 공고 구분 | 근거 | 판정 |");

    expect(validateApplicationPackage(directory).passed).toBe(true);
  });

  test("적합도 표의 판정에 계약에 없는 값이 있으면 거부한다", () => {
    const directory = fixture();
    const path = join(directory, "evidence", "application-package.md");
    write(
      directory,
      "evidence/application-package.md",
      readFileSync(path, "utf8").replace("| 확인됨 |", "| 대체로 맞음 |"),
    );

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("표의 판정은 확인됨, 강한 인접, 인접 경험, 공백, 사용자 확인 중 하나여야 합니다: 대체로 맞음");
  });

  test("강한 인접 판정을 허용하고 검증 결과에 75점과 소계를 반환한다", () => {
    const directory = fixture();
    const path = join(directory, "evidence", "application-package.md");
    write(directory, "evidence/application-package.md", readFileSync(path, "utf8").replace(
      FIT_TABLE,
      "| 공고 항목 | 공고 구분 | 근거 | 판정 |\n| --- | --- | --- | --- |\n| 공통 API | 주요 업무 | 같은 문제 유형의 개발 경험 | 강한 인접 |",
    ));

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.fitScore).toEqual({
      total: 75,
      sectionScores: { "주요 업무": 75, "기대 경험": null, "우대 경험": null },
      judgmentCounts: { 확인됨: 0, "강한 인접": 1, "인접 경험": 0, 공백: 0, "사용자 확인": 0 },
      excludedCount: 0,
    });
  });

  test.each([
    ["구분", "| 주요 업무 |", "| 있으면 좋음 |", "공고 구분은 주요 업무, 기대 경험, 우대 경험 중 하나"],
    ["근거", "| 공통 모듈 분리 경험 |", "|  |", "사용자 확인이 아닌 항목에는 근거가 필요"],
    ["중복 항목", "| 자체 호스팅 모델 운영 |", "| 공통 기반 표준화 |", "공고 항목이 중복"],
  ])("적합도 표에 %s 오류가 있으면 거부하고 점수를 반환하지 않는다", (_name, before, after, message) => {
    const directory = fixture();
    const path = join(directory, "evidence", "application-package.md");
    write(directory, "evidence/application-package.md", readFileSync(path, "utf8").replace(before, after));

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain(message);
    expect(result.fitScore).toBeUndefined();
  });

  test("근거가 빈 사용자 확인 행은 허용하며 총점의 분모에서 제외한다", () => {
    const directory = fixture();
    const path = join(directory, "evidence", "application-package.md");
    write(directory, "evidence/application-package.md", readFileSync(path, "utf8").replace(
      "| 직접 근거 없음 | 공백 |", "| | 사용자 확인 |",
    ));

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(true);
    expect(result.fitScore?.total).toBe(100);
    expect(result.fitScore?.sectionScores["우대 경험"]).toBeNull();
    expect(result.fitScore?.excludedCount).toBe(1);
  });

  test("적합도 표의 머리행 이름이 다르면 거부한다", () => {
    const directory = fixture();
    const path = join(directory, "evidence", "application-package.md");
    write(directory, "evidence/application-package.md", readFileSync(path, "utf8").replace("| 공고 구분 |", "| 구분 |"));

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("표의 머리행은 공고 항목, 공고 구분, 근거, 판정 순서여야 합니다");
  });

  test("적합도 표의 열 순서가 뒤바뀌면 거부한다", () => {
    const directory = fixture();
    const path = join(directory, "evidence", "application-package.md");
    write(
      directory,
      "evidence/application-package.md",
      readFileSync(path, "utf8").replace(
        "| 공고 항목 | 공고 구분 | 근거 | 판정 |",
        "| 공고 항목 | 근거 | 공고 구분 | 판정 |",
      ),
    );

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("표의 머리행은 공고 항목, 공고 구분, 근거, 판정 순서여야 합니다");
  });

  test("적합도 섹션에 표가 없으면 거부한다", () => {
    const directory = fixture();
    const path = join(directory, "evidence", "application-package.md");
    write(directory, "evidence/application-package.md", readFileSync(path, "utf8").replace(FIT_TABLE, "표 없이 서술만 남긴다."));

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("머리행, 구분행과 데이터 행을 가진 표가 필요합니다");
  });

  test("적합도 섹션에 표가 둘이어도 첫 표만 검사한다", () => {
    const directory = fixture();
    const path = join(directory, "evidence", "application-package.md");
    write(
      directory,
      "evidence/application-package.md",
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

  test("이 자리에서 얻을 경험과 성장 절이 없어도 통과한다", () => {
    const directory = fixture();

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(true);
    expect(result.growthSection).toBeUndefined();
  });

  test("하위 절 다섯을 계약 순서대로 갖춘 선택 절을 통과시킨다", () => {
    const directory = fixture();
    withGrowthSection(directory);

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(true);
    expect(result.growthSection?.subheadings).toEqual([...GROWTH_SUBHEADINGS]);
  });

  test("선택 절에 하위 절이 빠지면 빠진 이름을 담아 거부한다", () => {
    const directory = fixture();
    withGrowthSection(directory, growthSection().replace("### 여기서 얻기 어려운 것\n\n내용", ""));

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("하위 절이 빠졌습니다: ### 여기서 얻기 어려운 것");
  });

  test("선택 절의 하위 절 순서가 뒤바뀌면 거부한다", () => {
    const directory = fixture();
    const swapped = [
      GROWTH_HEADING,
      "### 경쟁 서비스와 이 서비스의 위치\n\n내용",
      "### 서비스가 커질 여지\n\n내용",
      "### 경험할 수 있는 트래픽의 성격\n\n쓰기와 읽기를 나눠 적는다.",
      "### 여기서 얻기 쉬운 것\n\n내용",
      "### 여기서 얻기 어려운 것\n\n내용",
    ].join("\n\n");
    withGrowthSection(directory, swapped);

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("순서여야 합니다");
  });

  test("트래픽 절이 쓰기와 읽기를 나누지 않으면 거부한다", () => {
    const directory = fixture();
    withGrowthSection(
      directory,
      growthSection().replace("쓰기는 일 12만 건이고 읽기는 초당 900건이다.", "초당 900건을 처리한다."),
    );

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("쓰기와 읽기를 나눠 적어야 합니다");
  });

  test("선택 절의 하위 절이 비어 있으면 거부한다", () => {
    const directory = fixture();
    withGrowthSection(directory, growthSection().replace("### 여기서 얻기 쉬운 것\n\n내용", "### 여기서 얻기 쉬운 것"));

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("하위 절이 비어 있습니다: ### 여기서 얻기 쉬운 것");
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
      join(directory, "evidence", "application-package.md"),
      join(directory, "application-package.md"),
    );

    const result = validateApplicationPackage(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain(
      "지원 패키지 파일의 층이 어긋났습니다: application-package.md에 있지만 evidence/application-package.md에 있어야 합니다.",
    );
  });
});
